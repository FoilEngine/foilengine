# ADR 0017 — Toolchain, repository checks and M0 decisions

**Status**: Accepted
**Date**: 2026-10-30

## Context

Milestone M0 sets up the tooling of an empty monorepo. Doing so required versions the docs did not fix, a way to enforce the dependency rules of `docs/01-architecture.md`, and answers to inconsistencies found between the docs: the Core Rules PDF in `docs/rules/` is not version 1.4, rule scenarios in `rules` would make a dependency cycle with `testkit`, and `server` and `console` contradicted `testkit`'s "never imported by production code".

## Decision

### 1. Node.js 24 LTS

Node 24 LTS everywhere (`.nvmrc`, `engines`, CI). Node 22 leaves maintenance in April 2027; Node 26 had only just become LTS. ADR 0010 is updated accordingly; the rest of ADR 0010 stays Proposed.

### 2. TypeScript 7.0

TypeScript 7.0 (the native compiler) for every package. Fallback: 6.0.3 if 7.0 breaks something. Future tools that need the TypeScript JavaScript API (which 7.0 no longer ships) depend locally on `typescript@6`. For the same reason the commitlint config is plain JavaScript.

`tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, plus `module: nodenext`, `verbatimModuleSyntax`, `erasableSyntaxOnly` and `.ts` extensions in relative imports, so the code runs directly in Node 24 without compilation. Packages export their `src/index.ts`; there is no build step until one is needed.

### 3. Tool versions

pnpm 12.16 (pinned by `packageManager`), Turborepo 2.11, Biome 2.6 (lint and format), Vitest 5.0 and fast-check 4.10 (root dev dependencies only, so `rules` and `types` keep zero dependencies), commitlint 21.2 with lefthook 2.2 for the `commit-msg` hook.

### 4. Dependency rules: in-house check plus Biome

No dependency-cruiser: it needs the TypeScript JavaScript API (or swc) to read TypeScript.

- `scripts/check-deps.ts` checks every workspace `package.json` against `scripts/lib/dependency-rules.ts`, a copy of the table in `docs/01-architecture.md`. pnpm refuses imports of undeclared packages, so the manifests are the real boundary.
- Biome rules per folder enforce what manifests cannot: purity of `rules/src`, `types/src` importing nothing, `cards/src` using only `@foilengine/rules/effects`, the engine only in `apps/play/src/offline/`, `console` only in `scripts/` and `apps/cli`, no undeclared import in `src/`.
- Tests in `scripts/test/` prove each rule fires where it should and only there.

### 5. Entry points

- `@foilengine/rules/effects` is the effect API, the only part of `rules` that `cards` may import.
- `apps/play/src/offline/` is the only folder of `play` that may import `rules`, `cards` and `mind` (offline Web Worker).

### 6. `@foilengine/spec` hosts rule and card scenarios

A tests-only package that depends on `types`, `rules`, `cards` and `testkit`; nothing depends on it. Rule scenarios go in `packages/spec/test/rules/<section>/`, card scenarios in `packages/spec/test/cards/<set>/`. `rules` and `cards` never depend on `testkit`. Unit tests of a package stay in its own `test/`.

### 7. `testkit` stays out of production code

- The server's engine self-test does not import `testkit`: reference replays are data files (`.foilreplay`) read at startup and replayed with `rules` and `log`.
- The console goes through the server API and does not import `testkit`.
- Open question: the console's scenario runner runs scenarios "against the deployed version" (`docs/07-observability.md`). With the server unable to import `testkit`, how the server runs a scenario is still to be decided.

### 8. `console` only in `scripts/` and `apps/cli`

`telemetry` is the only door to logs. The CLI is the exception because standard output is its interface.

### 9. Commit scopes

Conventional Commits, checked by commitlint locally and in CI (commits and pull request title). Scopes: a package or app name, or `repo`, `ci`, `deps`, `docs`. The scope is optional.

### 10. Core Rules version identifier

A Core Rules version is identified by `CR-<last update date>`. The current one is `CR-2026-10-09` (Riot's alias: `RUP5`). The PDFs are named `core-rules-2026-10-09.pdf` and `tournament-rules-2026-08-27.pdf`. Every mention of `CR-1.4` as the current identifier is replaced. Rule numbers quoted in the docs come from 1.4; they are renumbered with `/rules-update` at the start of M1, not in M0.

### 11. Source hierarchy

Card text (with official errata) > Core Rules PDF > official FAQ and rulings > Tournament Rules (formats and deckbuilding) > our docs. Our docs are only a reading map: when they conflict with the PDF, the PDF is right, so fix the doc and never write code from the doc. Unofficial sources (riftboundfaq.com, guides, Discord) settle nothing. When the PDF is ambiguous, open a question. Written in `CLAUDE.md` and `docs/rules/README.md`.

### 12. Scripts not yet due

Scripts named in the docs but belonging to later milestones (`test:rules`, `fuzz`, `infra:*`, `dev:obs`, `health`) are not created as stubs. `CLAUDE.md` lists the milestone each one arrives in.

### 13. All documentation in English

Added after M0 on the maintainer's request. All documentation is in English, including the docs that were first written in French: `docs/`, ADRs (files renamed with English slugs), `CLAUDE.md` files, Claude Code commands, READMEs. This replaces the earlier rule that existing French docs were not to be translated. ADR statuses are now Proposed, Accepted, To decide, Superseded by NNNN.

## Consequences

- `pnpm install && pnpm lint && pnpm typecheck && pnpm test` is the M0 gate, locally and in CI.
- Changing the dependency matrix means changing `docs/01-architecture.md` and `scripts/lib/dependency-rules.ts` in the same PR.
- Biome's `noJsRestrictedProperties` (used to forbid `Math.random`) is a nursery rule: a Biome upgrade may rename it. The lint tests catch that.
- Until the M1 renumbering, rule numbers quoted in the docs may be wrong: the PDF wins.

## Rejected alternatives

- dependency-cruiser: needs the TypeScript JavaScript API or swc.
- Node 22: maintenance ends too soon. Node 26: too recent.
- Rule scenarios in `packages/rules/test/`: creates a `rules` ↔ `testkit` cycle, which Turborepo rejects.
- Test tooling as dev dependencies of each package: would give `rules` and `types` third-party dependencies.
