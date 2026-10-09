-- Salons de belote : l'état complet de chaque salon n'est lisible que par le serveur
-- (Edge Function avec la clé service_role). Chaque joueur ne lit que SA vue filtrée.

create table public.rooms (
  id uuid primary key,
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  version integer not null check (version > 0),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS activée sans aucune politique : aucun accès pour les navigateurs (anon / authenticated).
alter table public.rooms enable row level security;
revoke all on table public.rooms from anon, authenticated;

create table public.player_views (
  room_id uuid not null references public.rooms (id) on delete cascade,
  player_id uuid not null,
  seat smallint not null check (seat between 0 and 3),
  version integer not null,
  view jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (room_id, player_id)
);

create index player_views_player_idx on public.player_views (player_id);

alter table public.player_views enable row level security;
revoke all on table public.player_views from anon, authenticated;
grant select on table public.player_views to authenticated;

create policy "Chaque joueur lit uniquement sa propre vue"
  on public.player_views
  for select
  to authenticated
  using (player_id = (select auth.uid()));

-- Diffusion en temps réel des vues (Realtime respecte la politique ci-dessus).
alter publication supabase_realtime add table public.player_views;

-- Enregistre le salon et toutes les vues en une seule transaction, avec contrôle de version.
create function public.save_room(
  p_id uuid,
  p_code text,
  p_expected_version integer,
  p_data jsonb,
  p_views jsonb
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version integer;
begin
  if p_expected_version is null then
    insert into public.rooms (id, code, version, data)
    values (p_id, p_code, 1, p_data)
    on conflict do nothing;
    if not found then
      return false;
    end if;
    v_version := 1;
    -- Ménage : les salons inactifs depuis 7 jours sont supprimés.
    delete from public.rooms where updated_at < now() - interval '7 days';
  else
    update public.rooms
    set data = p_data, version = p_expected_version + 1, updated_at = now()
    where id = p_id and version = p_expected_version;
    if not found then
      return false;
    end if;
    v_version := p_expected_version + 1;
  end if;

  delete from public.player_views v
  where v.room_id = p_id
    and not exists (
      select 1 from jsonb_array_elements(p_views) e where (e ->> 'player_id')::uuid = v.player_id
    );

  insert into public.player_views (room_id, player_id, seat, version, view)
  select p_id, (e ->> 'player_id')::uuid, (e ->> 'seat')::smallint, v_version, e -> 'view'
  from jsonb_array_elements(p_views) e
  on conflict (room_id, player_id) do update
    set seat = excluded.seat, version = excluded.version, view = excluded.view, updated_at = now();

  return true;
end;
$$;

revoke execute on function public.save_room(uuid, text, integer, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_room(uuid, text, integer, jsonb, jsonb) to service_role;

-- Appartenance à un salon, utilisée pour protéger le canal temps réel du salon.
create function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.player_views
    where room_id = p_room_id and player_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_room_member(uuid) from public, anon;
grant execute on function public.is_room_member(uuid) to authenticated;

-- Canal privé « salon:<id> » (présence des joueurs, puis signalisation vocale en phase 4) :
-- seuls les membres du salon peuvent l'écouter ou y écrire.
create function public.room_id_from_topic(p_topic text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_topic ~ '^salon:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then substring(p_topic from 7)::uuid
    else null
  end;
$$;

create policy "Membres du salon : écouter le canal"
  on realtime.messages
  for select
  to authenticated
  using (public.is_room_member(public.room_id_from_topic((select realtime.topic()))));

create policy "Membres du salon : écrire sur le canal"
  on realtime.messages
  for insert
  to authenticated
  with check (public.is_room_member(public.room_id_from_topic((select realtime.topic()))));
