# ADR 0008 — Numbered rule tests and coverage

**Status**: Accepted
**Date**: 2026-10-30

## Context

We need to be able to test each rule and know which ones are tested.

## Decision

Each scenario quotes the exact Core Rules number of the rule. The Core Rules are indexed from the PDF, and a report gives each rule its status (`covered`, `exercised`, `uncovered`, `stale`, `not-applicable`, `question`). An ambiguous rule goes into `docs/rules/questions.md`, never guessed. ADR 0018 adds a seventh status, `deferred`, for rules that need a later milestone.

## Consequences

We always see where the engine stands, and a new version of the Core Rules automatically flags the tests to re-check.

## Rejected alternatives

Code coverage alone: it says which lines run, not which rules are respected.
