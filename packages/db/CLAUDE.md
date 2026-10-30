# CLAUDE.md — packages/db

Schéma de base de données, migrations, accès.

## Dépendances

- **Autorisées** : `types`, Drizzle, le driver Postgres.
- **Interdites** : logique de jeu.

## API publique

Le schéma Drizzle, les migrations, les fonctions d'accès.

## Points d'attention

- Toute modification de schéma passe par une migration versionnée.
- Les journaux de parties sont en JSONB, avec la version du format.

## À lire

- `docs/decisions/0011-donnees-postgresql-drizzle-valkey-auth-discord.md`

Les règles générales du projet sont dans le `CLAUDE.md` racine.
