# Mise en place de Supabase (à faire une seule fois)

Ce guide décrit tout ce que tu dois faire toi-même pour que le multijoueur
fonctionne. Tout est gratuit (offre « Free » de Supabase).

> Les menus de Supabase changent parfois de nom. Si un écran ne correspond pas
> exactement, cherche le mot en gras dans la page ou envoie-moi une capture.

## Étape 1 — Créer le projet Supabase

1. Va sur https://supabase.com et clique sur **Start your project**.
   Connecte-toi avec ton compte GitHub (le plus simple).
2. Clique sur **New project**.
   - **Organization** : celle proposée par défaut (crée-la si on te le demande, plan **Free**).
   - **Project name** : `belote`.
   - **Database password** : clique sur **Generate a password**, puis **copie-le
     et garde-le précieusement** (gestionnaire de mots de passe ou note privée).
     Il servira à l'étape 4.
   - **Region** : choisis une région européenne proche de vous tous
     (par exemple **West EU (Paris)** ou **Central EU (Frankfurt)**).
3. Clique sur **Create new project** et attends 1 à 2 minutes.

## Étape 2 — Autoriser la connexion anonyme

Les joueurs n'ont pas besoin de créer de compte : chaque navigateur reçoit une
identité anonyme et sécurisée, qui permet aussi de revenir dans la partie après
une coupure.

1. Dans le menu de gauche : **Authentication**.
2. Ouvre **Sign In / Providers** (parfois appelé **Providers** ou **Settings**).
3. Active l'interrupteur **Allow anonymous sign-ins** (« Autoriser les
   connexions anonymes »).
4. Clique sur **Save** si un bouton d'enregistrement apparaît.

## Étape 3 — Récupérer trois informations

1. Menu de gauche, tout en bas : **Project Settings** (roue dentée).
2. Dans **General** : copie le **Project ID** (une suite de lettres, par exemple
   `abcdefghijklmnopqrst`).
3. Dans **API Keys** (ou **Data API**) :
   - copie l'**URL du projet** (`https://abcdefghijklmnopqrst.supabase.co`) ;
   - copie la clé **publishable** (elle commence par `sb_publishable_`). Si tu ne
     vois que des clés « legacy », copie la clé **anon public** (elle commence
     par `eyJ`).
   - **Ne copie jamais** la clé **secret** ni **service_role** : on n'en a pas besoin.
4. Crée un jeton d'accès pour GitHub : clique sur ton avatar en haut à droite →
   **Account preferences** → **Access Tokens** → **Generate new token**.
   Nom : `github-belote`. Copie le jeton (il ne sera plus affiché ensuite).

## Étape 4 — Donner ces informations à GitHub

Sur GitHub, dans ton dépôt `belote` : **Settings** → **Secrets and variables** →
**Actions**.

Onglet **Secrets** → **New repository secret** (deux fois) :

| Nom | Valeur |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | le jeton créé à l'étape 3.4 |
| `SUPABASE_DB_PASSWORD` | le mot de passe de la base (étape 1) |

Onglet **Variables** → **New repository variable** (trois fois) :

| Nom | Valeur |
|---|---|
| `SUPABASE_PROJECT_ID` | le Project ID (étape 3.2) |
| `VITE_SUPABASE_URL` | l'URL du projet (étape 3.3) |
| `VITE_SUPABASE_ANON_KEY` | la clé publishable ou anon (étape 3.3) |

Les deux premières sont des **secrets** (personne ne pourra les relire, pas
même toi). Les trois dernières ne sont pas secrètes : la clé publishable est
faite pour être visible dans le site.

## Étape 5 — Lancer le premier déploiement

Rien à faire : à la prochaine fusion dans `main`, GitHub Actions crée
automatiquement les tables, les règles de sécurité et la fonction serveur dans
Supabase, puis met le site à jour.

Pour relancer à la main : onglet **Actions** de GitHub → **Déploiement Supabase**
→ **Run workflow**.

## À savoir sur l'offre gratuite

- **Mise en pause** : un projet gratuit inutilisé pendant 7 jours est mis en
  pause. Si le multijoueur ne répond plus après une longue période sans jouer,
  ouvre le tableau de bord Supabase et clique sur **Restore project**
  (1 à 2 minutes).
- **Limites** : largement suffisantes pour quelques parties entre amis.
