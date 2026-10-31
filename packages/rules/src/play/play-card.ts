// Playing a card (349–359): units and spells, from the hand or, for the Chosen Champion, from
// the Champion Zone (108.3.d). The play process puts the card on the Chain (354), makes its
// choices (355), pays its cost (356, 357), checks legality (358), then finalizes it (359).
// A unit then resolves at once (337.2, 359.2); a spell waits on the Chain (359.3).

import type {
  CardDefinition,
  Cost,
  GameState,
  IllegalReason,
  ObjectId,
  PlayCard,
  PlayerId,
} from '@foilengine/types';
import { trigger } from '../abilities/triggers.ts';
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
import { withDeflect } from '../effects/deflect.ts';
import { isValidTarget } from '../effects/targets.ts';
import { EngineInvariantError, IllegalActionError } from '../errors.ts';
import { payCost, useRunes } from '../resources/payment.ts';
import { settle } from '../tasks/tasks.ts';

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
export function timingProblem(
  state: GameState,
  definition: CardDefinition,
  ambush = false,
): IllegalReason | null {
  // 822.1.b: a unit with Ambush has Reaction while it is played to a battlefield where its
  // player controls units.
  const keywords = ambush
    ? ['reaction', ...(definition.keywords ?? [])]
    : (definition.keywords ?? []);
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
 * 822.1.b, 822.1.c: playing a unit with Ambush to a battlefield where `player` controls units: a
 * valid location for it (355.2.b), where it has Reaction.
 */
export function ambushes(
  state: GameState,
  definition: CardDefinition,
  player: PlayerId,
  location: PlayCard['location'],
): boolean {
  if (location?.kind !== 'battlefield' || definition.category !== 'unit') return false;
  if (!(definition.keywords ?? []).includes('ambush')) return false;
  const battlefield = state.battlefields.find((b) => b.object === location.battlefield);
  return battlefield?.units.some((unit) => state.objects[unit]?.owner === player) === true;
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
  const permanent = definition.category === 'unit' || definition.category === 'gear';
  if ((!permanent && definition.category !== 'spell') || !definition.cost) {
    return illegal(
      'card-not-playable',
      `${definition.name} is a ${definition.category}: only units, gear and spells can be played`,
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
      const ambush = ambushes(state, definition, action.player, location);
      if (target === undefined || (target.controller !== action.player && !ambush)) {
        return illegal(
          'invalid-location',
          'A unit enters your base or a battlefield you control',
          '355.2.a',
        );
      }
      battlefield = target.object;
    }
  } else if (definition.category === 'gear') {
    // 148.1.a.1, 149.2: gear can only be played to its player's base.
    if (location !== undefined && location.kind !== 'base') {
      return illegal('invalid-location', 'Gear can only be played to your base', '149.2');
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

  // Step 2 (355.1.a): whether to pay an optional additional cost: Accelerate (805).
  const accelerate = action.accelerate === true;
  const extra = accelerate ? accelerateCost(definition) : null;
  if (accelerate && extra === null) {
    return illegal('card-not-playable', `${definition.name} has no Accelerate`, '805.1.a');
  }
  if (extra !== null && 'code' in extra) return extra;

  // Steps 3 and 4 (356, 357): the total cost is the printed cost plus the additional costs paid
  // (356.2.b); runes add resources first (357.1.a), then the pool pays it (357.1).
  const runes = useRunes(draft, state, action.player, action.payment);
  if (runes !== null) return runes;
  // Deflect is a mandatory additional cost of the targets chosen (809.1.d, 356.2.a.2).
  const total = withDeflect(
    draft,
    action.player,
    extra === null
      ? definition.cost
      : {
          energy: definition.cost.energy + extra.energy,
          power: [...definition.cost.power, ...extra.power],
        },
    targets,
  );
  const paid = payCost(draft, action.player, total);
  if (paid !== null) return paid; // 358.2

  // Step 5 (358): check legality. Targets (358.1, 355.9), timing (358.4). If a check fails,
  // the whole play is undone (358.5): the caller drops the draft.
  for (const [index, spec] of specs.entries()) {
    const target = targets[index] as ObjectId;
    if (!isValidTarget(draft, spec, target, action.player)) {
      return illegal('invalid-target', `${target} is not a valid target`, '355.9');
    }
  }
  const timing = timingProblem(
    state,
    definition,
    ambushes(state, definition, action.player, location),
  );
  if (timing !== null) return timing;
  if (checkOnly) return null;

  // Step 6 (359): finalize.
  finalize(draft, item);
  // 149.1: gear enter ready.
  if (permanent) {
    enterBoard(
      draft,
      action,
      item,
      from,
      battlefield,
      accelerate || definition.category === 'gear',
    );
  } else givePriorityToNewest(draft); // 359.3.a, 337.4
  // Steps were taken with the state Closed; a cleanup follows (319.4, 319.6).
  cleanup(draft);
  return null;
}

/**
 * 805.1.b: the Accelerate cost is [1][C]: 1 Energy and 1 Power of the unit's domain
 * (805.1.b.1), or of any domain if it has none (805.1.b.2). A unit with several domains may pay
 * with any of them (135.2.e.6.c): a choice the cost model cannot express yet.
 */
function accelerateCost(definition: CardDefinition): Cost | IllegalReason | null {
  if (definition.category !== 'unit' || !(definition.keywords ?? []).includes('accelerate')) {
    return null;
  }
  const [domain, ...others] = definition.domains;
  if (others.length > 0) {
    return illegal(
      'not-implemented',
      'Accelerate on a unit with several domains is not implemented yet',
      '805.1.b.1',
    );
  }
  return { energy: 1, power: [domain ?? 'any'] };
}

/**
 * 337.2, 359.2: a finalized unit or gear resolves at once: it leaves the Chain and enters the
 * board at the chosen location (359.2.c), as a new object (124): a unit exhausted, gear ready. If
 * it was the only item, the Chain ends (330); otherwise the controller of the newest item gains
 * Priority again.
 */
function enterBoard(
  draft: Draft,
  action: PlayCard,
  item: ObjectId,
  from: 'hand' | 'championZone',
  battlefield: ObjectId | null,
  ready: boolean,
): void {
  removeFromChain(draft, item);
  const unit = renewObject(draft, item);
  // 143.4, 359.2.c: a unit enters exhausted, unless Accelerate was paid: then it enters ready,
  // a replacement of how it enters, not a readying (805.6).
  if (!ready) updateObject(draft, unit.id, { exhausted: true });
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
  // 383.4.a.2: its Play Effects trigger once it has entered the board.
  trigger(draft, 'played', [unit.id]);
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
  settle(draft);
  if (draft.stage.kind === 'ended' && draft.winner === null)
    throw new EngineInvariantError('Game ended without a winner');
  return { state: stateOf(state, draft), events: draft.events };
}
