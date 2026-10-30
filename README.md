# Foil Engine

A simulator and AI for Riftbound, with a real rules engine.

- **Referee**: the engine knows which moves are legal, resolves the chain and the triggers, and detects victory.
- **Opponent**: an AI that plays against you and explains its moves.
- **Analysis**: thousands of simulated games to measure a matchup or find a deck's weak spot.

## Structure

```
apps/
  server/      game server (HTTP + WebSocket), API, healthchecks, metrics
  play/        game client
  site/        website
  console/     administration and monitoring console
  cli/         the `foil` command-line tool
packages/
  types/       shared types (state, actions, events, views)
  rules/       the rules engine, pure and deterministic
  cards/       card effects (DSL and implementations)
  codex/       card data import and normalization
  protocol/    client-server messages (Zod schemas)
  log/         event log, replays, notation
  mind/        the AI
  sim/         mass simulations and analysis
  testkit/     scenario harness, fuzzing, invariants, coverage
  spec/        rule and card scenarios (tests only)
  telemetry/   logs, metrics, traces, healthchecks
  db/          schema and migrations
  ui/          design system (tokens, components, sound, motion)
scripts/       monorepo tooling (dependency checks)
infra/         local docker compose, monitoring, alerts, dashboards
docs/          documentation (start with docs/00-vision.md)
```

## Getting started

Node 24 LTS (`.nvmrc`) and pnpm, whose version is pinned by `packageManager` (Corepack or pnpm ≥ 9.7 switch to it automatically).

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
```

The reference documentation is in `docs/`. `CLAUDE.md` gives the working rules.

## License

Foil's code is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only, see ADR 0016). The license covers the code only: Riot Games' assets (card images, card backs, logos) and the card data are not covered by it.

## Legal notice

Foil was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.
