# 13 — Conventions

## Language

- Everything is in **English**: code, identifiers, comments, tests, commits, branches, PRs, issues, log messages, metric names, and all documentation (docs, ADRs, `CLAUDE.md` files, Claude Code commands, runbooks, rule questions, reports).
- Product UI: English first, with translation files.
- Game terms use Riftbound's official English vocabulary (legend, battlefield, rune, might, showdown, chain, focus…).

## TypeScript

- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. No `any`; `unknown` then validation.
- ES modules, explicit imports with an extension when resolution requires it: with `module: nodenext`, relative imports carry the `.ts` extension (`import { x } from './x.ts'`).
- `erasableSyntaxOnly`: no `enum`, `namespace` or constructor parameter properties; prefer literal unions and `as const` objects. That way the code runs directly in Node 24, without compilation.
- No classes in the game state: plain objects and pure functions. Classes are accepted elsewhere (server, clients) when they simplify things.
- Identifiers are branded types (`type ObjectId = string & { readonly __brand: 'ObjectId' }`).
- Discriminated unions (`type`) for actions, events and messages, with an exhaustive `switch` (`assertNever`).
- Expected errors are values (`{ ok: false, reason }`); exceptions are reserved for bugs and impossible cases.
- No dependency added without a reason written in the PR. Any dependency of `rules` or `types` requires an ADR.

## Naming

| Element | Convention | Example |
| --- | --- | --- |
| Files | kebab-case | `hot-fepr.ts` |
| Types, interfaces | PascalCase | `GameState` |
| Functions, variables | camelCase | `legalActions` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_VICTORY_SCORE` |
| Events | PascalCase, past tense | `RuneChanneled` |
| Actions | PascalCase, imperative | `PlayCard` |
| Protocol messages | `domain.action` | `game.intent` |
| Metrics | `foil_` + snake_case | `foil_engine_apply_seconds` |

## Tests

- Tests live next to their package in `test/`, named `*.test.ts`. Rule scenarios are in `packages/spec/test/rules/<section>/`, card scenarios in `packages/spec/test/cards/<set>/` (see `06-testing.md`).
- A rule scenario starts with `rule <number>:`. A card scenario with `card <id>:`.
- No test depends on the network, the time of day or the execution order.

## Git

- Main branch: `main`, protected. Everything goes through a PR, even solo (the CI must be green).
- Branches: `feat/…`, `fix/…`, `rules/…` (rule implementation), `cards/…`, `docs/…`, `chore/…`.
- Commits: **Conventional Commits** with the package as scope: `feat(rules): implement channel step (315.3)`, `fix(server): resync on sequence gap`, `test(spec): cover mulligan (117)`.
- Allowed scopes, checked by commitlint (`commit-msg` hook and CI): the name of a package or app (`types`, `rules`, `cards`, `codex`, `protocol`, `log`, `mind`, `sim`, `testkit`, `spec`, `telemetry`, `db`, `ui`, `server`, `play`, `site`, `console`, `cli`), or `repo` (monorepo tooling), `ci`, `deps`, `docs`. The scope is optional. The list is in `commitlint.config.js`.
- One PR = one topic. The PR template asks for the rules touched, the tests added and the impact on the protocol or the log format.
- Versioning: packages stay private to the monorepo. Formats that leave the repo (protocol, log, codex snapshot) have their own version number, incremented on every breaking change.

## Documentation

- A contract change (public types, protocol, log format, metric, health endpoint) updates the corresponding doc in the same PR.
- An architecture decision goes through an ADR (`docs/decisions/`, template in the folder's `README.md`).
- An ambiguous rule goes into `docs/rules/questions.md`, with the number, the question, the sources consulted and the provisional decision.
