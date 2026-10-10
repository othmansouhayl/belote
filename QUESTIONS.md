# Questions en attente de validation

> Ce fichier liste toutes les règles marquées `À CONFIRMER` dans `regles.md`,
> plus les points explicitement demandés à clarifier. Pour chacune, une
> valeur par défaut raisonnable est posée dans `src/engine/rulesConfig.ts`
> afin de ne pas bloquer le développement (section 14 de `regles.md`).
>
> Statut : **Validé** = tranché par le propriétaire du jeu, la valeur est
> définitive. **Ouvert** = valeur par défaut provisoire, simple paramètre
> facile à changer plus tard sans réécrire le moteur.

## Règles validées

| # | Règle | Référence | Paramètre `rulesConfig.ts` | Valeur retenue | Statut |
|---|---|---|---|---|---|
| 2 | Enchérir après avoir passé | §5.2 | `allowRebidAfterPass` | `true` : un joueur qui a passé peut encore annoncer plus tard dans la même donne (et toujours coincher) | **Validé** |
| 4 | Surenchérir sur son partenaire | §5.4 | `allowOverbidSameSuit` | `true` : après « 90 ♥ » de son partenaire, on peut annoncer « 100 ♥ » ou « 100 » dans une autre couleur | **Validé** |
| 7 | Couper / surcouper quand le partenaire est déjà maître du pli | §7.4 | `requireTrumpWhenPartnerMaster` | `false` : si le partenaire tient le pli, on joue la carte qu'on veut (aucune obligation de couper ni de surcouper) | **Validé** |
| 8 | Monter à l'atout quand l'atout est demandé | §7.2 | `requireHigherTrumpWhenTrumpLed` | `true` : si l'atout est demandé et qu'on a un atout plus fort que le meilleur déjà posé, on doit le jouer | **Validé** |
| 9 | Coinche / surcoinche | §6.3, §9 | `coincheMultiplier`, `surcoincheMultiplier`, `coinchedSuccessScoring` | ×2 / ×4. Contrat coinché **réussi** : le preneur marque 160 × 2 = **320** (surcoinché : **640**), la défense 0. Contrat coinché **chuté** : la défense marque 320 (surcoinché : 640), le preneur 0 | **Validé** |
| 10 | Belote | §8 | `beloteOnFailure`, `beloteOnCoinchedSuccess`, `beloteAlwaysScored`, `beloteCountsForContract` | Annonce automatique (« Belote » puis « Rebelote »). 20 points jamais multipliés. Contrat **chuté** (capot compris) : les 20 points vont à la **défense**, quel que soit le joueur qui a la belote, même si elle n'a pas encore été jouée (ex. 320 + 20 = 340 coinché, 640 + 20 = 660 surcoinché). Contrat coinché réussi : ils vont au preneur (« chute à l'envers »). Contrat réussi sans coinche : ils restent à celui qui la détient. Ils comptent pour atteindre le contrat | **Validé** |
| 10 bis | Dix de der | §7.6 | `lastTrickBonus` | L'équipe qui gagne le dernier pli marque 10 points de plus (152 points de cartes + 10 = 162 par donne) | **Validé** |
| 11 | Annonces de combinaisons (tierce, cinquante, cent, carré) | — | `allowAnnonces` | `false` : pas d'annonces, seule la belote/rebelote compte | **Validé** |
| 12 | Calcul du contrat réussi | §9.1 | `contractSuccessScoring` | `'realizedPoints'` : réussi si le preneur atteint la valeur annoncée ET fait strictement plus de points que la défense. Le preneur marque **les points qu'il a réellement faits** (ex. 90 annoncé, 120 faits → 120), la défense marque les siens. Capot non annoncé : 250 (cf. #14). Pas d'arrondi à la dizaine | **Validé** |
| 13 | Calcul du contrat chuté | §9.2 | `failedContractBasePoints`, `failedContractScoring` | Contrat de 90 à 160 chuté : la défense marque **160** (× coinche / surcoinche), le preneur 0 | **Validé** |
| 14 | Valeur du capot | §9.3 | `capotAnnouncedSuccessPoints`, `capotAnnouncedFailurePoints`, `capotUnannouncedPoints` | Capot **annoncé** réussi : 500 pour le preneur. Capot **annoncé** chuté : 500 pour l'adverse. Capot **non annoncé** (contrat ordinaire où le preneur fait les 8 plis) : 250 pour le preneur | **Validé** |
| 25 | Cartes étalées (« تي إفرش عاد ») | — | — (règle du moteur) | Quand c'est à lui d'entamer et que toutes ses cartes sont maîtresses d'après les cartes déjà jouées (sans regarder les mains des autres), un bouton « تي إفرش عاد » apparaît. En l'appuyant, il montre ses cartes, son équipe remporte tous les plis restants (points des cartes + dix de der) et la manche s'arrête. Les bots le font aussi | **Validé** |
| 26 | Capot annoncé chuté (« يروووووووح ») | §9.3 | — (règle du moteur) | Dès que la défense gagne un pli, « يروووووووح » s'affiche, les cartes restantes sont ramassées (pour la défense) et la manche s'arrête | **Validé** |
| 27 | Carte unique | — | — (interface) | Quand un joueur n'a qu'une seule carte jouable, elle est jouée automatiquement après une demi-seconde | **Validé** |
| 15 | Score cible de la partie | §10 | `targetScore` | 1500 points (la partie se termine à la fin de la donne qui fait atteindre ou dépasser 1500) | **Validé** |

## Règles encore ouvertes

> Plusieurs de ces règles peuvent désormais être choisies par l'hôte de chaque salon
> (« Réglages de la partie ») : score à atteindre, calcul du contrat réussi (#12),
> reparler après avoir passé (#2), monter dans la couleur du partenaire (#4),
> sous-couper (#19), belote de la défense sur un contrat réussi (#10), capot multiplié (#17) et délai
> « hors ligne » (#22). Les valeurs ci-dessous restent celles proposées par défaut.

| # | Règle | Référence | Paramètre `rulesConfig.ts` | Valeur par défaut | Question à trancher | Statut |
|---|---|---|---|---|---|---|
| 1 | Sens de rotation (parole et jeu) | §4 | `playDirection` | `'counterclockwise'` (anti-horaire : après le donneur, c'est le joueur à sa droite) | Dans quel sens tournez-vous : anti-horaire ou horaire ? | Ouvert |
| 3 | Tout le monde passe sans contrat | §5.3 | `noBidRedeal` | `true` (donne annulée, le donneur suivant redistribue) | Confirmes-tu la redistribution ? | Ouvert |
| 5 | Coupe obligatoire quand on ne peut pas fournir | §7.3 | `requireTrumpWhenVoid` | `true` (sauf partenaire maître, cf. #7) | La coupe est-elle obligatoire dans toutes les autres situations ? | Ouvert |
| 6 | Surcoupe obligatoire sur un atout adverse | §7.4 | `requireOvertrump` | `true` | Faut-il surcouper un adversaire quand c'est possible ? | Ouvert |
| 16 | Rang du capot dans les enchères | §5.1 | `capotRank` | Enchère la plus haute, au-dessus de 160, annonçable à tout moment (y compris en ouverture) | Le capot peut-il être annoncé à tout moment, ou seulement après une certaine enchère ? | Ouvert |
| 17 | Capot et coinche / surcoinche | §9.3 | `capotMultiplied` | `true` (les 500 ou 250 sont multipliés par ×2 ou ×4) | Le capot est-il multiplié en cas de coinche ou de surcoinche ? | Ouvert |
| 18 | Capot non annoncé fait par la défense | §9.3 | — (règle du moteur) | Pas de bonus particulier : c'est une chute normale (160 + contrat pour la défense) | Si la défense fait les 8 plis, a-t-elle droit à un bonus ? | Ouvert |
| 19 | Sous-couper quand on ne peut pas surcouper | §7.4 | `requireUndertrump` | `true` : si un adversaire a coupé plus fort que tous vos atouts, vous devez quand même jouer un atout (plus faible) | Quand on ne peut pas surcouper, doit-on quand même jouer un atout, ou peut-on se défausser ? | Ouvert |
| 20 | Moment de la coinche | §6.1 | — (règle du moteur) | On ne peut coincher qu'à son tour de parole. Les deux défenseurs ont toujours un tour avant la fin des enchères. Un joueur qui a passé peut encore coincher | Chez vous, peut-on coincher à tout moment, même hors de son tour ? | Ouvert |
| 21 | Qui peut surcoincher | §6.2 | — (règle du moteur) | Après une coinche, les deux joueurs de l'équipe preneuse parlent chacun une fois (dans l'ordre de jeu) : surcoinche ou passe | Confirmes-tu que le partenaire du preneur peut aussi surcoincher ? | Ouvert |
| 22 | Joueur déconnecté | §11.5 | `absenceDelaySeconds` (paramètre de salon) | Au bout de 30 s sans connexion, le joueur est affiché « Hors ligne ». La partie l'attend sans limite : personne ne joue à sa place, et il reprend sa place en revenant | Faut-il qu'un bot remplace un joueur absent après un certain temps, ou qu'on puisse le remplacer par un autre ami ? | Ouvert |
| 23 | Passer à la manche suivante | — | — (règle du salon) | La manche suivante (ou la revanche) commence quand les 4 joueurs ont appuyé sur « Manche suivante », pour que chacun ait le temps de lire le score | Préférez-vous un enchaînement automatique après quelques secondes ? | Ouvert |
| 24 | Égalité au-delà du score cible | §10 | `tieBreakRule` | Si les deux équipes sont à égalité après avoir atteint 1500, on joue une donne de plus | Est-ce bien ainsi que vous départagez une égalité ? | Ouvert |
