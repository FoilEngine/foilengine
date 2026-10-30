# ADR 0016 — Code license

**Status**: Accepted (2026-10-30)
**Date**: 2026-10-30

## Context

The `foilengine` repo is public. Without a license, nobody has the legal right to reuse the code.

## Decision

**AGPL-3.0-only** for all of Foil's code. The full text is in `LICENSE` at the root of the repo, and the root `package.json` declares `"license": "AGPL-3.0-only"`.

Any modified version, including one only hosted on a server, must publish its source code. This keeps forks open, which suits a free fan project; it is also the choice of OpenRift, another open-source Riftbound project.

## Consequences

- The license only covers Foil's code, never Riot's assets (card images, card backs, logos) nor the card data. The README says so.
- Contributions are accepted under the same license.
- A dependency with a license incompatible with AGPL-3.0 cannot be added.
- Moving to "AGPL-3.0-or-later" later remains possible for code we own.

## Rejected alternatives

- MIT: allows closed and commercial reuse, which fits poorly with a project that must stay free under Riot's policy.
- A source-available non-commercial license (e.g. PolyForm Noncommercial): consistent with Riot's constraint, but not open source in the strict sense, which discourages contributions.
