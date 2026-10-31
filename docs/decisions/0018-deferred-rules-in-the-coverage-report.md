# ADR 0018 — Deferred rules in the coverage report

**Status**: Accepted
**Date**: 2026-10-31

## Context

ADR 0008 gives each rule of the Core Rules one of six statuses: `covered`, `exercised`, `uncovered`, `stale`, `not-applicable`, `question`. Each milestone of the roadmap is accepted when "every rule of the sections above is `covered`".

The sections of a milestone hold rules that the milestone cannot test. M2 plays units without abilities, but its sections (104–118, 160–168, 315–324, 341–359, 447–474, …) also hold the chain, spells, targeting, cost modifications, hidden cards, gear, and the multiplayer and team modes. On 2026-10-31, 607 rules were in the M2 sections and 139 were covered. Among the 468 others:

- some were implemented and only lacked a scenario;
- most depend on something a later milestone brings: they cannot be `covered` before it;
- some apply only to multiplayer or team modes, which no milestone plans.

With the six statuses, these last two groups are `uncovered`, like a rule we forgot. The report cannot tell "not done yet, on purpose" from "missed", and the acceptance criterion of a milestone cannot be met.

## Decision

1. A seventh status, `deferred`: a rule that depends on something a later milestone brings. Precedence for a rule without a passing scenario: `question`, then `not-applicable`, then `deferred`, then `exercised` or `uncovered`.
2. The deferred rules are listed in `docs/rules/deferred.json`, like `not-applicable.json`: `{ "rules": [{ "number": "…", "milestone": "M3", "reason": "…" }] }`. `milestone` is a roadmap milestone (`M3` to `M9`), or `unplanned` for what no milestone plans yet (multiplayer and team modes). The reason says what is missing, concretely ("needs the chain", "Ganking is a keyword (810)").
3. A rule is added to the list only after its text was read in the PDF and judged, never by default, as for `not-applicable`. A lead-in rule ("the following tasks become outstanding") whose list holds a deferred item is deferred too: a scenario could only check part of it.
4. The report flags as problems (CI failure) a rule listed both as `not-applicable` and `deferred`, a listed rule that a scenario covers, and a listed number that does not exist in the current version. The note of a deferred rule in the report is `<milestone>: <reason>`; the Markdown summary counts them.
5. The acceptance criterion of a milestone becomes: every rule of its sections is `covered`, `not-applicable`, `question` (with an open entry in `questions.md`) or `deferred` to a later milestone. Each milestone starts by taking back the rules deferred to it.

## Consequences

- The report says, for each rule, whether it is tested, or why not and until when. A milestone can be closed without pretending its sections are fully tested.
- Each milestone has a list of rules to pick up: `deferred.json` filtered by its name. When a rule gets its scenario, it must leave the list, or the report fails.
- Risk: deferring to avoid writing a test. The guard is the same as for `not-applicable`: every entry is read, has a concrete reason, and is reviewed in the PR.
- `unplanned` rules stay visible: they are the work a multiplayer mode would bring.
- The coverage contract changes: `RuleStatus`, `CoverageInput` (`deferred`), `CoverageProblems` (`misclassified`), and the docs that list the statuses (`06-testing.md`, `rules/README.md`).

## Rejected alternatives

- **Putting these rules in `not-applicable.json`**: they do apply to the engine, later. The report would lose them, and nothing would bring them back.
- **Leaving them `uncovered`**: the report mixes forgotten rules with planned ones, and no milestone can meet its criterion.
- **Mapping each section to a milestone in the roadmap**: too coarse. One section mixes rules of several milestones (349–359 holds playing a unit, M2, and targeting, M3).
- **Writing partial scenarios that quote the deferred rules**: a scenario would claim a rule it does not check (ADR 0008).
