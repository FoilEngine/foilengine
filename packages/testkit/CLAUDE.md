# CLAUDE.md — packages/testkit

Outils de test : `board()`, `scenario()`, cartes de test, fuzzer, invariants, replays de référence, indexation des Core Rules, rapports de couverture.

## Dépendances

- **Autorisées** : `types`, `rules`, `cards`, `log`, fast-check.
- **Interdites** : être importé par du code de production.

## API publique

`board`, `scenario`, `fuzz`, `INVARIANTS`, `goldenReplays`, `indexCoreRules`, `ruleCoverage`, `cardCoverage`.

## Points d'attention

- `board()` passe par les mêmes validations que `createGame` : jamais d'état impossible.
- Une violation d'invariant produit un fichier de reproduction dans `repros/`.
- Le rapport de couverture sort en JSON (console, CI) et en Markdown (PR).

## À lire

- `docs/06-testing.md`

Les règles générales du projet sont dans le `CLAUDE.md` racine.
