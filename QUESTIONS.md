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
| 7 | Couper / surcouper quand le partenaire est déjà maître du pli | §7.4 | `requireTrumpWhenPartnerMaster` | `false` : si le partenaire tient le pli, on joue la carte qu'on veut (aucune obligation de couper ni de surcouper) | **Validé** |
| 8 | Monter à l'atout quand l'atout est demandé | §7.2 | `requireHigherTrumpWhenTrumpLed` | `true` : si l'atout est demandé et qu'on a un atout plus fort que le meilleur déjà posé, on doit le jouer | **Validé** |
| 11 | Annonces de combinaisons (tierce, cinquante, cent, carré) | — | `allowAnnonces` | `false` : pas d'annonces, seule la belote/rebelote compte | **Validé** |
| 14 | Valeur du capot | §9.3 | `capotAnnouncedSuccessPoints`, `capotAnnouncedFailurePoints`, `capotUnannouncedPoints` | Capot **annoncé** réussi : 500 pour le preneur. Capot **annoncé** chuté : 500 pour l'adverse. Capot **non annoncé** (contrat ordinaire où le preneur fait les 8 plis) : 250 pour le preneur | **Validé** |

## Règles encore ouvertes

| # | Règle | Référence | Paramètre `rulesConfig.ts` | Valeur par défaut | Question à trancher | Statut |
|---|---|---|---|---|---|---|
| 1 | Sens de rotation (parole et jeu) | §4 | `playDirection` | `'counterclockwise'` (anti-horaire : après le donneur, c'est le joueur à sa droite) | Dans quel sens tournez-vous : anti-horaire ou horaire ? | Ouvert |
| 2 | Enchérir après avoir passé | §5.2 | `allowRebidAfterPass` | `false` (qui a passé ne reparle plus dans cette donne, sauf pour coincher) | Un joueur qui a passé peut-il annoncer à nouveau plus tard ? | Ouvert |
| 3 | Tout le monde passe sans contrat | §5.3 | `noBidRedeal` | `true` (donne annulée, le donneur suivant redistribue) | Confirmes-tu la redistribution ? | Ouvert |
| 4 | Surenchérir dans la même couleur | §5.4 | `allowOverbidSameSuit` | `true` (autorisé) | Peut-on monter l'enchère dans une couleur déjà annoncée ? | Ouvert |
| 5 | Coupe obligatoire quand on ne peut pas fournir | §7.3 | `requireTrumpWhenVoid` | `true` (sauf partenaire maître, cf. #7) | La coupe est-elle obligatoire dans toutes les autres situations ? | Ouvert |
| 6 | Surcoupe obligatoire sur un atout adverse | §7.4 | `requireOvertrump` | `true` | Faut-il surcouper un adversaire quand c'est possible ? | Ouvert |
| 9 | Multiplicateurs coinche / surcoinche | §6.3 | `coincheMultiplier`, `surcoincheMultiplier` | ×2 / ×4, appliqués au score de la manche du camp qui marque (hors belote) | Confirmes-tu ×2 et ×4 ? Qu'est-ce qui est multiplié exactement ? | Ouvert |
| 10 | Belote : annonce, chute et coinche | §8 | `beloteAlwaysScored`, `beloteCountsForContract` | Annonce automatique (le moteur détecte Roi + Dame d'atout dans la même main et affiche « Belote » puis « Rebelote »). Les 20 points restent au camp qui la détient même en cas de chute, ne sont jamais multipliés, et comptent pour atteindre le contrat | La belote reste-t-elle acquise quand le contrat chute ? Compte-t-elle pour atteindre le contrat ? Le joueur peut-il choisir de ne pas l'annoncer ? | Ouvert |
| 12 | Calcul du contrat réussi | §9.1 | `contractSuccessScoring` | `'contractOnly'` : réussi si le preneur atteint la valeur annoncée ET fait strictement plus de points que la défense (§9.1). Le preneur marque **la valeur du contrat** ; la défense marque ses points réalisés. Choisi pour rester cohérent avec ton barème du capot (250 non annoncé, 500 annoncé, toujours au-dessus d'un contrat à 160). Autre option prête : `'contractPlusPoints'` (points réalisés + contrat) | Le preneur marque-t-il seulement son annonce, ou ses points + son annonce ? Arrondissez-vous à la dizaine ? | Ouvert |
| 13 | Calcul du contrat chuté | §9.2 | `contractFailureScoring` | La défense marque 160 + la valeur du contrat ; le preneur marque 0 (hors belote) | Confirmes-tu « 160 + valeur du contrat » ? | Ouvert |
| 15 | Score cible et égalité | §10 | `targetScore`, `tieBreakRule` | 1000 points ; la partie se termine à la fin de la donne qui fait dépasser la cible ; en cas d'égalité, on joue une donne de plus | 1000 points te convient comme valeur par défaut ? | Ouvert |
| 16 | Rang du capot dans les enchères | §5.1 | `capotRank` | Enchère la plus haute, au-dessus de 160, annonçable à tout moment (y compris en ouverture) | Le capot peut-il être annoncé à tout moment, ou seulement après une certaine enchère ? | Ouvert |
| 17 | Capot et coinche / surcoinche | §9.3 | `capotMultiplied` | `true` (les 500 ou 250 sont multipliés par ×2 ou ×4) | Le capot est-il multiplié en cas de coinche ou de surcoinche ? | Ouvert |
| 18 | Capot non annoncé fait par la défense | §9.3 | — (règle du moteur) | Pas de bonus particulier : c'est une chute normale (160 + contrat pour la défense) | Si la défense fait les 8 plis, a-t-elle droit à un bonus ? | Ouvert |
| 19 | Sous-couper quand on ne peut pas surcouper | §7.4 | `requireUndertrump` | `true` : si un adversaire a coupé plus fort que tous vos atouts, vous devez quand même jouer un atout (plus faible) | Quand on ne peut pas surcouper, doit-on quand même jouer un atout, ou peut-on se défausser ? | Ouvert |
| 20 | Moment de la coinche | §6.1 | — (règle du moteur) | On ne peut coincher qu'à son tour de parole. Les deux défenseurs ont toujours un tour avant la fin des enchères. Un joueur qui a passé peut encore coincher | Chez vous, peut-on coincher à tout moment, même hors de son tour ? | Ouvert |
| 21 | Qui peut surcoincher | §6.2 | — (règle du moteur) | Après une coinche, les deux joueurs de l'équipe preneuse parlent chacun une fois (dans l'ordre de jeu) : surcoinche ou passe | Confirmes-tu que le partenaire du preneur peut aussi surcoincher ? | Ouvert |
| 22 | Joueur déconnecté | §11.5 | `absenceDelaySeconds` (paramètre de salon) | Au bout de 30 s sans connexion, le joueur est affiché « Hors ligne ». La partie l'attend sans limite : personne ne joue à sa place, et il reprend sa place en revenant | Faut-il qu'un bot remplace un joueur absent après un certain temps, ou qu'on puisse le remplacer par un autre ami ? | Ouvert |
| 23 | Passer à la manche suivante | — | — (règle du salon) | La manche suivante (ou la revanche) commence quand les 4 joueurs ont appuyé sur « Manche suivante », pour que chacun ait le temps de lire le score | Préférez-vous un enchaînement automatique après quelques secondes ? | Ouvert |
