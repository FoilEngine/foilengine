# CLAUDE.md — packages/db

Database schema, migrations, access.

## Dependencies

- **Allowed**: `types`, Drizzle, the Postgres driver.
- **Forbidden**: game logic.

## Public API

The Drizzle schema, the migrations, the access functions.

## Points of attention

- Every schema change goes through a versioned migration.
- Game logs are stored as JSONB, with the format version.

## Read

- `docs/decisions/0011-data-postgresql-drizzle-valkey-discord-auth.md`

The general project rules are in the root `CLAUDE.md`.
