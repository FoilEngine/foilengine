# CLAUDE.md — packages/protocol

Client-server messages and their Zod schemas, versioned.

## Dependencies

- **Allowed**: `types`, Zod.
- **Forbidden**: any domain logic.

## Public API

The schemas and types of every message, `PROTOCOL_VERSION`.

## Points of attention

- Every breaking change increments `PROTOCOL_VERSION`.
- Every message has `type`, `v` and `id`.

## Read

- `docs/08-server-and-protocol.md`

The general project rules are in the root `CLAUDE.md`.
