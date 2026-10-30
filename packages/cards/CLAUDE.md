# CLAUDE.md — packages/cards

Le DSL des effets et l'implémentation de chaque carte, avec son statut.

## Dépendances

- **Autorisées** : `types`, et l'API d'effets de `rules`.
- **Interdites** : modifier l'état autrement que par l'API d'effets ; importer les internes de `rules`.

## API publique

`defineCard`, les briques du DSL, le registre des cartes et leurs statuts.

## Points d'attention

- Un fichier par carte, nommé par son `riftbound_id`, regroupé par set.
- Les tests de la carte d'abord, avec le harnais de `testkit`, nommés `card <id>: …`.
- Le texte suivi est le texte en vigueur (errata compris), lu dans le snapshot `codex`.
- Le code sur mesure est l'exception : le justifier en commentaire, et proposer une brique de DSL au troisième cas similaire.

## À lire

- `docs/04-cards-and-effects.md`
- `docs/06-testing.md`

Les règles générales du projet sont dans le `CLAUDE.md` racine.
