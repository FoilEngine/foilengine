# ADR 0012 — Clients: React and Vite, Astro for the website

**Status**: Proposed
**Date**: 2026-10-30

## Context

The game client is a rich, real-time application; the website must be fast and well indexed.

## Decision

`apps/play` and `apps/console`: **React + Vite + TypeScript**, local state with **Zustand**, table rendered in DOM and CSS (canvas only if needed). `apps/site`: **Astro**, static. `@foilengine/ui` shared.

## Consequences

The design system's animations and sounds are already written with Web Animations and Web Audio: they integrate directly.

## Rejected alternatives

Next.js for everything: SSR is useless for a game client behind a WebSocket connection. A game engine (Pixi, Phaser): to keep for the table if DOM performance is not enough.
