# Belote coinchée tunisienne

Jeu de belote coinchée tunisienne à 4, jouable dans le navigateur.

- `regles.md` : les règles de référence.
- `QUESTIONS.md` : les règles encore à confirmer et leur valeur par défaut.
- `src/engine/` : le moteur de règles (TypeScript pur, sans navigateur ni Node).
- `src/engine/rulesConfig.ts` : tous les paramètres de règles au même endroit.
- `src/bots/` : les bots simples (ils ne voient que leur main et les cartes jouées).
- `src/ui/` : l'interface React de la table de jeu.

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
```
