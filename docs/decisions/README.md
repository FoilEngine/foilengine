# Architecture decisions (ADR)

Every structural decision is recorded here, one per numbered file.

## Statuses

- **Proposed**: waiting for Alexandre's validation. Do not implement before.
- **Accepted**: in force.
- **To decide**: open question, no option chosen.
- **Superseded by NNNN**: obsolete, keep the file for history.

## Creating an ADR

Use `/new-adr <title>`, or copy this template into `NNNN-short-title.md`:

```markdown
# ADR NNNN — Title

**Status**: Proposed
**Date**: YYYY-MM-DD

## Context
The problem, the constraints, what forces a decision.

## Decision
What we do, precisely.

## Consequences
What it changes, what it costs, what to watch.

## Rejected alternatives
The other options and why we do not keep them.
```

## Index

| No. | Title | Status |
| --- | --- | --- |
| 0001 | Monorepo with pnpm and Turborepo | Accepted |
| 0002 | Strict TypeScript everywhere | Accepted |
| 0003 | Pure and deterministic engine | Accepted |
| 0004 | Immutable and serializable state | Accepted (without Immer) |
| 0005 | The event log is the source of truth | Accepted |
| 0006 | Authoritative server and per-player views | Accepted |
| 0007 | Card effects as a DSL | Accepted |
| 0008 | Numbered rule tests and coverage | Accepted |
| 0009 | Manual mode for unimplemented cards | Accepted |
| 0010 | Server stack: Node 24, Fastify, WebSocket, Zod | Proposed (Node 24 accepted by 0017) |
| 0011 | Data: PostgreSQL, Drizzle, Valkey, BullMQ, Discord authentication | Proposed |
| 0012 | Clients: React and Vite, Astro for the website | Proposed |
| 0013 | Hosting: one VPS, Docker Compose, Caddy | Proposed |
| 0014 | Observability: OpenTelemetry and the Grafana stack | Proposed |
| 0015 | Free project under the Legal Jibber Jabber policy | Accepted |
| 0016 | Code license | Accepted (AGPL-3.0-only) |
| 0017 | Toolchain, repository checks and M0 decisions | Accepted |
