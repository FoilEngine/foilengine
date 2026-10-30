---
description: Writes the test scenario or scenarios of a Core Rules rule
argument-hint: <rule number, e.g. 315.3>
---

Write the tests of rule $ARGUMENTS of the Core Rules.

1. Read the exact text of rule $ARGUMENTS and of its sub-rules in the PDF in `docs/rules/` (version in force). Also read the rules it references. The PDF wins over our docs.
2. Check in `docs/rules/questions.md` that there is no open question on this rule.
3. List the behaviors to test: the nominal case, each sub-rule, the edge cases (empty zone, insufficient resources, object changing zones, several players).
4. Write one scenario per behavior with the `@foilengine/testkit` harness (`docs/06-testing.md`), in `packages/spec/test/rules/<section>/`. Each title starts with `rule <exact number>:` and declares `rules: [...]`.
5. Use test cards (`test:*`) rather than real cards, unless the rule is about a specific card.
6. Run the tests. If they fail because the rule is not implemented, say so clearly: that is expected.
7. Run `pnpm test:rules` and give the rule's new status in the coverage report.

If the rule's text is ambiguous, do not invent: add an entry to `docs/rules/questions.md` and stop, explaining why.
