# CLAUDE.md — apps/console

La console d'administration et de monitoring.

## Dépendances

- **Autorisées** : `ui`, `protocol`, `types`, `log`.
- **Interdites** : être accessible sans rôle admin ; importer `testkit` ou `rules`. Rapports de couverture, replays et lanceur de scénarios passent par l'API du serveur.

## API publique

—

## Points d'attention

- Pages : santé, parties en cours, replays, règles (couverture et lanceur de scénarios), cartes, simulations, erreurs, métriques.

## À lire

- `docs/07-observability.md`

Les règles générales du projet sont dans le `CLAUDE.md` racine.
