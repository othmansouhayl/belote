# Questions en attente de validation

> Ce fichier liste toutes les règles marquées `À CONFIRMER` dans `regles.md`,
> plus les points explicitement demandés à clarifier. Pour chacune, une
> valeur par défaut raisonnable est déjà posée dans
> `src/engine/rulesConfig.ts` afin de ne pas bloquer le développement
> (conformément à la section 14 de `regles.md`). Rien ici n'est définitif :
> chaque ligne reste ouverte jusqu'à ta validation.
>
> Légende « Bloquant » : **Oui** = je te pose la question avant de coder car
> un mauvais choix changerait la portée ou l'architecture du moteur.
> **Non** = simple paramètre de configuration, facile à changer plus tard
> sans rien casser ; je pars sur la valeur par défaut en attendant ta réponse.

| # | Règle | Référence | Paramètre `rulesConfig.ts` | Valeur par défaut retenue | Question à trancher | Bloquant |
|---|---|---|---|---|---|---|
| 1 | Sens de rotation (parole et jeu) | §4 | `playDirection` | `'counterclockwise'` (sens anti-horaire, le plus courant) | Dans quel sens tournez-vous à votre table : vers la gauche (anti-horaire) ou vers la droite (horaire) ? | Non |
| 2 | Enchérir après avoir passé | §5.2, §14.2 | `allowRebidAfterPass` | `false` (un joueur qui a passé ne reparle plus pour cette donne) | Chez vous, un joueur qui a passé peut-il annoncer à nouveau plus tard dans la même donne ? | Non |
| 3 | Toutes les enchères passées sans contrat | §5.3 | `noBidRedeal` | `true` (la donne est annulée, le joueur suivant redistribue) | Confirmes-tu que si personne n'annonce, on redistribue (et pas, par ex., une donne à l'atout imposé) ? | Non |
| 4 | Surenchérir dans la même couleur que son partenaire | §5.4, §14.3 | `allowOverbidSameSuit` | `true` (autorisé) | Un partenaire peut-il monter l'enchère dans la couleur déjà annoncée par son coéquipier ? | Non |
| 5 | Coupe obligatoire si on ne peut pas fournir | §7.3, §14.4 | `requireTrumpWhenVoid` | `true` (on doit couper si on a de l'atout et pas la couleur demandée) | Confirmes-tu que couper est obligatoire dans toutes les situations ? | Non |
| 6 | Surcoupe obligatoire si possible | §7.4, §14.5 | `requireOvertrump` | `true` (il faut monter à l'atout si on en a un plus fort) | Confirmes-tu l'obligation de surcouper quand c'est possible ? | Non |
| 7 | **Surcoupe quand le partenaire est déjà maître du pli** | §7.4 (ajout demandé) | `requireOvertrumpWhenPartnerMaster` | `false` (si le partenaire tient déjà le pli avec l'atout le plus fort, pas besoin de monter par-dessus) | Doit-on surcouper même quand c'est le partenaire qui est déjà maître du pli, ou seulement quand c'est un adversaire ? | **Oui** |
| 8 | **Obligation de monter à l'atout quand l'atout est demandé** | §7.2/7.3 (ajout demandé) | `requireHigherTrumpWhenTrumpLed` | `true` (si l'atout est la couleur demandée et qu'on en a, on doit si possible jouer un atout plus fort que le meilleur atout déjà posé) | Quand l'atout est demandé, faut-il obligatoirement monter dessus si on le peut, ou juste fournir n'importe quel atout ? | **Oui** |
| 9 | Multiplicateurs coinche / surcoinche et éléments concernés | §6.3, §14.8 | `coincheMultiplier: 2`, `surcoincheMultiplier: 4` | ×2 / ×4, appliqués au score de la manche (points de plis + bonus), pas au score cible | Confirmes-tu ×2 et ×4, et que c'est bien le score de la manche entière qui est multiplié (pas seulement l'excédent) ? | Non |
| 10 | Belote/rebelote et traitement en cas de chute ou coinche | §8, §14.8 | `beloteAlwaysScored` | `true` (les 20 points de belote restent acquis au camp qui la détient, même si le contrat chute ou est coinché) | La belote reste-t-elle acquise même quand le contrat chute ? | Non |
| 11 | **Annonces complémentaires (tierce, cinquante, cent, carré)** | ajout demandé | `allowAnnonces` | `false` (désactivées — hors périmètre de la phase 1) | Joue-t-on avec des annonces de combinaisons (tierce/50/100/carré) à ta table, ou seulement la belote/rebelote ? | **Oui** |
| 12 | Calcul du contrat réussi | §9.1, §14.6 | `contractSuccessScoring` | L'équipe preneuse marque ses points de plis réalisés (+ dix de der + bonus), avec un minimum égal à la valeur annoncée ; l'équipe adverse marque ses points de plis réalisés | Est-ce bien ainsi que vous comptez un contrat réussi, ou arrondissez-vous (ex. au multiple de 10 supérieur) ? | Non |
| 13 | Calcul du contrat chuté | §9.2, §14.7 | `contractFailureScoring` | L'équipe adverse (défense) marque 160 + la valeur du contrat annoncé (hypothèse citée au §9.2) ; l'équipe preneuse marque 0 (hors belote, cf. #10) | Confirmes-tu « 160 + valeur du contrat » pour la défense en cas de chute (ou 162, ou un barème fixe) ? | Non |
| 14 | **Rang et valeur du capot dans les enchères** | §5.1, §9.3, §14.9 (ajout demandé) | `capotRank`, `capotFixedPoints` | Le capot est l'enchère la plus haute, juste au-dessus de 160, annonçable à tout moment (y compris en ouverture) ; s'il réussit, l'équipe preneuse marque un forfait fixe de 250 points ; s'il chute, la défense marque 250 points | Le capot doit-il être annoncé à un palier précis (ex. seulement après 160, ou remplace un montant) ? Quelle valeur en cas de réussite/chute : 250 fixes, ou 162+bonus comme un contrat normal ? | **Oui** |
| 15 | Score cible de fin de partie et égalité | §10, §14.10 | `targetScore`, `tieBreakRule` | `targetScore: 1000`, `tieBreakRule: 'extraHand'` (en cas d'égalité une fois la cible atteinte, on rejoue une donne de départage) ; la partie s'arrête à la fin de la donne qui atteint/dépasse la cible (pas en cours de donne) | 1000 points te convient comme valeur par défaut de salon (modifiable à la création) ? | Non |

## Pourquoi seulement 4 questions sont vraiment bloquantes

Les lignes marquées **Oui** changent la *portée* du moteur (faut-il construire
un système d'annonces de combinaisons ?) ou une mécanique de jeu visible à
chaque pli/enchère que les joueurs noteront immédiatement si elle est fausse
(surcoupe quand le partenaire est maître, obligation de monter à l'atout,
rang du capot). Toutes les autres lignes sont de simples booléens ou nombres
dans `rulesConfig.ts` : les changer plus tard ne demande aucune
réécriture du moteur, donc je pars sur leur valeur par défaut sans attendre.
