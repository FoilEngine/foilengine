# ADR 0020 — Choices during the resolution of a spell or ability

**Status**: Accepted
**Date**: 2026-10-31

## Context

When a spell or an ability resolves, its instructions are executed from top to bottom (158.1), and nothing else can be finalized or resolved meanwhile, triggered abilities included (158.3, 158.3.a). Today the engine runs all the instructions of a Chain item in one call (`executeInstructions`, `effects/instructions.ts`): every choice must have been made before, as targets when the item was finalized (355.5) or as a cost paid (383.3.b).

Some instructions ask a player to choose while they execute, from information that only exists at that moment:

- **Predict** (437): the player looks at the top card(s) of their Main Deck and chooses which to recycle, then the order of the rest (437.1, 437.1.a). Vision (817) is "When this is played, Predict".
- Later, among others: discarding a card of one's choice, choosing among revealed cards, choosing an Equipment for Weaponmaster (821.1.c), "you may" in the middle of an effect.

Constraints from accepted decisions:

- The state is pure JSON, and `apply` returns events (ADR 0003, ADR 0004, ADR 0005). A choice cannot be a callback or a pause in the code: it must be a state that waits, and an action that answers.
- A player's choice is a `Decision` (`packages/rules/CLAUDE.md`), answered by an `Action` that `isLegal` checks and `legalActions` lists (the AI and the fuzzer only play through them).
- Hidden information never reaches a client (ADR 0006): the cards a player looks at must be shown to that player only.

## Decision

1. **A resolution can wait.** The state gains `resolving`: `null`, or the resolution in progress: the Chain item being resolved, the index of its next instruction, what its later linked instructions need (359.3.e.14; the token played today, chosen objects later), and the pending choice. The item stays on the Chain until its resolution completes.
2. **An instruction that needs a choice stops the resolution.** The interpreter executes instructions from the stored index. An instruction that needs a choice does what comes before the choice (for Predict, looking at the cards), records the choice in `resolving.choice` and stops. Nothing else happens until the choice is made: no Priority, no triggered ability put on the Chain, no cleanup, no Task (158.3). `pendingDecision` returns the matching decision. The other players can only concede, as during any decision.
3. **One typed Decision and one typed Action per kind of choice.** For Predict: a `Predict` decision (the player, the cards they look at) and a `Predict` action (the cards recycled, the order of the others). The action is checked like any other (`isLegal`, legal choice, from that player), executed, then the resolution resumes at the next instruction. When the last instruction has run, the resolution completes as it does today (the item leaves the Chain, 340).
4. **What the player looks at stays theirs.** The decision is only in the view of the player who decides (`viewFor` already shows a decision to that player only). The events about the cards looked at are private to that player. The `no-leak` invariant allows a player to see the objects of their own pending choice, and nothing more.
5. **`legalActions` lists the choices.** For orders, at most a fixed number of them, as for the order of triggered abilities; `isLegal` accepts any valid one.

The first use is Predict, for Vision (817). Each later kind of choice adds its Decision, its Action and its interpreter under this decision, with no new ADR.

## Consequences

- `STATE_VERSION` increases (`resolving`); the `Decision` and `Action` unions grow with each kind of choice. `docs/02-game-model.md`, `docs/03-rules-engine.md` and the protocol (`docs/08-server-and-protocol.md`: new decisions to display, new intents) are updated with the first one.
- `executeInstructions` becomes resumable: it starts at an index and returns whether the resolution completed. Every caller (spells, activated and triggered abilities) handles a resolution that waits.
- Replays and determinism do not change in nature: the choice is an action in the log like any other.
- To watch: a game that ends during a choice (concession), an object looked at that leaves its zone before the choice is made (it cannot, since nothing else happens during the resolution), and the cost of listing orders when a player looks at many cards.
- Scenarios cover: a resolution that stops and resumes, the instructions after the choice, the privacy of the cards looked at (view and events), and determinism on replay.

## Rejected alternatives

- **Making the choice when the item is finalized, like targets**: impossible when the choice depends on what the resolution reveals (Predict looks at the cards first, 437.1).
- **Letting the engine choose** (never recycle, a fixed order): it plays a different game and takes the decision away from the player.
- **A callback or an asynchronous pause in the engine**: forbidden by the purity of the engine and the serializable state (ADR 0003, ADR 0004).
- **One Chain item per instruction**: players could respond between the instructions of a spell, which 158.3 forbids.
- **A single generic "choose" decision with a free-form payload**: weaker types and checks; one typed decision per kind of choice keeps `isLegal` and the client precise.
