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

-- Café Tarek : réserver une table, la voir sans le code, la protéger, la libérer.
\set salle '33333333-3333-4333-8333-333333333333'
\set autre '44444444-4444-4444-8444-444444444444'
set role service_role;
select public.save_room_v2(:'salle', 'CAF234', null, '{"secret":"main-cachee"}',
  jsonb_build_array(jsonb_build_object('player_id', :'a', 'seat', 0, 'view', '{"main":"A"}'::jsonb)),
  3::smallint, '{"players":[{"seat":0,"nickname":"Tarek"}]}', '{"spectateur":"public"}') as table_ok \gset
select public.save_room_v2(:'autre', 'CAF345', null, '{}', '[]',
  3::smallint, '{"players":[{"seat":0,"nickname":"Intrus"}]}', '{}') as table_prise \gset
reset role;
select :'table_ok' = 'ok' and :'table_prise' = 'table_taken' as reservation_ok \gset
\if :reservation_ok
\else
  \echo 'ÉCHEC : réservation de table (' :'table_ok' ', ' :'table_prise' ')'
  \quit 1
\endif
do $$ declare n int; begin
  select count(*) into n from public.rooms where id = '44444444-4444-4444-8444-444444444444';
  assert n = 0, 'le salon refusé ne doit pas être créé';
end $$;

-- Un inconnu, même non connecté, voit la table (sans rien de secret), mais pas la partie :
-- seuls les spectateurs inscrits la regardent.
set role anon;
do $$ declare t jsonb; begin
  select to_jsonb(c) into t from public.cafe_tables c where table_number = 3;
  assert t -> 'info' -> 'players' -> 0 ->> 'nickname' = 'Tarek', 'anon devrait voir les pseudos de la table';
  assert t::text not like '%CAF234%' and t::text not like '%main-cachee%', 'la table ne doit révéler ni code ni état';
  begin perform * from public.room_watch_views; raise exception 'ÉCHEC : anon lit la partie';
  exception when insufficient_privilege then null; end;
  begin update public.cafe_tables set info = '{}'; raise exception 'ÉCHEC : table du café modifiable';
  exception when insufficient_privilege then null; end;
  begin insert into public.room_watch_views values ('33333333-3333-4333-8333-333333333333', '{}');
    raise exception 'ÉCHEC : vue spectateur modifiable';
  exception when insufficient_privilege then null; end;
  begin perform public.save_room_v2(null, null, null, null, null, null, null, null);
    raise exception 'ÉCHEC : save_room_v2 appelable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Le dernier joueur quitte le salon d'attente : la table et la vue spectateur disparaissent.
set role service_role;
select public.save_room_v2(:'salle', 'CAF234', 1, '{}', '[]', 3::smallint, '{"players":[]}', '{}') as liberee \gset
reset role;
do $$ declare n int; begin
  select count(*) into n from public.cafe_tables;
  assert n = 0, 'la table devrait être libérée';
  select count(*) into n from public.room_watch_views;
  assert n = 0, 'la vue spectateur devrait être supprimée';
end $$;

-- Une table abandonnée depuis plus de 10 minutes peut être reprise.
set role service_role;
select public.save_room_v2(:'autre', 'CAF345', null, '{}', '[]',
  4::smallint, '{"players":[{"seat":0,"nickname":"Ancien"}]}', '{}') as t4 \gset
update public.cafe_tables set updated_at = now() - interval '11 minutes' where table_number = 4;
select public.save_room_v2('55555555-5555-4555-8555-555555555555', 'CAF456', null, '{}', '[]',
  4::smallint, '{"players":[{"seat":0,"nickname":"Nouveau"}]}', '{}') as reprise \gset
reset role;
select :'liberee' = 'ok' and :'reprise' = 'ok' as reprise_ok \gset
\if :reprise_ok
\else
  \echo 'ÉCHEC : une table abandonnée devrait pouvoir être reprise'
  \quit 1
\endif

-- Une partie finie libère la table aussitôt ; la revanche ne reprend pas une table déjà reprise.
set role service_role;
select public.save_room_v2('55555555-5555-4555-8555-555555555555', 'CAF456', 1, '{}', '[]',
  4::smallint, '{"status":"finished","players":[{"seat":0,"nickname":"Nouveau"}]}', '{}') as finie \gset
select public.save_room_v2('66666666-6666-4666-8666-666666666666', 'CAF567', null, '{}', '[]',
  4::smallint, '{"status":"lobby","players":[{"seat":0,"nickname":"Suivant"}]}', '{}') as suivante \gset
select public.save_room_v2('55555555-5555-4555-8555-555555555555', 'CAF456', 2, '{}', '[]',
  4::smallint, '{"status":"playing","players":[{"seat":0,"nickname":"Nouveau"}]}', '{}') as revanche \gset
reset role;
select :'finie' = 'ok' and :'suivante' = 'ok' and :'revanche' = 'ok' as finie_ok \gset
\if :finie_ok
\else
  \echo 'ÉCHEC : une table dont la partie est finie devrait être libre (' :'finie' ', ' :'suivante' ', ' :'revanche' ')'
  \quit 1
\endif
do $$ declare nick text; begin
  select info -> 'players' -> 0 ->> 'nickname' into nick from public.cafe_tables where table_number = 4;
  assert nick = 'Suivant', 'la table reprise doit rester aux nouveaux joueurs, pas à la revanche';
end $$;

-- Sans personne pour la prendre, la revanche garde sa table.
set role service_role;
select public.save_room_v2('66666666-6666-4666-8666-666666666666', 'CAF567', 1, '{}', '[]',
  4::smallint, '{"status":"finished","players":[{"seat":0,"nickname":"Suivant"}]}', '{}') as finie2 \gset
select public.save_room_v2('66666666-6666-4666-8666-666666666666', 'CAF567', 2, '{}', '[]',
  4::smallint, '{"status":"playing","players":[{"seat":0,"nickname":"Suivant"}]}', '{}') as revanche2 \gset
reset role;
do $$ declare st text; begin
  select info ->> 'status' into st from public.cafe_tables where table_number = 4;
  assert st = 'playing', 'la revanche devrait reprendre sa propre table';
end $$;

-- Spectateurs : le serveur inscrit S1 (peut écouter) et S2 (regarder seulement) à une table.
\set spec '77777777-7777-4777-8777-777777777777'
\set s1 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1'
\set s2 'e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2'
set role service_role;
select public.save_room_v3(:'spec', 'SPE234', null, '{"secret":"main-cachee"}',
  jsonb_build_array(jsonb_build_object('player_id', :'a', 'seat', 0, 'view', '{"main":"A"}'::jsonb)),
  5::smallint, '{"players":[{"seat":0,"nickname":"Tarek"}]}', '{"partie":"visible"}',
  jsonb_build_array(
    jsonb_build_object('user_id', :'s1', 'name', 'Sami', 'can_listen', true),
    jsonb_build_object('user_id', :'s2', 'name', 'Mounir', 'can_listen', false)
  )) as spectateurs \gset
reset role;
select :'spectateurs' = 'ok' as spectateurs_ok \gset
\if :spectateurs_ok
\else
  \echo 'ÉCHEC : inscription des spectateurs (' :'spectateurs' ')'
  \quit 1
\endif

set role authenticated;
-- S2 regarde la partie, mais n'entre pas dans le canal d'écoute.
select set_config('request.jwt.claim.sub', :'s2', false);
select set_config('realtime.topic', 'ecoute:' || :'spec', false);
do $$ declare n int; begin
  select count(*) into n from public.room_watch_views where room_id = '77777777-7777-4777-8777-777777777777';
  assert n = 1, 'S2 inscrit devrait voir la partie';
  begin
    insert into realtime.messages (topic, payload) values ('ecoute:77777777-7777-4777-8777-777777777777', '{}');
    raise exception 'ÉCHEC : S2 (regarder seulement) a écrit sur le canal d''écoute';
  exception when insufficient_privilege then null; end;
  begin perform * from public.room_spectators; raise exception 'ÉCHEC : liste des spectateurs lisible';
  exception when insufficient_privilege then null; end;
  begin perform public.save_room_v3(null, null, null, null, null, null, null, null, null);
    raise exception 'ÉCHEC : save_room_v3 appelable';
  exception when insufficient_privilege then null; end;
end $$;

-- S1 regarde et rejoint le canal d'écoute ; un joueur (A) aussi.
select set_config('request.jwt.claim.sub', :'s1', false);
insert into realtime.messages (topic, payload) values ('ecoute:' || :'spec', '{"type":"listen-hello"}');
do $$ declare n int; begin
  select count(*) into n from public.room_watch_views where room_id = '77777777-7777-4777-8777-777777777777';
  assert n = 1, 'S1 inscrit devrait voir la partie';
  select count(*) into n from realtime.messages where topic like 'ecoute:%';
  assert n = 1, 'S1 devrait lire le canal d''écoute';
end $$;
select set_config('request.jwt.claim.sub', :'a', false);
insert into realtime.messages (topic, payload) values ('ecoute:' || :'spec', '{"type":"player-hello"}');

-- Mais un auditeur n'entre jamais dans le canal des joueurs.
select set_config('request.jwt.claim.sub', :'s1', false);
select set_config('realtime.topic', 'salon:' || :'spec', false);
do $$ declare n int; begin
  select count(*) into n from realtime.messages;
  assert n = 0, 'un auditeur ne devrait rien lire du canal des joueurs';
  begin
    insert into realtime.messages (topic, payload) values ('salon:77777777-7777-4777-8777-777777777777', '{}');
    raise exception 'ÉCHEC : un auditeur a écrit sur le canal des joueurs';
  exception when insufficient_privilege then null; end;
end $$;

-- Un inconnu (D) ne voit pas la partie et n'entre pas dans le canal d'écoute.
select set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', false);
select set_config('realtime.topic', 'ecoute:' || :'spec', false);
do $$ declare n int; begin
  select count(*) into n from public.room_watch_views;
  assert n = 0, 'un inconnu ne devrait voir aucune partie';
  select count(*) into n from realtime.messages;
  assert n = 0, 'un inconnu ne devrait rien lire du canal d''écoute';
  begin
    insert into realtime.messages (topic, payload) values ('ecoute:77777777-7777-4777-8777-777777777777', '{}');
    raise exception 'ÉCHEC : un inconnu a écrit sur le canal d''écoute';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Le créateur refuse les spectateurs : plus de partie publiée, plus d'inscrits.
set role service_role;
select public.save_room_v3(:'spec', 'SPE234', 1, '{}',
  jsonb_build_array(jsonb_build_object('player_id', :'a', 'seat', 0, 'view', '{"main":"A"}'::jsonb)),
  5::smallint, '{"players":[{"seat":0,"nickname":"Tarek"}]}', null, '[]') as refuses \gset
reset role;
do $$ declare n int; begin
  select count(*) into n from public.room_spectators;
  assert n = 0, 'les spectateurs devraient être désinscrits';
  select count(*) into n from public.room_watch_views where room_id = '77777777-7777-4777-8777-777777777777';
  assert n = 0, 'la partie ne devrait plus être publiée';
end $$;

\o
\echo 'Toutes les vérifications de sécurité de la base sont passées.'
