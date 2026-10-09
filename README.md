# Belote coinchée tunisienne

Jeu de belote coinchée tunisienne à 4, jouable dans le navigateur.

- `regles.md` : les règles de référence.
- `QUESTIONS.md` : les règles encore à confirmer et leur valeur par défaut.
- `src/engine/` : le moteur de règles (TypeScript pur, sans navigateur ni Node).
- `src/engine/rulesConfig.ts` : tous les paramètres de règles au même endroit.
- `src/bots/` : les bots simples (ils ne voient que leur main et les cartes jouées).
- `src/server/` : la logique des salons (création, places, statut « prêt », actions de jeu),
  exécutée côté serveur dans une Edge Function Supabase.
- `src/ui/` : l'interface React (accueil, salon, table de jeu).
- `supabase/` : schéma de la base, règles de sécurité (RLS) et fonction serveur `game`.
- `docs/SUPABASE.md` : les étapes à faire une seule fois sur le site de Supabase.

## Multijoueur : comment ça marche

1. Chaque navigateur reçoit une identité anonyme Supabase (aucun compte à créer).
2. Toutes les actions passent par la fonction serveur `game`, qui applique le moteur
   de règles. Le navigateur ne décide jamais seul qu'une carte est légale.
3. L'état complet d'un salon (dont les mains) reste dans la table `rooms`, inaccessible
   aux navigateurs. Chaque joueur reçoit en temps réel uniquement sa vue filtrée
   (table `player_views`, protégée par RLS).
4. En cas de coupure, le joueur rouvre le site : « Reprendre la partie » le replace
   à sa place avec sa main.

## Jouer

Le jeu est en ligne sur https://othmansouhayl.github.io/belote/ (mis à jour à chaque fusion dans `main`).

Astuce : ajoutez `?graine=mot` à l'adresse pour rejouer exactement la même donne
(pratique pour signaler un problème).

## Commandes

```bash
npm install         # installe les dépendances (une seule fois)
npm run dev         # lance le jeu sur http://localhost:5173
npm test            # lance les tests automatiques du moteur
npm run simulate    # 4 bots jouent 500 parties ; vérifie 162 points par manche
npm run simulate -- 2000 ma-graine   # 2000 parties avec une autre graine
npm run typecheck   # vérifie les types (et que le moteur reste indépendant)
npm run test:db     # vérifie le schéma et les règles de sécurité sur un Postgres local
```
