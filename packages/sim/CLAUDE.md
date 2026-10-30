# CLAUDE.md — packages/sim

Simulations en masse, statistiques, point faible.

## Dépendances

- **Autorisées** : `rules`, `cards`, `mind`, `log`.
- **Interdites** : exécuter des jobs hors des workers en production.

## API publique

La définition d'un job, son exécution, les statistiques (Wilson), le point faible.

## Points d'attention

- Une simulation est reproductible (même graine, mêmes résultats).
- Exclure ou signaler les parties avec des cartes non implémentées ou du mode manuel.

## À lire

- `docs/09-ai.md`

Les règles générales du projet sont dans le `CLAUDE.md` racine.
