-- Imitation minimale de l'environnement Supabase pour tester la migration sur un Postgres local.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema realtime;
create table realtime.messages (id bigserial primary key, topic text not null, payload jsonb);
alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as
  $$ select current_setting('realtime.topic', true) $$;
grant usage on schema public, auth, realtime to anon, authenticated, service_role;
grant select, insert on realtime.messages to authenticated;
grant usage on sequence realtime.messages_id_seq to authenticated;
grant all on all tables in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
create publication supabase_realtime;
