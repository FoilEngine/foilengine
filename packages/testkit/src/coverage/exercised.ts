// Rules exercised by playing: the rules quoted by the events of random games.
// In M1 the games stop after setup; the M2 fuzzer will play them to the end.

import { apply, createGame, legalActions, pendingDecision } from '@foilengine/rules';
import type { GameEvent, Seed } from '@foilengine/types';
import { testSetup } from '../cards/test-cards.ts';

export function exercisedRules(games = 25): Set<string> {
  const rules = new Set<string>();
  const record = (events: readonly GameEvent[]) => {
    for (const event of events) if (event.rule !== null) rules.add(event.rule);
  };
  for (let game = 0; game < games; game++) {
    const created = createGame(testSetup({ distinctDecks: true }), `exercise-${game}` as Seed);
    if (!created.ok) throw new Error(`Test setup refused: ${JSON.stringify(created.problems)}`);
    record(created.events);
    let state = created.state;
    let turn = 0;
    for (
      let decision = pendingDecision(state);
      decision !== null;
      decision = pendingDecision(state)
    ) {
      const actions = legalActions(state, decision.player);
      const action = actions[(game * 7 + turn++) % actions.length];
      if (action === undefined) break;
      const result = apply(state, action);
      record(result.events);
      state = result.state;
    }
  }
  return rules;
}
