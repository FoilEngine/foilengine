# CLAUDE.md — packages/types

Types partagés : identifiants marqués, définitions de cartes, état de jeu, zones, actions, événements, décisions, vues.

## Dépendances

- **Autorisées** : rien.
- **Interdites** : toute dépendance, toute logique, toute fonction (sauf gardes de type triviales et `assertNever`).

## API publique

Uniquement des types et des constantes. Exporté depuis `src/index.ts`.

## Points d'attention

- Tout changement de forme de `GameState`, `Action` ou `GameEvent` incrémente la version concernée et doit rester rejouable (voir `log`).
- L'état doit rester du JSON pur : pas de `Map`, `Set`, `Date`, classe ni fonction.
- Nommer les événements au passé, les actions à l'impératif.

## À lire

- `docs/02-game-model.md`
- `docs/13-conventions.md`

Les règles générales du projet sont dans le `CLAUDE.md` racine.
