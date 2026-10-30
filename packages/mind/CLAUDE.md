# CLAUDE.md — packages/mind

The AI: policies, determinization, evaluation, explanations.

## Dependencies

- **Allowed**: `types`, `rules`, `cards`.
- **Forbidden**: accessing the full state: a policy only receives `viewFor`.

## Public API

The `Policy` interface and the `random`, `greedy`, `mcts` policies.

## Points of attention

- Every decision is reproducible (seeded RNG provided).
- Respect the time or simulation budget.
- Always return an explanation when the policy allows it.

## Read

- `docs/09-ai.md`

The general project rules are in the root `CLAUDE.md`.
