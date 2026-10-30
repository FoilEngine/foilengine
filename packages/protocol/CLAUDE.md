# CLAUDE.md — packages/protocol

Messages client-serveur et leurs schémas Zod, versionnés.

## Dépendances

- **Autorisées** : `types`, Zod.
- **Interdites** : toute logique métier.

## API publique

Les schémas et types de chaque message, `PROTOCOL_VERSION`.

## Points d'attention

- Tout changement incompatible incrémente `PROTOCOL_VERSION`.
- Chaque message a `type`, `v` et `id`.

## À lire

- `docs/08-server-and-protocol.md`

Les règles générales du projet sont dans le `CLAUDE.md` racine.
