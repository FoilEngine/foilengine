# Fuzzer reproductions

`pnpm fuzz` writes here the reproduction of a broken invariant (docs/06-testing.md), shrunk by fast-check:

- `<invariant>-<seed>.foilreplay`: the game up to the step where the invariant broke, in the replay format of `@foilengine/log` (docs/02-game-model.md, Replays).
- `<invariant>-<seed>.json`: the invariant, its message, the step, the fuzz seed, and the fuzz case (game seed, policy, choices) that plays the game again with `playFuzzGame`.

To investigate: `/investigate-replay packages/testkit/repros/<file>.foilreplay`. Once the bug is fixed and covered by a scenario, delete the files, or keep the replay as a reference replay if the interaction is interesting.
