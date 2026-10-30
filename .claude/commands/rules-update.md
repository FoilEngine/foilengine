---
description: Integrates a new version of the Core Rules
argument-hint: <version, e.g. CR-2026-10-09>
---

Integrate version $ARGUMENTS of the Core Rules, following `docs/rules/README.md`.

1. Check that the new PDF is in `docs/rules/`, named `core-rules-<date>.pdf`. Archive the old one in `docs/rules/archive/`.
2. Re-index (`foil rules index`) and compare with the previous index: rules added, removed, renumbered, with changed text.
3. Write `docs/rules/changes/$ARGUMENTS.md`: the list of changes, grouped by section, with their impact on the engine.
4. Mark the affected tests as `stale` and list them.
5. Update the rule numbers quoted in the docs (`docs/`, `CLAUDE.md` files, `docs/rules/questions.md`): the PDF wins over the docs.
6. Do not change the engine's `rulesVersion` until every `stale` test has been reviewed and updated.
