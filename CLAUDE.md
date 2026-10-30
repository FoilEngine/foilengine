# CLAUDE.md — Foil Engine

Claude Code reads this file automatically. It gives the project context and the working rules. Each package also has its own, more specific `CLAUDE.md`: read it as soon as you work in that package.

## The project

Foil Engine is a Riftbound simulator (Riot Games' card game) with a real rules engine: it knows which moves are legal, resolves effects and detects victory. On top of it: an AI that plays against the user, and mass matchup simulations. A **free** fan project, under Riot's "Legal Jibber Jabber" policy (see `docs/00-vision.md`).

## Read before coding

| If you touch… | Read first |
| --- | --- |
| Anything, the first time | `docs/00-vision.md`, `docs/01-architecture.md`, `docs/13-conventions.md`, `docs/12-roadmap.md` |
| Game state, actions, events | `docs/02-game-model.md` |
| The rules engine | `docs/03-rules-engine.md`, and the Core Rules PDF in `docs/rules/` |
| A card or an effect | `docs/04-cards-and-effects.md` |
| Card data | `docs/05-codex-data.md` |
| Tests | `docs/06-testing.md` |
| Logs, metrics, healthchecks, the console | `docs/07-observability.md` |
| The server and the protocol | `docs/08-server-and-protocol.md` |
| AI and simulations | `docs/09-ai.md` |
| Clients and the design system | `docs/10-clients.md` (and the `FoilEngine/brand` repo) |
| Deployment | `docs/11-infra.md` |
| A game term | `docs/14-glossary.md` |
| Dependency rules, tooling, CI | `docs/01-architecture.md`, `docs/decisions/0017-toolchain-repository-checks-and-m0-decisions.md` |
| An architecture choice | `docs/decisions/` (an ADR with status "Proposed" is not implemented before it is validated) |

## Non-negotiable rules

1. **The rules engine is pure.** `@foilengine/rules` does no I/O: no network, no files, no clock, no `Math.random`. It depends only on `@foilengine/types`. All randomness goes through the seeded RNG stored in the state.
2. **Determinism.** Same initial state, same seed and same actions give exactly the same game, byte for byte. Any test that fails on replay is a bug.
3. **`apply` returns events.** The event log is the source of truth: replays, rewind, animations, sounds, metrics and AI training derive from it.
4. **Never any hidden information on a client.** The server sends `viewFor(state, player)`, never the full state. A test checks that a player's view contains neither the opponent's hand nor their deck.
5. **No rules in the client.** The client displays what the server tells it and sends intents. All legality is decided in `rules`.
6. **Every implemented rule has its test, which cites its number.** Form: `it('rule <exact Core Rules number>: second player channels 3 runes on their first turn')`, with the real number read in the PDF. No number, no merge.
7. **Never invent a rule.** If the Core Rules do not settle it, or if you are not sure, write the case in `docs/rules/questions.md` and flag it. Do not guess.
8. **No Riot assets in Foil's identity.** Card images are displayed as they are, but no Riot logo or trademark in the name, the logo or the communication.

## Source hierarchy

When sources disagree, the higher one wins:

1. Card text, including official errata.
2. The Core Rules PDF (`docs/rules/`, current version `CR-2026-10-09`).
3. Official FAQ and rulings.
4. The Tournament Rules (formats and deckbuilding).
5. Our docs (`docs/`).

Our docs are only a reading map. When they conflict with the PDF, the PDF is right: fix the doc, never write code from the doc. Unofficial sources (riftboundfaq.com, guides, Discord) settle nothing. When the PDF is ambiguous, open a question in `docs/rules/questions.md`. Details in `docs/rules/README.md`.

## Commands

```bash
pnpm install            # dependencies (also installs the commit-msg hook)
pnpm dev                # everything in dev mode (turbo)
pnpm build              # build every package
pnpm test               # all tests
pnpm typecheck
pnpm lint               # biome (lint and format, CI mode)
pnpm format             # biome: applies formatting and safe fixes
pnpm check:deps         # dependency rules between packages (docs/01-architecture.md)
pnpm foil <command>     # the foil CLI (apps/cli), e.g. `pnpm foil rules index`
pnpm test:rules         # rule coverage report (pnpm test:rules --pin to pin newly covered rules)
```

Prerequisites: Node 24 LTS (`.nvmrc`); the pnpm version is pinned by `packageManager`.

Scripts not created yet, with the milestone they arrive in (`docs/12-roadmap.md`):

| Script | Role | Milestone |
| --- | --- | --- |
| `pnpm fuzz` | random games with invariant checks | M2 |
| `pnpm cards:coverage` | card coverage report (`docs/04-cards-and-effects.md`) | M4 |
| `pnpm infra:up`, `pnpm infra:obs` | local dependencies and observability stack (`infra/README.md`) | M5 |
| `pnpm dev:obs` | the application with the local observability stack | M5 |
| `pnpm health` | full healthcheck of the current environment (see docs/07) | M5 |

Do not create a script before its milestone. When you create it, add it to the root `package.json` and remove it from this table.

## How to work

1. Read the relevant docs and the task in `docs/12-roadmap.md`.
2. Write a short plan before coding if the task touches more than one file.
3. Write the tests first for any rule or effect (the test cites the rule).
4. Implement the minimum that makes the tests pass.
5. Run `pnpm typecheck && pnpm lint && pnpm test` before saying it is done.
6. Update the docs if you change a contract (public types, protocol, event format, metric). An architecture change goes through a new ADR (`/new-adr`).

**Definition of done**: tests green, typecheck and lint green, docs up to date, no guessed rule, and the task checked in the roadmap.

## Project Claude Code commands

In `.claude/commands/`:
- `/add-rule-test <rule number>`: writes the test of a rule from the Core Rules.
- `/implement-card <name or id>`: implements a card end to end (data, effect, tests, status).
- `/rule-coverage`: report of covered, partial or missing rules.
- `/healthcheck`: runs the health checks and summarizes them.
- `/investigate-replay <file>`: replays a game, finds the faulty action, writes the regression test.
- `/new-adr <title>`: creates an architecture decision.
- `/milestone-status`: where the roadmap stands.
- `/rules-update <version>`: integrates a new version of the Core Rules and flags the tests to re-check.

## Language

Everything is in English: code, identifiers, comments, tests, commits, branches, PRs, issues, log messages, metric names, UI, and all documentation (docs, ADRs, `CLAUDE.md` files, Claude Code commands, runbooks, rule questions, reports). Game terms use Riftbound's official English vocabulary.
