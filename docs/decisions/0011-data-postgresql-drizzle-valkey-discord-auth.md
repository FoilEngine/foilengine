# ADR 0011 — Data: PostgreSQL, Drizzle, Valkey, BullMQ, Discord authentication

**Status**: Proposed
**Date**: 2026-10-30

## Context

We need to store accounts, decks, game logs and simulation results, and to manage sessions and a job queue.

## Decision

**PostgreSQL** with **Drizzle ORM** (schema in TypeScript, versioned migrations, in `@foilengine/db`). **Valkey** (open-source fork of Redis) for sessions, pub/sub and the **BullMQ** simulation queue. Authentication through **Discord OAuth** and guest accounts, sessions in the database.

## Consequences

Everything runs in containers on a single machine at first. Game logs are stored as compressed JSONB, indexed by player and by date.

## Rejected alternatives

SQLite: simpler, but limits worker concurrency. Prisma: heavier at runtime than Drizzle.
