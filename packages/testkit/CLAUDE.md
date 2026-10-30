# CLAUDE.md — packages/testkit

Outils de test : `board()`, `scenario()`, cartes de test, fuzzer, invariants, replays de référence, indexation des Core Rules, rapports de couverture.

## Dépendances

- **Autorisées** : `types`, `rules`, `cards`, `log`, fast-check.
- **Interdites** : être importé par du code de production (ni `server`, ni `console`). Seuls `spec` (les scénarios) et `cli` l'importent.

## API publique

`board`, `scenario`, `fuzz`, `INVARIANTS`, `goldenReplays`, `indexCoreRules`, `ruleCoverage`, `cardCoverage`.

## Points d'attention

- Le harnais vit ici, les scénarios dans `@foilengine/spec` : `rules` et `cards` ne dépendent jamais de `testkit`.
- `board()` passe par les mêmes validations que `createGame` : jamais d'état impossible.
- Les replays de référence (`golden/*.foilreplay`) sont des fichiers de données : le serveur les lit au démarrage pour son auto-test sans importer ce package.
- Une violation d'invariant produit un fichier de reproduction dans `repros/`.
- Le rapport de couverture sort en JSON (console, CI) et en Markdown (PR).

## À lire

- `docs/06-testing.md`

Les règles générales du projet sont dans le `CLAUDE.md` racine.
