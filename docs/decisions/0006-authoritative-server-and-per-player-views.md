# ADR 0006 — Authoritative server and per-player views

**Status**: Accepted
**Date**: 2026-10-30

## Context

An online card game has hidden information (hand, deck). Sending the full state to the client makes cheating possible.

## Decision

The server holds the full state, validates every action with the engine, and only sends `viewFor(state, player)` and the filtered events. No rules in the client.

## Consequences

A test checks that no outgoing message contains information hidden from its recipient. The AI also uses `viewFor`: it does not cheat.

## Rejected alternatives

Logic duplicated in the client for responsiveness: a source of desyncs and cheating.
