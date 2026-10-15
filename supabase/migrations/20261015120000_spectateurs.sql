-- Spectateurs : le créateur du salon choisit s'il les refuse, les laisse regarder, ou regarder et
-- écouter le vocal. Le spectateur s'inscrit avec son nom auprès du serveur (fonction « game ») ;
-- seuls les spectateurs inscrits lisent la partie, et seuls ceux qui ont le droit d'écouter
-- rejoignent le canal d'écoute « ecoute:<salon> » (où ils ne font que recevoir le son des joueurs).

-- Les spectateurs inscrits, écrits uniquement par le serveur (save_room_v3).
create table public.room_spectators (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null,
  name text not null,
  can_listen boolean not null default false,
  primary key (room_id, user_id)
);

alter table public.room_spectators enable row level security;
revoke all on table public.room_spectators from anon, authenticated;

create function public.is_room_spectator(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_spectators
    where room_id = p_room_id and user_id = (select auth.uid())
  );
$$;

create function public.is_room_listener(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_spectators
    where room_id = p_room_id and user_id = (select auth.uid()) and can_listen
  );
$$;

revoke execute on function public.is_room_spectator(uuid) from public, anon;
revoke execute on function public.is_room_listener(uuid) from public, anon;
grant execute on function public.is_room_spectator(uuid) to authenticated;
grant execute on function public.is_room_listener(uuid) to authenticated;

-- La vue de la partie n'est plus publique : seulement les spectateurs inscrits (et les joueurs).
drop policy "Tout le monde peut regarder une partie" on public.room_watch_views;
revoke select on table public.room_watch_views from anon;

create policy "Spectateurs inscrits : regarder la partie"
  on public.room_watch_views
  for select
  to authenticated
  using (public.is_room_spectator(room_id) or public.is_room_member(room_id));

-- Canal privé « ecoute:<salon> » : les joueurs y envoient leur voix aux spectateurs autorisés.
create function public.room_id_from_listen_topic(p_topic text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_topic ~ '^ecoute:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then substring(p_topic from 8)::uuid
    else null
  end;
$$;

create policy "Joueurs et auditeurs : écouter le canal d'écoute"
  on realtime.messages
  for select
  to authenticated
  using (
    public.is_room_member(public.room_id_from_listen_topic((select realtime.topic())))
    or public.is_room_listener(public.room_id_from_listen_topic((select realtime.topic())))
  );

create policy "Joueurs et auditeurs : écrire sur le canal d'écoute"
  on realtime.messages
  for insert
  to authenticated
  with check (
    public.is_room_member(public.room_id_from_listen_topic((select realtime.topic())))
    or public.is_room_listener(public.room_id_from_listen_topic((select realtime.topic())))
  );

-- Comme save_room_v2, plus la liste des spectateurs inscrits, dans la même transaction.
create function public.save_room_v3(
  p_id uuid,
  p_code text,
  p_expected_version integer,
  p_data jsonb,
  p_views jsonb,
  p_table smallint,
  p_table_info jsonb,
  p_watch jsonb,
  p_spectators jsonb
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result text;
  v_empty boolean := coalesce(jsonb_array_length(p_table_info -> 'players'), 0) = 0;
begin
  v_result := public.save_room_v2(p_id, p_code, p_expected_version, p_data, p_views, p_table, p_table_info, p_watch);
  if v_result <> 'ok' then
    return v_result;
  end if;

  if p_watch is null or v_empty then
    -- Spectateurs refusés, ou table libérée : plus personne ne regarde.
    delete from public.room_spectators where room_id = p_id;
  else
    delete from public.room_spectators s
    where s.room_id = p_id
      and not exists (
        select 1 from jsonb_array_elements(coalesce(p_spectators, '[]'::jsonb)) e
        where (e ->> 'user_id')::uuid = s.user_id
      );
    insert into public.room_spectators (room_id, user_id, name, can_listen)
    select p_id, (e ->> 'user_id')::uuid, e ->> 'name', coalesce((e ->> 'can_listen')::boolean, false)
    from jsonb_array_elements(coalesce(p_spectators, '[]'::jsonb)) e
    on conflict (room_id, user_id) do update set name = excluded.name, can_listen = excluded.can_listen;
  end if;

  return 'ok';
end;
$$;

revoke execute on function public.save_room_v3(uuid, text, integer, jsonb, jsonb, smallint, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_room_v3(uuid, text, integer, jsonb, jsonb, smallint, jsonb, jsonb, jsonb)
  to service_role;
