// Playing a card (349–359): units and spells, from the hand or, for the Chosen Champion, from
// the Champion Zone (108.3.d). The play process puts the card on the Chain (354), makes its
// choices (355), pays its cost (356, 357), checks legality (358), then finalizes it (359).
// A unit then resolves at once (337.2, 359.2); a spell waits on the Chain (359.3).

import type {
  CardDefinition,
  GameState,
  IllegalReason,
  ObjectId,
  PlayCard,
} from '@foilengine/types';
import { addToChain, finalize, givePriorityToNewest, removeFromChain } from '../chain/chain.ts';
import { cleanup } from '../cleanup/cleanup.ts';
import {
  type Draft,
  draftOf,
  emit,
  objectOf,
  playerOf,
  renewObject,
  stateOf,
  updateObject,
} from '../draft.ts';
import { isValidTarget } from '../effects/targets.ts';
import { EngineInvariantError, IllegalActionError } from '../errors.ts';
import { payCost, useRunes } from '../resources/payment.ts';

const illegal = (
  code: IllegalReason['code'],
  message: string,
  rule: IllegalReason['rule'],
): IllegalReason => ({ code, message, rule });

/**
 * 358.4: may the card be played in the current state of the turn? Read from the state before the
 * card was put on the Chain, the one it was played in.
 * - Closed State (a Chain exists): only with Reaction (309.1.a, 813.1.c.1).
 * - Showdown State: only with Action or Reaction (308.1.a, 806.1.c.1, 813.1.b).
 * - Neutral Open State: any card, by the Turn Player (310.1.a, 155); the decision checks it.
 */
export function timingProblem(state: GameState, definition: CardDefinition): IllegalReason | null {
  const keywords = definition.keywords ?? [];
  if (state.chain !== null && !keywords.includes('reaction')) {
    return illegal('wrong-timing', `${definition.name} has no Reaction: not on a Chain`, '309.1.a');
  }
  if (state.showdown !== null && !keywords.includes('action') && !keywords.includes('reaction')) {
    return illegal(
      'wrong-timing',
      `${definition.name} has neither Action nor Reaction: not during a Showdown`,
      '308.1.a',
    );
  }
  return null;
}

/**
 * Plays the card on the draft. Returns why it is illegal, if it is; the draft is then to be
 * dropped. With `checkOnly`, stops once legality is decided (step 5, 358): what follows cannot
 * make the play illegal, and legalActions checks many candidate plays.
 */
function playCard(
  draft: Draft,
  state: GameState,
  action: PlayCard,
  checkOnly = false,
): IllegalReason | null {
  const player = playerOf(draft, action.player);
  const from = player.zones.hand.includes(action.card)
    ? 'hand'
    : player.zones.championZone.includes(action.card)
      ? 'championZone'
      : null;
  if (from === null) {
    return illegal(
      'card-not-playable',
      `${action.card} is not in ${action.player}'s hand or Champion Zone`,
      '108.3.d',
    );
  }
  const definition = state.cards[objectOf(draft, action.card).card] as CardDefinition;
  if ((definition.category !== 'unit' && definition.category !== 'spell') || !definition.cost) {
    return illegal(
      'card-not-playable',
      `${definition.name} is a ${definition.category}: only units and spells can be played yet`,
      null,
    );
  }

  // Step 1 (354): the card goes on the Chain, Pending.
  const targets = action.targets ?? [];
  const item = addToChain(draft, action.player, action.card, from, targets);

  // Step 2 (355): choices. A unit chooses where it enters (355.2): the base, or a battlefield
  // its player controls (355.2.a). A spell has no location; it chooses its targets (355.5).
  const location = action.location;
  let battlefield: ObjectId | null = null;
  if (definition.category === 'unit') {
    if (location === undefined) {
      return illegal('invalid-location', 'Choose where the unit enters', '355.2');
    }
    if (location.kind === 'battlefield') {
      const target = draft.battlefields.find((b) => b.object === location.battlefield);
      if (target?.controller !== action.player) {
        return illegal(
          'invalid-location',
          'A unit enters your base or a battlefield you control',
          '355.2.a',
        );
      }
      battlefield = target.object;
    }
  } else if (location !== undefined) {
    return illegal('invalid-location', 'A spell does not enter the board', '355.2');
  }
  const specs = definition.targets ?? [];
  if (targets.length !== specs.length) {
    return illegal(
      'invalid-target',
      `${definition.name} needs ${specs.length} target(s), ${targets.length} given`,
      '355.8',
    );
  }

  // Steps 3 and 4 (356, 357): the total cost is the printed cost (no modifier yet); runes add
  // resources first (357.1.a), then the pool pays it (357.1).
  const runes = useRunes(draft, state, action.player, action.payment);
  if (runes !== null) return runes;
  const paid = payCost(draft, action.player, definition.cost);
  if (paid !== null) return paid; // 358.2

  // Step 5 (358): check legality. Targets (358.1, 355.9), timing (358.4). If a check fails,
  // the whole play is undone (358.5): the caller drops the draft.
  for (const [index, spec] of specs.entries()) {
    const target = targets[index] as ObjectId;
    if (!isValidTarget(draft, spec, target, action.player)) {
      return illegal('invalid-target', `${target} is not a valid target`, '355.9');
    }
  }
  const timing = timingProblem(state, definition);
  if (timing !== null) return timing;
  if (checkOnly) return null;

  // Step 6 (359): finalize.
  finalize(draft, item);
  if (definition.category === 'unit') enterBoard(draft, action, item, from, battlefield);
  else givePriorityToNewest(draft); // 359.3.a, 337.4
  // Steps were taken with the state Closed; a cleanup follows (319.4, 319.6).
  cleanup(draft);
  return null;
}

/**
 * 337.2, 359.2: a finalized unit resolves at once: it leaves the Chain and enters the board
 * exhausted at the chosen location (359.2.c), as a new object (124). If it was the only item,
 * the Chain ends (330); otherwise the controller of the newest item gains Priority again.
 */
function enterBoard(
  draft: Draft,
  action: PlayCard,
  item: ObjectId,
  from: 'hand' | 'championZone',
  battlefield: ObjectId | null,
): void {
  removeFromChain(draft, item);
  const unit = renewObject(draft, item);
  updateObject(draft, unit.id, { exhausted: true });
  if (battlefield === null) playerOf(draft, action.player).zones.base.push(unit.id);
  else {
    const target = draft.battlefields.find((b) => b.object === battlefield);
    if (target === undefined) throw new EngineInvariantError(`Unknown battlefield ${battlefield}`);
    target.units.push(unit.id);
  }
  emit(draft, {
    type: 'CardPlayed',
    rule: '359.2.c',
    visibility: { kind: 'public' },
    player: action.player,
    object: unit.id,
    previousObject: action.card,
    card: unit.card,
    from,
    battlefield,
  });
  givePriorityToNewest(draft);
}

export function checkPlayCard(state: GameState, action: PlayCard): IllegalReason | null {
  return playCard(draftOf(state), state, action, true);
}

export function applyPlayCard(
  state: GameState,
  action: PlayCard,
): { state: GameState; events: Draft['events'] } {
  const draft = draftOf(state);
  const reason = playCard(draft, state, action);
  if (reason !== null) throw new IllegalActionError(reason);
  if (draft.stage.kind === 'ended' && draft.winner === null)
    throw new EngineInvariantError('Game ended without a winner');
  return { state: stateOf(state, draft), events: draft.events };
}
