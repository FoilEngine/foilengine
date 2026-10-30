# 00 — Vision et périmètre

## Ce qu'est Foil Engine

Un simulateur de Riftbound qui **connaît les règles**. Les simulateurs existants (Rift Atlas, TCG Arena, Tabletop Simulator) sont des tables manuelles : les joueurs déplacent les cartes et appliquent les règles eux-mêmes. Foil Engine, lui, sait quels coups sont légaux, résout la chaîne et les déclencheurs, et détecte la victoire. Ça rend possible ce qu'aucun autre outil ne fait :

1. **Une IA adversaire** qui joue des parties complètes et explique ses coups (évaluation chiffrée).
2. **Des simulations en masse** : des milliers de parties entre deux decks pour mesurer un matchup, avec un intervalle de confiance.
3. **Le point faible** : l'IA identifie les cartes ou les coups qui coûtent le plus à un deck.
4. **Des replays exacts**, du rewind et de la notation de partie, parce que tout est déterministe et journalisé.
5. **Des puzzles** générés à partir de positions réelles.

## Les publics

- **Les joueurs compétitifs** : tester un deck contre l'IA ou contre des listes du méta, mesurer les matchups.
- **Les joueurs occasionnels** : jouer en ligne avec un arbitre qui empêche les erreurs de règles.
- **Les collectionneurs et les joueurs de sealed** : ouvrir des boosters fidèles aux taux réels et construire un deck depuis un pool.

## Ce qu'il faut atteindre pour être au niveau du marché

La référence actuelle est Rift Atlas. Ses fonctions de base deviennent le minimum attendu : matchmaking rapide et salons privés (1v1, free-for-all, 2v2), import de deck (liste ou code), mode solo, spectateurs, sealed, rewind et forward, paiement automatique des coûts, contrôles de showdown, conquête, jetons, compteurs, emotes, replays.

## Hors périmètre (pour l'instant)

- Les runes alternatives, les jetons et les runes comme objets de collection (ils restent gérés comme objets de jeu).
- La monétisation, sous quelque forme que ce soit (voir contraintes légales).
- Une application mobile native. Le client web doit en revanche fonctionner au tactile.

## Contraintes légales (non négociables)

Foil Engine est un projet de fan régi par la politique « Legal Jibber Jabber » de Riot Games :

- **Gratuit** : aucun paywall, abonnement, contenu payant, financement participatif, ni entité commerciale.
- **Mention obligatoire**, visible sur le site et dans l'application : « Foil was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project. »
- **Pas de logo ni de marque Riot dans l'identité de Foil** (nom, logo, communication). Les cartes officielles s'affichent telles quelles, dos compris.
- Riot peut demander l'arrêt du projet à tout moment : l'architecture ne doit rien rendre irréversible côté données des utilisateurs (export des decks et des replays).

## Identité

L'identité visuelle et sonore est dans le repo `FoilEngine/brand` (logos, tokens, sons, motion). Le nom est « Foil », et « Engine » est le descripteur. Les règles de marque sont dans `brand/04-design-system/README.md`.
