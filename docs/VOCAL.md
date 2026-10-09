# Le vocal : fonctionnement et serveur TURN

## Comment ça marche

- Chaque joueur qui appuie sur **Vocal** se connecte directement aux autres joueurs
  du salon qui ont aussi activé le vocal (WebRTC « en maillage » : 3 connexions par
  joueur à 4). Le son ne passe pas par Supabase.
- Pour trouver le chemin entre deux téléphones, le navigateur utilise :
  - un serveur **STUN** (gratuit, déjà configuré : Cloudflare et Google). Il suffit
    dans la plupart des cas, en Wi-Fi notamment ;
  - un serveur **TURN** quand la connexion directe est impossible (certains réseaux
    4G/5G, réseaux d'entreprise ou d'hôtel). Le son est alors relayé par ce serveur.
- Sans TURN, le vocal marche pour la plupart des joueurs, mais il peut rester
  silencieux entre deux joueurs sur certains réseaux mobiles. **Ajouter un TURN est
  recommandé** pour jouer entre pays différents.
- Les identifiants TURN restent secrets : ils sont gardés dans Supabase et donnés
  uniquement aux membres d'un salon, au moment où ils activent le vocal.

## Option recommandée : Cloudflare (1 000 Go gratuits par mois)

Une heure de vocal relayé consomme environ 0,1 Go par joueur : la limite gratuite est
très largement suffisante.

> Les menus de Cloudflare changent parfois de nom. Si un écran ne correspond pas,
> cherche « TURN » dans le tableau de bord ou envoie-moi une capture.

1. Crée un compte gratuit sur https://dash.cloudflare.com/sign-up (aucun site web à
   ajouter, aucune carte bancaire normalement demandée pour ce service).
2. Dans le menu de gauche, ouvre **Realtime** (parfois appelé **Calls**), puis
   **TURN Server**.
3. Clique sur **Create** (ou **Create TURN Key**), nomme-le `belote`.
4. Cloudflare affiche deux valeurs : le **Turn Token ID** (ou Key ID) et l'**API
   Token**. Copie-les tout de suite (le second n'est plus affiché ensuite).
5. Sur GitHub : **Settings** → **Secrets and variables** → **Actions** → onglet
   **Secrets** → **New repository secret**, deux fois :

   | Nom | Valeur |
   |---|---|
   | `CLOUDFLARE_TURN_KEY_ID` | le Turn Token ID |
   | `CLOUDFLARE_TURN_API_TOKEN` | l'API Token |

6. Onglet **Actions** de GitHub → **Déploiement Supabase** → **Run workflow**.
   Les identifiants sont alors envoyés dans les secrets de Supabase.

## Autre option : Metered « Open Relay » (20 Go gratuits par mois)

1. Crée un compte sur https://www.metered.ca/tools/openrelay/ et crée une
   application TURN.
2. Récupère les **URLs** du serveur (par exemple `turn:...:80`, `turn:...:443`,
   `turns:...:443`), le **username** et le **credential**.
3. Sur GitHub, crée trois secrets :

   | Nom | Valeur |
   |---|---|
   | `TURN_URLS` | les URLs séparées par des virgules |
   | `TURN_USERNAME` | le username |
   | `TURN_CREDENTIAL` | le credential |

4. Relance **Déploiement Supabase** comme ci-dessus.

Si les deux options sont configurées, Cloudflare est utilisé.

## Conseils pour les joueurs (surtout sur iPhone)

- **Autorisation du micro** : Safari la demande au premier appui sur **Vocal**.
  Si elle a été refusée : bouton **aA** dans la barre d'adresse → **Réglages du site
  web** → **Micro** → **Autoriser**, puis recharger la page. Sans micro, on peut
  quand même écouter les autres.
- **Écouteurs recommandés** : ils évitent l'écho et les coupures quand plusieurs
  personnes parlent.
- **Écran verrouillé ou appel téléphonique** : iOS coupe le micro. En revenant dans
  le jeu, touche **Réactiver le micro**.
- **Pas de son ?** Si le bouton **Activer le son** apparaît, touche-le : le
  téléphone exige un appui avant de jouer du son.
- **Micro coupé** : le bouton rouge indique que les autres ne t'entendent plus ;
  l'icône barrée à côté d'un nom signale un joueur qui a coupé son micro.
- Un contour **vert** autour d'un nom indique la personne qui parle.
