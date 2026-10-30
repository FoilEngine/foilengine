# CLAUDE.md — apps/cli

The `foil` command-line tool.

## Dependencies

- **Allowed**: all packages.
- **Forbidden**: —

## Public API

`foil health`, `foil replay`, `foil scenario`, `foil rules index`, `foil rules coverage`, `foil cards coverage`, `foil codex sync`.

## Points of attention

- Readable output by default, `--json` for scripts, non-zero exit code on failure.
- `console` is allowed here (standard output is the interface); everywhere else logs go through `telemetry`.

## Read

- `docs/07-observability.md`
- `docs/06-testing.md`

The general project rules are in the root `CLAUDE.md`.
