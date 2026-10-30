# ADR 0010 — Server stack: Node 24, Fastify, WebSocket, Zod

**Status**: Proposed (the Node version, 24 LTS, is accepted by ADR 0017; Fastify, WebSocket and Zod are still to be validated)
**Date**: 2026-10-30 (updated 2026-10-30: Node 22 → Node 24)

## Context

The server must share the TypeScript engine, hold hundreds of WebSocket connections and be simple to operate.

## Decision

Node.js **24 LTS** (not 22, which is no longer maintained after April 2027; not 26, which had been LTS for too short a time when the choice was made), **Fastify** for HTTP (mature health, metrics and OpenTelemetry plugins), **@fastify/websocket** (ws) for real time, **Zod** for every input and output schema (`@foilengine/protocol`).

## Consequences

A single stack. If the number of connections becomes a problem, uWebSockets.js can replace ws behind the same interface.

## Rejected alternatives

Colyseus: a convenient room framework, but it imposes its synchronized-state model, contrary to ADR 0006. Hono: excellent, but its observability ecosystem is less mature than Fastify's for a long-running Node server.
