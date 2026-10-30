# CLAUDE.md — packages/mind

L'IA : politiques, déterminisation, évaluation, explications.

## Dépendances

- **Autorisées** : `types`, `rules`, `cards`.
- **Interdites** : accéder à l'état complet : une politique ne reçoit que `viewFor`.

## API publique

L'interface `Policy` et les politiques `random`, `greedy`, `mcts`.

## Points d'attention

- Chaque décision est reproductible (RNG à graine fourni).
- Respecter le budget de temps ou de simulations.
- Toujours renvoyer une explication quand la politique le permet.

## À lire

- `docs/09-ai.md`

Les règles générales du projet sont dans le `CLAUDE.md` racine.
