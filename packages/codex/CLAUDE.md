# CLAUDE.md — packages/codex

Import, normalisation et snapshots des données de cartes.

## Dépendances

- **Autorisées** : `types`, Zod, un client HTTP (uniquement dans les scripts de synchronisation).
- **Interdites** : être appelé par le moteur à l'exécution ; dépendre du réseau dans les tests.

## API publique

`loadSnapshot`, `validateDeck`, les parseurs d'import de deck, la commande `codex sync`.

## Points d'attention

- Séparer `CardDefinition` (la règle) et `Printing` (l'impression).
- Les snapshots sont commités ; les tests utilisent un snapshot précis.
- Les données saisies à la main (errata, bannissements, boosters, rulings) citent toujours leur source.

## À lire

- `docs/05-codex-data.md`

Les règles générales du projet sont dans le `CLAUDE.md` racine.
