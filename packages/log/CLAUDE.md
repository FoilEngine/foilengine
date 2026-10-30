# CLAUDE.md — packages/log

Journal d'événements, replays, notation, empreinte d'état, filtrage par visibilité.

## Dépendances

- **Autorisées** : `types`, `rules`.
- **Interdites** : entrée-sortie (la persistance est faite par le serveur).

## API publique

`serializeReplay`, `parseReplay`, `replay`, `rewindTo`, `stateHash`, `filterEventsFor`, la notation.

## Points d'attention

- Le format `.foilreplay` est versionné : un ancien replay doit rester lisible.
- `stateHash` doit être stable (ordre des clés normalisé).

## À lire

- `docs/02-game-model.md`
- `docs/03-rules-engine.md`

Les règles générales du projet sont dans le `CLAUDE.md` racine.
