# 12 — Roadmap

Each milestone has verifiable acceptance criteria. We only move to the next one when all of them are met. Boxes are checked in this file as the work progresses.

The order is driven by dependencies: the engine first, tested, then everything that builds on it. Observability arrives early, because we build on it from the first server.

## M0 — Tooling

- [x] pnpm + Turborepo monorepo, strict TypeScript (`tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- [x] Biome (lint and format), Vitest, fast-check.
- [x] GitHub Actions CI: install, lint, typecheck, test, on every PR and on `main`.
- [x] Check of the dependency rules between packages (`01-architecture.md`) in CI.
- [x] Conventional Commits checked (commitlint), and issue and PR templates.
- [x] The Core Rules and Tournament Rules PDFs in `docs/rules/`.

**Accepted when**: `pnpm install && pnpm lint && pnpm typecheck && pnpm test` passes locally and in CI on a repo with no domain code.

## M1 — Model and engine skeleton

- [x] `types`: identifiers, `CardDefinition`, state, zones, actions, events, views, decisions.
- [x] `rules`: serializable seeded RNG (xoshiro128** or PCG) and its tests.
- [ ] `rules`: `createGame` with the complete setup (104–118), mulligan included.
- [ ] `rules`: `viewFor` and the no-leak test.
- [ ] `testkit`: `board()`, `scenario()`, test cards, and Core Rules indexing (`foil rules index`).
- [ ] `testkit`: rule coverage report (even empty).

**Accepted when**: a game is created deterministically from a seed, the mulligan is tested with its rule numbers, and the coverage report lists every rule of the PDF.

## M2 — A complete game, cards without abilities

The goal: a real game end to end, with vanilla units, runes and battlefields without abilities.

- [ ] The turn: start of turn (Awaken, Beginning with scoring, Channel, Draw and Burn Out), main phase, end of turn (315–317).
- [ ] The rune pool, energy and power, payment and automatic payment (160–168).
- [ ] Playing a unit (349–359, without abilities).
- [ ] Standard move (144, 447+).
- [ ] Fixed-point cleanups (318–324).
- [ ] Showdowns without spells (341–348) and combat (461–468).
- [ ] Hold and conquer, the final point (469–474), victory (193–196), conceding (649–652).
- [ ] The 1v1 mode (487), with its first-turn process: the player going second channels an extra rune during their first Channel Phase (487.7, see Q-001).
- [ ] `log`: log format, serialization, replay, state fingerprint.
- [ ] Fuzzer and invariants (`06-testing.md`), 10,000 games without a violation.
- [ ] Engine benchmarks and budgets in CI.

**Accepted when**: 10,000 random games run to the end without an invariant violation, every rule of the sections above is `covered`, and the replay of every game is deterministic.

## M3 — The chain, abilities and keywords

- [ ] The chain and the HOT FEPR process (325–340), with one name per step in the code.
- [ ] Spells (153–159), Action and Reaction timing (806, 813), showdowns with spells.
- [ ] Passive, replacement, activated and triggered abilities (360+), the order of simultaneous triggers.
- [ ] Layers (475–482) and `characteristics()`.
- [ ] Gear and attachment (147–152, 716).
- [ ] Tokens (179–187).
- [ ] The `cards` DSL and one module per keyword of section 800.
- [ ] Manual mode (`ManualOverride`).

**Accepted when**: every keyword has its scenarios, the fuzzer runs with test cards covering every keyword, and the sections above are `covered`.

## M4 — The real cards

- [ ] `codex`: Riftcodex sync, `CardDefinition` and `Printing` normalization, snapshots, diff between snapshots.
- [ ] Errata, bans, booster configuration (entered by hand with their sources).
- [ ] Deck validation and import (text list, Foil format, deckbuilder codes if documented).
- [ ] Full implementation of two champion decks (closed pool), `complete` status for all their cards.
- [ ] Card coverage report.

**Accepted when**: two champion decks play each other over 10,000 games without manual mode or invariant violations.

## M5 — Server, observability, console

- [ ] `telemetry`: Pino logs, Prometheus metrics, OpenTelemetry traces, GlitchTip errors.
- [ ] `infra/`: Docker Compose for the dependencies and the observability stack, versioned dashboards and alerts.
- [ ] `apps/server`: `/healthz`, `/readyz`, `/health/details`, `/metrics`, engine self-test at startup.
- [ ] `protocol` and WebSocket: join, intent, filtered events, decision, refusal, end, resync, resumption after a restart.
- [ ] Private and solo rooms, guest accounts.
- [ ] `apps/cli`: `foil health`, `foil replay`, `foil scenario`, `foil rules coverage`, `foil codex sync`.
- [ ] Synthetic journey and its metric.
- [ ] `apps/console`: health, running games, replays, rules (coverage and scenario runner), cards, errors.

**Accepted when**: `pnpm health` is green on the full local stack, a game between two browsers is played to the end, a server restart in the middle of a game resumes it without loss, and the console shows everything listed in `07-observability.md`.

## M6 — The game client

- [ ] `ui`: tokens synced from `brand`, components, sound, motion.
- [ ] `apps/play`: full event-driven table, decks, library, replays.
- [ ] Rewind and forward, automatic payment, showdown controls, emotes.
- [ ] Touch, keyboard, screen readers, `prefers-reduced-motion`.

**Accepted when**: a full game can be played with the keyboard alone, on mobile, and with reduced animations; Playwright tests cover a full turn.

## M7 — The AI

- [ ] `random`, `greedy`, `mcts` policies with determinization.
- [ ] Move explanations displayed in the client.
- [ ] AI in a Web Worker for offline mode.
- [ ] Nightly tournament between policies and a non-regression alert.

**Accepted when**: `mcts` beats `greedy` in at least 70% of games on the deck panel, with a budget of 2 seconds per move.

## M8 — Simulations, weak spot, sealed

- [ ] `sim`: jobs, workers, queue, results with confidence intervals.
- [ ] Weak spot of a deck and of a move.
- [ ] Sealed: booster opening faithful to `booster-config.json`, building from the pool.
- [ ] Public matchmaking (constructed and sealed, BO1 and BO3), spectators.

**Accepted when**: a simulation of 10,000 games between two decks gives a reproducible result with its confidence interval, and booster opening reproduces the configured rates over 100,000 draws.

## M9 — Going to production

- [ ] Private `infra` repo: VPS, Compose, Caddy, deployment by image tag, encrypted secrets.
- [ ] Backups and a restore test.
- [ ] External Uptime Kuma and status page.
- [ ] `apps/site` with Riot's notice.
- [ ] Runbooks for every alert.

**Accepted when**: production passes `foil health --env prod`, a backup restore has been tested, and every alert has its runbook.
