# CLAUDE.md — apps/play

Le client de jeu.

## Dépendances

- **Autorisées** : `ui`, `protocol`, `types` ; `rules`, `cards` et `mind` uniquement dans le Web Worker du mode hors ligne, sous `src/offline/` (vérifié par Biome).
- **Interdites** : décider d'une légalité en ligne ; calculer un état autrement qu'en projetant les événements.

## API publique

—

## Points d'attention

- Piloté par les événements : chaque événement a son animation et son son.
- Tactile, clavier et lecteurs d'écran dès le départ ; aucune chaîne en dur (traductions).

## À lire

- `docs/10-clients.md`

Les règles générales du projet sont dans le `CLAUDE.md` racine.
