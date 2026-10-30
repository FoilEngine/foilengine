---
description: Replays a game, finds where the engine departs from the rules, writes the regression test
argument-hint: <path to the .foilreplay file or game id>
---

Investigate the game $ARGUMENTS.

1. Load the replay with `foil replay inspect $ARGUMENTS`: rules version, engine version, decks, number of actions, result, any manual actions.
2. Replay it with the current engine version and compare the state fingerprint at every step with the recorded one. Report the first divergence.
3. If the report describes a rule applied incorrectly, find the first action where the behavior departs from the text of the Core Rules (quote the exact number).
4. Write a minimal scenario that reproduces the problem (the smallest state and the shortest sequence of actions possible), with the rule number, in `packages/spec/test/rules/<section>/`. Check that it fails.
5. Propose the fix, apply it, check that the scenario passes and that the rest of the tests and the fuzzer still pass.
6. If the interaction is interesting, add the (shrunk) replay to the `testkit` reference replays.
