# 10 — Clients (`apps/play`, `apps/site`, `apps/console`, `@foilengine/ui`)

## Design system

La source de vérité de l'identité est le repo **`FoilEngine/brand`** : logos, tokens, sons, motion, et les règles d'usage (`04-design-system/`). `@foilengine/ui` en est l'implémentation :

- `tokens.css` et les tokens TypeScript générés depuis `brand/04-design-system/tokens.json` (script de synchronisation, jamais d'édition à la main) ;
- les composants : Button, FoilSurface, GameCard, WeakPoint, puis les composants de table ;
- le **moteur de son** (`brand/05-sons/foil-sound.js`, porté en TypeScript) et son catalogue de sons ;
- les primitives de motion : courbes, durées, ressort amorti, gestes (fente, parade, riposte, touche, retour en garde, reflet foil, point faible).

Règles clés à respecter (détail dans `brand`) :
- Thème sombre par défaut dans le simulateur, clair sur la vitrine.
- Bodoni Moda uniquement pour le wordmark et les titres de la vitrine ; Inter Tight pour l'interface ; JetBrains Mono pour les données du moteur.
- Le foil ne sert qu'au logo et aux moments où l'IA agit.
- Les cartes officielles s'affichent telles quelles (recto et dos). Le design system ne touche qu'à ce qui les entoure.
- `prefers-reduced-motion` respecté partout ; le son a son propre interrupteur et trois niveaux (Complet, Essentiel, Coupé).

## `apps/play` : le client de jeu

- **Stack proposée** (ADR 0012) : React, Vite, TypeScript, un store léger (Zustand), rendu de la table en DOM et CSS (et canvas seulement si les performances l'exigent).
- **Piloté par les événements** : la table reçoit `game.events`, et chaque événement déclenche une animation et un son définis dans le design system. L'état affiché est celui du dernier `game.snapshot` plus les événements appliqués par le client à une copie de la vue (projection), jamais une règle recalculée.
- Écrans : accueil, salon et matchmaking, import et gestion de decks, bibliothèque de cartes, deckbuilder, sealed (ouverture de boosters, construction depuis le pool), table de jeu, replays, résultats d'analyse et de simulation, paramètres (son, motion, langue).
- La table : deux plateaux, battlefields, pool de runes, main, chaîne, journal en notation, contrôles de showdown (qui a le focus, passer), rewind et forward, paiement automatique, emotes.
- **Tactile** dès le départ (Rift Atlas le fait) : appui long pour les actions d'une carte.
- **Langues** : anglais d'abord, puis français et coréen (fichiers de traduction, aucune chaîne en dur).
- Mode hors ligne contre l'IA : `rules`, `cards` et `mind` tournent dans un Web Worker.

## `apps/site` : la vitrine

Site statique (proposition : Astro). Pages : accueil (logo animé, ce que fait Foil, captures), fonctionnalités, statut du projet (couverture des cartes et des règles, publiée depuis les rapports), mentions légales avec la mention de Riot, lien vers la page de statut (Uptime Kuma). Son coupé par défaut.

## `apps/console`

Voir `07-observability.md`. Même stack que `play`, réservée aux administrateurs.

## Accessibilité

Contrastes vérifiés sur les deux thèmes (déjà calculés dans `brand`), navigation complète au clavier sur la table, libellés lisibles par les lecteurs d'écran pour les cartes et les zones, aucune information portée par la seule couleur (rareté, point faible, victoire et défaite).
