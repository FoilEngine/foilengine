// Rules exercised by playing: the rules quoted by the events of random games, played to the
// end by the fuzzer (docs/06-testing.md). Invariants are the fuzzer's job: not checked here.

import { playFuzzGame } from '../fuzz/fuzz.ts';

export function exercisedRules(games = 25): Set<string> {
  const rules = new Set<string>();
  for (let game = 0; game < games; game++) {
    const result = playFuzzGame(
      { seed: `exercise-${game}`, policy: 'uniform', choices: [] },
      { invariants: [] },
    );
    if (result.violation !== null) {
      throw new Error(
        `Game exercise-${game}: ${result.violation.invariant}: ${result.violation.message}`,
      );
    }
    for (const rule of result.rules) rules.add(rule);
  }
  return rules;
}
