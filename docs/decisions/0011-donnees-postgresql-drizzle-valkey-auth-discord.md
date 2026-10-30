# ADR 0011 — Données : PostgreSQL, Drizzle, Valkey, BullMQ, authentification Discord

**Statut** : Proposé
**Date** : 2026-10-30

## Contexte

Il faut stocker comptes, decks, journaux de parties, résultats de simulations, gérer des sessions et une file de jobs.

## Décision

**PostgreSQL** avec **Drizzle ORM** (schéma en TypeScript, migrations versionnées, dans `@foilengine/db`). **Valkey** (fork libre de Redis) pour les sessions, le pub/sub et la file **BullMQ** des simulations. Authentification par **Discord OAuth** et comptes invités, sessions en base.

## Conséquences

Tout tourne en conteneurs sur une seule machine au départ. Les journaux de parties sont stockés en JSONB compressé, avec un index par joueur et par date.

## Alternatives écartées

SQLite : plus simple, mais limite la concurrence des workers. Prisma : plus lourd à l'exécution que Drizzle.
