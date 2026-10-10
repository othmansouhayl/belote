-- Café Tarek : les 6 tables de belote de la salle du fond.
-- Ces deux tables ne contiennent que des informations publiques (pseudos, état, scores,
-- cartes posées) : jamais le code d'un salon, jamais une carte en main.

create table public.cafe_tables (
  table_number smallint primary key check (table_number between 1 and 6),
  room_id uuid not null references public.rooms (id) on delete cascade,
  info jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.cafe_tables enable row level security;
revoke all on table public.cafe_tables from anon, authenticated;
grant select on table public.cafe_tables to anon, authenticated;

create policy "Tout le monde voit les tables du café"
  on public.cafe_tables
  for select
  to anon, authenticated
  using (true);

-- Vue des spectateurs : la partie telle qu'on la voit autour de la table, sans aucune main.
create table public.room_watch_views (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  view jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.room_watch_views enable row level security;
revoke all on table public.room_watch_views from anon, authenticated;
grant select on table public.room_watch_views to anon, authenticated;

create policy "Tout le monde peut regarder une partie"
  on public.room_watch_views
  for select
  to anon, authenticated
  using (true);

alter publication supabase_realtime add table public.cafe_tables;
alter publication supabase_realtime add table public.room_watch_views;

-- Comme save_room, plus la table du café et la vue des spectateurs, dans la même transaction.
-- Renvoie 'ok', 'conflict' (code pris ou version dépassée) ou 'table_taken'.
create function public.save_room_v2(
  p_id uuid,
  p_code text,
  p_expected_version integer,
  p_data jsonb,
  p_views jsonb,
  p_table smallint,
  p_table_info jsonb,
  p_watch jsonb
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version integer;
  v_empty boolean := coalesce(jsonb_array_length(p_table_info -> 'players'), 0) = 0;
begin
  if p_expected_version is null then
    if p_table is not null then
      -- Un seul salon à la fois peut réserver une table donnée.
      perform pg_advisory_xact_lock(hashtext('cafe_table'), p_table);
      perform 1 from public.cafe_tables
      where table_number = p_table and updated_at >= now() - interval '30 minutes';
      if found then
        return 'table_taken';
      end if;
    end if;
    insert into public.rooms (id, code, version, data)
    values (p_id, p_code, 1, p_data)
    on conflict do nothing;
    if not found then
      return 'conflict';
    end if;
    v_version := 1;
    -- Ménage : les salons inactifs depuis 7 jours sont supprimés.
    delete from public.rooms where updated_at < now() - interval '7 days';
    if p_table is not null then
      insert into public.cafe_tables (table_number, room_id, info)
      values (p_table, p_id, p_table_info)
      on conflict (table_number) do update
        set room_id = excluded.room_id, info = excluded.info, updated_at = now();
    end if;
  else
    update public.rooms
    set data = p_data, version = p_expected_version + 1, updated_at = now()
    where id = p_id and version = p_expected_version;
    if not found then
      return 'conflict';
    end if;
    v_version := p_expected_version + 1;
    if p_table is not null then
      if v_empty then
        delete from public.cafe_tables where table_number = p_table and room_id = p_id;
      else
        update public.cafe_tables
        set info = p_table_info, updated_at = now()
        where table_number = p_table and room_id = p_id;
      end if;
    end if;
  end if;

  if p_watch is null or v_empty then
    delete from public.room_watch_views where room_id = p_id;
  else
    insert into public.room_watch_views (room_id, view)
    values (p_id, p_watch)
    on conflict (room_id) do update set view = excluded.view, updated_at = now();
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

  return 'ok';
end;
$$;

revoke execute on function public.save_room_v2(uuid, text, integer, jsonb, jsonb, smallint, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_room_v2(uuid, text, integer, jsonb, jsonb, smallint, jsonb, jsonb)
  to service_role;
