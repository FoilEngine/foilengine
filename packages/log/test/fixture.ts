// A small 1v1 setup for the log tests. log cannot use testkit (testkit depends on log).

import { apply, createGame, legalActions, pendingDecision } from '@foilengine/rules';
import type {
  CardDefinition,
  CardId,
  GameSetup,
  GameState,
  PlayerId,
  Seed,
} from '@foilengine/types';
import { type Replay, recordAction, startReplay } from '../src/index.ts';

const card = (
  id: string,
  category: CardDefinition['category'],
  extra: Partial<CardDefinition> = {},
): CardDefinition => ({
  id: id as CardId,
  name: id,
  category,
  supertypes: [],
  tags: [],
  domains: ['fury'],
  text: '',
  ...extra,
});

const units = Array.from({ length: 39 }, (_, i) =>
  card(`log:unit-${i + 1}`, 'unit', {
    cost: { energy: 1 + (i % 3), power: [] },
    might: 1 + (i % 4),
  }),
);
const definitions = [
  card('log:legend', 'legend'),
  card('log:champion', 'unit', {
    supertypes: ['champion'],
    cost: { energy: 3, power: [] },
    might: 3,
  }),
  card('log:rune', 'rune'),
  card('log:battlefield-1', 'battlefield'),
  card('log:battlefield-2', 'battlefield'),
  card('log:battlefield-3', 'battlefield'),
  ...units,
];

const deck = {
  legend: 'log:legend' as CardId,
  champion: 'log:champion' as CardId,
  mainDeck: ['log:champion' as CardId, ...units.map((u) => u.id)],
  runeDeck: Array.from({ length: 12 }, () => 'log:rune' as CardId),
  battlefields: ['log:battlefield-1', 'log:battlefield-2', 'log:battlefield-3'] as CardId[],
};

export const A = 'A' as PlayerId;
export const B = 'B' as PlayerId;

export const SETUP: GameSetup = {
  mode: '1v1-duel',
  rulesVersion: 'CR-2026-10-09',
  players: [
    { id: A, deck },
    { id: B, deck },
  ],
  cards: Object.fromEntries(definitions.map((d) => [d.id, d])),
};

/** Plays a game, picking actions by a fixed rule, never conceding; records its replay. */
export function playRecorded(
  seed: string,
  maxActions = 400,
): { replay: Replay; states: GameState[] } {
  const created = createGame(SETUP, seed as Seed);
  if (!created.ok) throw new Error('setup refused');
  let state = created.state;
  let recorded = startReplay(SETUP, seed as Seed, created);
  const states = [state];
  for (let i = 0; i < maxActions; i++) {
    const decision = pendingDecision(state);
    if (decision === null) break;
    const actions = legalActions(state, decision.player).filter((a) => a.type !== 'Concede');
    const action = actions[(i * 7 + seed.length) % actions.length];
    if (action === undefined) break;
    const result = apply(state, action);
    state = result.state;
    recorded = recordAction(recorded, action, result);
    states.push(state);
  }
  return { replay: recorded, states };
}
