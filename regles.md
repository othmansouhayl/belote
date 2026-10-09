# Règles du jeu — Belote coinchée tunisienne

> Document de référence fonctionnel pour l'implémentation du jeu multijoueur web.
>
> **Variante ciblée :** belote coinchée tunisienne à 4 joueurs, en équipes de 2.
>
> **Important pour le développement :** les habitudes peuvent varier d'une table tunisienne à l'autre. Les règles marquées `À CONFIRMER` doivent être validées avant de figer le moteur de jeu. Les règles retenues ici ne doivent pas être remplacées silencieusement par celles de la belote française classique.

## 1. Objectif et vocabulaire

- Le jeu se joue à **4 joueurs**, répartis en **2 équipes de 2**.
- Les partenaires sont assis face à face.
- Les joueurs jouent chacun leur tour et tentent de remporter des plis.
- Une équipe prend un contrat pendant les enchères et doit le réussir.
- Les termes de l'interface et les noms des cartes sont en français.
- Les mots utilisés dans l'interface sont notamment : **donneur**, **preneur**, **défense**, **atout**, **pli**, **enchère**, **passer**, **coinche**, **surcoinche**, **capot**, **belote** et **rebelote**.

## 2. Cartes

Le jeu utilise 32 cartes :

- Couleurs : **Pique**, **Cœur**, **Carreau**, **Trèfle**.
- Valeurs : **7, 8, 9, 10, Valet, Dame, Roi, As**.

Chaque joueur reçoit 8 cartes, soit 32 cartes distribuées au total.

### 2.1 Ordre et valeur des cartes

À l'atout, l'ordre décroissant est :

1. Valet
2. 9
3. As
4. 10
5. Roi
6. Dame
7. 8
8. 7

Hors atout, l'ordre décroissant est :

1. As
2. 10
3. Roi
4. Dame
5. Valet
6. 9
7. 8
8. 7

Valeur des cartes à l'atout :

| Carte | Points |
|---|---:|
| Valet | 20 |
| 9 | 14 |
| As | 11 |
| 10 | 10 |
| Roi | 4 |
| Dame | 3 |
| 8 | 0 |
| 7 | 0 |

Valeur des cartes hors atout :

| Carte | Points |
|---|---:|
| As | 11 |
| 10 | 10 |
| Roi | 4 |
| Dame | 3 |
| Valet | 2 |
| 9 | 0 |
| 8 | 0 |
| 7 | 0 |

Le dernier pli rapporte **10 points supplémentaires** (« dix de der »).

Le total des points des cartes et du dernier pli est de **162 points**.

## 3. Préparation et distribution

1. Le système mélange les 32 cartes.
2. Le donneur est choisi aléatoirement pour la première manche.
3. Le donneur suivant tourne d'une place à chaque nouvelle manche, dans le sens défini par la table.
4. Chaque joueur reçoit 8 cartes.
5. La distribution se fait en **deux lots**. La taille des lots peut varier selon les habitudes de la table, par exemple :
   - 4 cartes puis 4 cartes ;
   - 1 carte puis 7 cartes ;
   - 6 cartes puis 2 cartes.
6. La distribution doit donner exactement 8 cartes à chacun et ne doit révéler aucune carte aux autres joueurs.
7. Une fois les cartes distribuées, les enchères commencent.

**Implémentation :** prévoir une fonction de distribution configurable qui accepte les différentes répartitions en deux lots. Une répartition doit être validée si les deux lots totalisent 8 cartes par joueur et si toutes les cartes sont distribuées une seule fois.

## 4. Ordre de parole

- Le premier joueur à parler pendant les enchères est le joueur placé **à droite du donneur**.
- Le jeu se déroule ensuite dans le sens choisi pour la table.
- Le joueur qui remporte un pli entame le pli suivant.
- Le sens de jeu doit rester constant pendant toute la partie.

`À CONFIRMER` : le sens exact de rotation doit être configurable et validé avec les joueurs visés. Ne pas déduire le sens de rotation du seul ordre de distribution.

## 5. Enchères

Chaque joueur peut annoncer un contrat ou passer.

### 5.1 Contrats autorisés

Les contrats ordinaires vont de **90 à 160 points**, par paliers de 10 :

- 90
- 100
- 110
- 120
- 130
- 140
- 150
- 160

Un contrat ordinaire doit préciser :
1. le nombre de points annoncé ;
2. la couleur d'atout choisie : Pique, Cœur, Carreau ou Trèfle.

Exemple : **« 100 Cœur »**.

L'enchère suivante doit être supérieure à la précédente. Le moteur ne doit pas autoriser une enchère inférieure ou égale au meilleur contrat actuel.

Le contrat **Capot** est également autorisé. Capot signifie que l'équipe preneuse s'engage à remporter les 8 plis.

La **Générale n'est pas autorisée** dans cette variante.

### 5.2 Passer

Un joueur qui ne souhaite pas enchérir peut passer.

Un joueur qui a passé ne doit pas être automatiquement exclu des actions ultérieures, sauf si la règle de table retenue l'impose. `À CONFIRMER` : déterminer si un joueur peut enchérir à nouveau après avoir passé.

### 5.3 Fin des enchères

Les enchères se terminent selon les règles suivantes :

- Après un contrat, si les trois autres joueurs passent successivement, le dernier contrat annoncé est retenu.
- Une coinche valide arrête les possibilités de surenchère, sauf si une règle locale explicite autorise la reprise des enchères.
- Une surcoinche met fin aux enchères.
- Si tous les joueurs passent sans contrat, la donne est annulée et redistribuée par le donneur suivant. `À CONFIRMER` : valider cette règle de table.

### 5.4 Réenchérir dans la même couleur

La possibilité de surenchérir dans la même couleur peut dépendre des habitudes de la table.

**Implémentation requise :** rendre cette règle configurable. Ne pas imposer arbitrairement une interdiction ou une autorisation universelle.

## 6. Coinche et surcoinche

### 6.1 Coinche

La coinche est une action disponible lorsqu'un contrat adverse a été annoncé et n'a pas encore été définitivement clôturé.

- Un joueur de l'équipe adverse peut annoncer **« Coinche »**.
- La coinche signifie que ce joueur estime que l'équipe preneuse ne réalisera pas son contrat.
- La coinche doit être proposée à un moment autorisé par le moteur, et non en dehors de la phase d'enchères.
- Dans cette variante, la coinche est disponible dès qu'un contrat adverse peut être contré.

### 6.2 Surcoinche

- Après une coinche, l'équipe preneuse peut annoncer **« Surcoinche »**.
- La surcoinche signifie que l'équipe preneuse maintient sa confiance dans le contrat.
- La surcoinche clôt la phase d'enchères.

### 6.3 Multiplicateurs

La convention de comptage doit être confirmée avant de finaliser le calcul des scores.

Valeurs couramment utilisées en coinche :
- Sans coinche : multiplicateur ×1.
- Coinche : multiplicateur ×2.
- Surcoinche : multiplicateur ×4.

**À CONFIRMER :** vérifier que la table tunisienne ciblée applique bien ×2 et ×4 et préciser exactement quelles composantes du score sont multipliées. Ne pas coder le calcul final comme définitif avant cette validation.

## 7. Jeu des cartes et règles de suivi

Une manche comprend 8 plis. Chaque pli contient une carte de chacun des 4 joueurs.

### 7.1 Entame

- Le premier joueur du premier pli est le joueur situé à droite du donneur.
- Il joue une carte de sa main.
- La couleur de cette carte devient la couleur demandée pour le pli.
- Le joueur suivant joue ensuite, puis les deux autres joueurs.

### 7.2 Fournir la couleur demandée

Si un joueur possède au moins une carte de la couleur demandée, il doit jouer une carte de cette couleur.

Le moteur doit vérifier cette obligation avant d'accepter une carte.

### 7.3 Jouer de l'atout si l'on ne peut pas fournir

Si le joueur ne possède aucune carte de la couleur demandée, il doit jouer de l'atout si la règle de coupe obligatoire est activée.

`À CONFIRMER` : vérifier que la coupe est obligatoire dans toutes les situations de la variante ciblée.

### 7.4 Surcouper

Si un joueur ne peut pas fournir la couleur demandée et que la coupe est obligatoire :

- si le pli contient déjà un atout adverse, le joueur doit surcouper s'il possède un atout supérieur, lorsque la règle de surcoupe obligatoire est activée ;
- s'il ne peut pas surcouper, il joue un atout inférieur s'il en possède un, ou une autre carte si la règle de table le permet.

`À CONFIRMER` : les obligations de couper, de monter à l'atout et de surcouper doivent être confirmées avec les joueurs. Les rendre configurables dans le moteur.

### 7.5 Gagner un pli

- Si aucune carte d'atout n'a été jouée, la carte la plus forte de la couleur demandée remporte le pli.
- Si au moins un atout a été joué, le plus fort atout du pli remporte le pli.
- Le gagnant du pli ramasse les quatre cartes.
- Le gagnant entame le pli suivant.

### 7.6 Fin de manche

Après le huitième pli :

1. Les points des cartes de chaque équipe sont additionnés.
2. L'équipe qui remporte le dernier pli reçoit les 10 points du dix de der.
3. Les bonus éventuels sont ajoutés selon les règles retenues.
4. Le moteur vérifie si le contrat est réussi ou chuté.
5. Les scores de manche sont ajoutés au score général.

## 8. Belote et rebelote

Si un joueur possède le Roi et la Dame d'atout :

- il annonce **« Belote »** lorsqu'il joue la première de ces deux cartes ;
- il annonce **« Rebelote »** lorsqu'il joue la seconde ;
- le bonus conventionnel est de 20 points.

`À CONFIRMER` : valider la manière d'annoncer la belote et la rebelote ainsi que le traitement des 20 points lorsque le contrat chute ou est coinché. Ce traitement varie selon les règlements.

## 9. Réussite et chute du contrat

### 9.1 Contrat ordinaire réussi

Le contrat est réussi si les conditions de réussite choisies par la table sont remplies.

Base recommandée à confirmer :
- l'équipe preneuse atteint le nombre de points annoncé ;
- elle réalise strictement plus de points que l'équipe adverse.

Les points de belote/rebelote et d'autres bonus doivent être traités selon le règlement retenu. Le moteur doit séparer :
- points de plis ;
- points de bonus ;
- seuil contractuel ;
- score de manche.

### 9.2 Contrat chuté

Le contrat chute si l'équipe preneuse ne remplit pas les conditions du contrat.

Le moteur doit attribuer les points à l'équipe gagnante de la donne selon la convention de comptage retenue.

**À CONFIRMER :** définir le calcul exact d'un contrat chuté, notamment si l'équipe défenderesse reçoit 160 points plus la valeur du contrat, et comment sont traités les bonus.

### 9.3 Capot

Capot signifie que l'équipe preneuse doit gagner les 8 plis.

- Si elle gagne les 8 plis, le capot est réussi.
- Si elle perd au moins un pli, le capot est chuté.

**À CONFIRMER :** fixer la valeur du capot, son calcul en cas de réussite ou de chute, et son traitement avec coinche/surcoinche.

## 10. Fin de partie

La partie se joue jusqu'à un objectif de score défini avant le début.

`À CONFIRMER` :
- score cible (par exemple 1 000 ou une autre valeur choisie par les joueurs) ;
- traitement d'une égalité ;
- possibilité de terminer dès qu'une équipe dépasse le score cible ou seulement à la fin d'une donne.

Le score cible doit être un paramètre de salon, avec une valeur par défaut documentée.

## 11. Règles de salon multijoueur

### 11.1 Création et accès

- Un joueur peut créer un salon privé.
- Le serveur génère un code de salon difficile à deviner.
- Les autres joueurs peuvent rejoindre avec le code ou le lien d'invitation.
- Une partie commence quand 4 joueurs sont présents et prêts.
- Chaque joueur choisit un pseudo.

### 11.2 Placement des joueurs

- Le serveur assigne les 4 places.
- Les partenaires occupent les places opposées.
- Les places restent stables pendant la manche.
- Le client ne doit pas décider lui-même de son équipe ou de sa position après le démarrage.

### 11.3 Autorité du serveur

Le serveur est la source de vérité pour :
- le mélange et la distribution ;
- les mains privées ;
- le joueur autorisé à jouer ;
- la validité des enchères ;
- la validité des cartes jouées ;
- le gagnant de chaque pli ;
- le calcul des points ;
- la fin de manche et le score général.

Le navigateur ne doit jamais être autorisé à déclarer lui-même qu'une carte est légale ou qu'une équipe a gagné.

### 11.4 Confidentialité des cartes

- Un joueur reçoit uniquement les cartes de sa propre main.
- Les autres mains ne doivent jamais être envoyées au navigateur de ce joueur.
- Le serveur peut conserver l'état complet de la partie, mais doit filtrer les données avant de les envoyer à chaque client.
- Les journaux et erreurs ne doivent pas révéler les cartes cachées.

### 11.5 Déconnexion

- Le serveur conserve l'état de la partie pendant une déconnexion temporaire.
- Un joueur peut rejoindre de nouveau son salon avec une identité de session sécurisée.
- Le serveur réenvoie uniquement les données autorisées à ce joueur.
- La durée d'attente avant de déclarer un joueur absent est configurable.

## 12. Exigences techniques pour le moteur

Le moteur de règles doit être indépendant de l'interface graphique.

Il doit exposer des fonctions testables, par exemple :

- `createGame(config)`
- `shuffleDeck(seed?)`
- `dealCards(deck, dealPattern)`
- `getLegalBids(state, playerId)`
- `validateBid(state, playerId, bid)`
- `validateCoinche(state, playerId)`
- `getLegalCards(state, playerId)`
- `validatePlay(state, playerId, cardId)`
- `resolveTrick(trick, trumpSuit)`
- `calculateHandPoints(state, scoringRules)`
- `resolveContract(state, scoringRules)`
- `applyHandScore(game, handResult)`

Ces noms sont indicatifs. Claude Code peut les adapter, mais les fonctions doivent rester déterministes et faciles à tester.

### Tests obligatoires

Prévoir des tests automatisés pour :

1. Vérifier qu'un paquet contient 32 cartes uniques.
2. Vérifier que chaque joueur reçoit exactement 8 cartes.
3. Vérifier qu'aucune carte n'est distribuée deux fois.
4. Vérifier que les enchères sont dans les valeurs autorisées.
5. Vérifier qu'une enchère ne peut pas être inférieure à la meilleure enchère actuelle.
6. Vérifier que seul le joueur attendu peut jouer.
7. Vérifier qu'un joueur doit fournir la couleur demandée lorsqu'il en possède.
8. Vérifier les obligations d'atout selon la configuration.
9. Vérifier le gagnant d'un pli à l'atout et hors atout.
10. Vérifier le total de 162 points de cartes et de dix de der.
11. Vérifier les contrats réussis et chutés.
12. Vérifier la coinche et la surcoinche selon la convention de score choisie.
13. Vérifier qu'un client ne reçoit jamais les cartes des autres joueurs.
14. Vérifier la reprise après déconnexion.

## 13. Paramètres de règles à centraliser

Ne pas disperser les règles variables dans le code. Les placer dans une configuration centrale, par exemple `rulesConfig.ts`.

Paramètres recommandés :

- `minimumBid: 90`
- `maximumBid: 160`
- `bidStep: 10`
- `allowCapot: true`
- `allowGenerale: false`
- `allowCoinche: true`
- `allowSurcoinche: true`
- `dealPatterns: [[4, 4], [1, 7], [6, 2]]`
- `requireTrumpWhenVoid: true` — à confirmer
- `requireOvertrump: true` — à confirmer
- `coincheMultiplier: 2` — à confirmer
- `surcoincheMultiplier: 4` — à confirmer
- `targetScore` — à définir
- `scoringMode` — à définir après validation du calcul tunisien

## 14. Questions à trancher avant la version définitive

Ne pas bloquer le développement de l'interface sur ces questions. Construire le moteur avec des paramètres configurables, puis demander confirmation au propriétaire du jeu.

1. **Sens du jeu :** dans quel sens les joueurs jouent-ils et dans quel sens le donneur distribue-t-il ?
2. **Enchères :** un joueur qui a passé peut-il enchérir plus tard ?
3. **Même couleur :** un partenaire peut-il surenchérir dans la même couleur ?
4. **Coupe :** faut-il couper obligatoirement si l'on ne possède pas la couleur demandée ?
5. **Surcoupe :** faut-il obligatoirement monter à l'atout si possible ?
6. **Score du contrat :** comment compter exactement les points quand le contrat est réussi ?
7. **Chute :** quel est le calcul exact lorsque le contrat échoue ?
8. **Coinche/surcoinche :** quels éléments sont multipliés, et la belote reste-t-elle acquise ?
9. **Capot :** quelle valeur attribuer au capot réussi ou chuté ?
10. **Fin de partie :** quel score cible et quelle règle en cas d'égalité ?

## 15. Instruction finale à Claude Code

Implémente le jeu à partir de ce fichier, mais respecte les consignes suivantes :

- Ne remplace pas cette variante par la belote classique.
- Ne crée pas de règle tunisienne supplémentaire sans validation.
- Centralise les règles variables dans une configuration.
- Écris les tests avant de considérer le moteur terminé.
- Signale clairement toute règle encore indéterminée.
- Toutes les cartes, commandes, messages et interfaces doivent être en français.
- La sécurité du serveur et le secret des mains sont prioritaires.
