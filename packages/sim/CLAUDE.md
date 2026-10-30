# CLAUDE.md — packages/sim

Mass simulations, statistics, weak spot.

## Dependencies

- **Allowed**: `types`, `rules`, `cards`, `mind`, `log`.
- **Forbidden**: running jobs outside the workers in production.

## Public API

The job definition, its execution, the statistics (Wilson), the weak spot.

## Points of attention

- A simulation is reproducible (same seed, same results).
- Exclude or flag games with unimplemented cards or manual mode.

## Read

- `docs/09-ai.md`

The general project rules are in the root `CLAUDE.md`.
