# 08 — Server and protocol (`apps/server`, `@foilengine/protocol`)

## Role of the server

The server is **authoritative**. It holds the full state of every game, validates every action with the engine, persists the log and sends each client what it is allowed to see. The client is only a screen and a controller.

Responsibilities:
- accounts and sessions;
- rooms (private, solo, with an invitation code) and matchmaking (constructed, sealed, BO1, BO3);
- game flow: timers, disconnections, resumption, concession;
- spectators, with a configurable delay and no hidden information;
- server-side AI for ranked or analyzed games against the AI;
- HTTP API: decks, collection, history, replays, simulation results;
- health and metrics (see `07-observability.md`).

## Protocol

- Transport: **WebSocket** for games, **HTTP JSON** for the rest.
- All messages are defined in `@foilengine/protocol` with **Zod schemas**, validated on the way into **and** out of the server.
- Every message has a `type`, a `v` (protocol version) and an `id` (correlation).
- The protocol is versioned. A client that is too old receives `PROTOCOL_UNSUPPORTED` and a message asking it to reload.

Game messages (indicative shape):

| Direction | Message | Content |
| --- | --- | --- |
| client → server | `game.join` | `gameId`, `seat` or spectator |
| client → server | `game.intent` | an engine `Action`, plus `expectedSeq` (number of the last event seen) |
| client → server | `game.rewind.request` / `game.forward.request` | rewind request |
| client → server | `game.emote`, `game.chat` | |
| server → client | `game.snapshot` | the player's view and the sequence number (on connection and on resumption) |
| server → client | `game.events` | the events filtered for this player, from a sequence number |
| server → client | `game.decision` | what is expected from the player, with the legal actions; it can be a choice during a resolution (ADR 0020), such as `Predict`, which shows the cards looked at to that player only |
| server → client | `game.rejected` | action refused, with the engine's reason |
| server → client | `game.ended` | result, link to the replay |

## Guarantees

- **Order**: events carry an increasing sequence number. A client that sees a gap sends `game.resync` and receives a snapshot.
- **Idempotence**: a `game.intent` replayed with the same `id` is applied only once.
- **Concurrency**: only one action is processed at a time per game (one queue per game). `expectedSeq` makes it possible to reject an action sent on a stale state.
- **Hidden information**: the server only sends `viewFor` and the filtered events. An integration test checks, for every type of outgoing message, that no card hidden from the recipient appears in it.
- **Resumption**: the log of every running game is persisted as it goes. After a server restart, games are rebuilt by replaying their log.

## Rewind and forward

Inspired by Rift Atlas: rewind undoes the requester's last action and everything that depends on it. Since the state is deterministic and logged, a rewind consists of replaying the log up to the desired point. In a game between humans, a rewind that undoes the opponent's actions requires their consent. Forward restores the undone line for a short time. Everything is recorded in the log.

## Security

- Rate limiting per connection and per account (messages per second, rooms created).
- Strict input validation (Zod), maximum message size.
- Never any rules logic in the client: an illegal action is always refused by the server, and counted in `foil_engine_illegal_actions_total`.
- Administration endpoints (`/health/details`, console) require an admin role.
- Player reporting (cheating, behavior), as on Rift Atlas.

## Authentication

To be decided in ADR 0011. Proposal: sign-in with Discord (OAuth), because the Riftbound community is there, plus a guest account to play without signing up. Server-side sessions in Postgres.
