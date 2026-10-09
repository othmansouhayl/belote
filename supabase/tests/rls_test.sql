-- Vérifie les règles de sécurité : à lancer après supabase_stubs.sql et les migrations.
\set ON_ERROR_STOP on
\o /dev/null
\set room '11111111-1111-4111-8111-111111111111'
\set a 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set b 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set c 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

-- Le serveur (service_role) crée le salon avec deux vues.
set role service_role;
select public.save_room(:'room', 'ABC234', null, '{"secret":"main-cachee"}',
  jsonb_build_array(
    jsonb_build_object('player_id', :'a', 'seat', 0, 'view', '{"main":"A"}'::jsonb),
    jsonb_build_object('player_id', :'b', 'seat', 1, 'view', '{"main":"B"}'::jsonb)
  )) as cree \gset
\if :cree
\else
  \echo 'ÉCHEC : création du salon'
  \quit 1
\endif

-- Un code déjà pris est refusé.
select public.save_room('22222222-2222-4222-8222-222222222222', 'ABC234', null, '{}', '[]') as doublon \gset
\if :doublon
  \echo 'ÉCHEC : code en double accepté'
  \quit 1
\endif

-- Contrôle de version : une mauvaise version est refusée, la bonne acceptée.
select public.save_room(:'room', 'ABC234', 5, '{}', '[]') as mauvaise_version \gset
\if :mauvaise_version
  \echo 'ÉCHEC : version incorrecte acceptée'
  \quit 1
\endif
select public.save_room(:'room', 'ABC234', 1, '{"secret":"main-cachee"}',
  jsonb_build_array(
    jsonb_build_object('player_id', :'a', 'seat', 0, 'view', '{"main":"A2"}'::jsonb),
    jsonb_build_object('player_id', :'b', 'seat', 1, 'view', '{"main":"B2"}'::jsonb),
    jsonb_build_object('player_id', :'c', 'seat', 2, 'view', '{"main":"C2"}'::jsonb)
  )) as bonne_version \gset
\if :bonne_version
\else
  \echo 'ÉCHEC : bonne version refusée'
  \quit 1
\endif
reset role;

-- Le joueur A (authentifié) ne voit que sa propre vue.
set role authenticated;
select set_config('request.jwt.claim.sub', :'a', false);
do $$
declare n int; v jsonb;
begin
  select count(*) into n from public.player_views;
  assert n = 1, 'A devrait voir exactement 1 vue, en voit ' || n;
  select view into v from public.player_views;
  assert v ->> 'main' = 'A2', 'A ne voit pas sa propre vue à jour';
end $$;

-- A ne peut ni lire l'état complet, ni écrire, ni appeler la fonction du serveur.
do $$ begin
  begin perform * from public.rooms; raise exception 'ÉCHEC : rooms lisible';
  exception when insufficient_privilege then null; end;
  begin insert into public.player_views values ('11111111-1111-4111-8111-111111111111', (select auth.uid()), 0, 1, '{}');
    raise exception 'ÉCHEC : insertion permise';
  exception when insufficient_privilege then null; end;
  begin update public.player_views set view = '{}'; raise exception 'ÉCHEC : modification permise';
  exception when insufficient_privilege then null; end;
  begin perform public.save_room('11111111-1111-4111-8111-111111111111', 'ABC234', 2, '{}', '[]');
    raise exception 'ÉCHEC : save_room appelable';
  exception when insufficient_privilege then null; end;
end $$;

-- Canal temps réel du salon : A (membre) peut écouter et écrire.
select set_config('realtime.topic', 'salon:' || :'room', false);
do $$ begin assert public.is_room_member('11111111-1111-4111-8111-111111111111'), 'A devrait être membre'; end $$;
insert into realtime.messages (topic, payload) values ('salon:11111111-1111-4111-8111-111111111111', '{"type":"presence"}');
do $$ declare n int; begin
  select count(*) into n from realtime.messages;
  assert n = 1, 'A devrait lire le message du canal';
end $$;

-- Un inconnu (D) ne voit aucune vue et ne peut ni écouter ni écrire sur le canal.
select set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', false);
do $$ declare n int; begin
  select count(*) into n from public.player_views;
  assert n = 0, 'un inconnu ne devrait voir aucune vue';
  select count(*) into n from realtime.messages;
  assert n = 0, 'un inconnu ne devrait lire aucun message du canal';
  begin
    insert into realtime.messages (topic, payload) values ('salon:11111111-1111-4111-8111-111111111111', '{}');
    raise exception 'ÉCHEC : un inconnu a écrit sur le canal';
  exception when insufficient_privilege then null; end;
end $$;

-- Un sujet de canal mal formé n'ouvre aucun accès.
select set_config('request.jwt.claim.sub', :'a', false);
select set_config('realtime.topic', 'salon:pas-un-uuid', false);
do $$ declare n int; begin
  select count(*) into n from realtime.messages;
  assert n = 0, 'un canal mal formé ne devrait rien révéler';
end $$;
reset role;

-- Les navigateurs non connectés (anon) n'ont accès à rien.
set role anon;
do $$ begin
  begin perform * from public.player_views; raise exception 'ÉCHEC : anon lit les vues';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Un joueur retiré du salon perd sa vue.
set role service_role;
select public.save_room(:'room', 'ABC234', 2, '{}',
  jsonb_build_array(jsonb_build_object('player_id', :'a', 'seat', 0, 'view', '{"main":"A3"}'::jsonb))) as retrait \gset
reset role;
do $$ declare n int; begin
  select count(*) into n from public.player_views;
  assert n = 1, 'seule la vue de A devrait rester';
end $$;

\o
\echo 'Toutes les vérifications de sécurité de la base sont passées.'
