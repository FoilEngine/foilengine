# CLAUDE.md — packages/ui

The design system: tokens, components, sound engine, motion.

## Dependencies

- **Allowed**: React, nothing domain-related.
- **Forbidden**: editing the tokens by hand (they are generated from the `brand` repo).

## Public API

CSS and TS tokens, components, `Sound`, motion primitives.

## Points of attention

- The source of truth is `FoilEngine/brand` (`04-design-system/`). Re-read its rules before creating a component.
- Respect `prefers-reduced-motion`; sound has its own switch and levels.

## Read

- `docs/10-clients.md`
- brand repo: 04-design-system/README.md, motion.md, sound.md, cartes.md

The general project rules are in the root `CLAUDE.md`.
