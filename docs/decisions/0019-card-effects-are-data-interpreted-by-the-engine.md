# ADR 0019 — Card effects are data interpreted by the engine

**Status**: Accepted
**Date**: 2026-10-31

## Context

M3 brings the chain, spells, abilities (360–407) and keywords (805–832). To resolve a spell or trigger an ability, the engine must know what the card does. Three accepted decisions constrain where that knowledge lives:

- `@foilengine/rules` depends only on `@foilengine/types` (CLAUDE.md rule 1, `docs/01-architecture.md`). It cannot import `@foilengine/cards`, which depends on `rules`.
- The state is pure JSON and the event log is the source of truth (ADR 0004, ADR 0005). A replay holds the setup, card definitions included, and must replay byte for byte (ADR 0003).
- Card effects are written in a typed DSL in `@foilengine/cards`, custom code being the justified exception (ADR 0007). `docs/04-cards-and-effects.md` adds that custom code "only uses the effect API exposed by `rules`", and that `cards` reaches `rules` through `@foilengine/rules/effects`.

None of them says how the engine, at run time, gets the effects of the cards of a game. That choice shapes the chain, the abilities, the replays, the AI workers and the server.

## Decision

1. **An ability is JSON data.** `@foilengine/types` defines the vocabulary of abilities and effects: `Ability` (passive, replacement, activated, triggered), its triggers, conditions, costs, targets, and effects made of atomic game actions (deal, draw, move, ready, exhaust, kill, heal, buff, recycle, banish, recall, channel, add, score, create a token…), plus keywords. `CardDefinition` gains `abilities` and `keywords`. All of it is plain JSON, like the rest of the state.
2. **The engine interprets that data.** `rules` resolves spells, activates and triggers abilities, applies replacement effects and continuous effects (layers) by reading `state.cards`. Each building block of the vocabulary has one interpreter in `rules`, with its rule numbers and its tests.
3. **`@foilengine/cards` builds the data.** It holds the DSL builders (`defineCard`, `triggered`, `on.played`, `deal`…), which return plain data, one file per card, and the status of each card. It depends on `types` only; `@foilengine/rules/effects` exports what helps check a definition (a validator of the vocabulary), not functions that change the state.
4. **No card-specific code in the engine.** A card that the vocabulary cannot express is `partial` or `missing` (manual mode, ADR 0009) until a new building block is added to the vocabulary, with its interpreter and tests. The "custom implementation" of ADR 0007 becomes "a new general building block": it is added when a card needs it, named after the mechanic, never after the card.
5. **The vocabulary is versioned.** A change of meaning of an existing building block is a new building block, or a migration; `STATE_VERSION` follows the changes of `CardDefinition`.

## Consequences

- A game is self-contained: its setup carries the effects of its cards as they were. A replay keeps replaying the same game after the card files change, and the server, the AI workers, the simulations and the browser (offline mode) all run the same data without loading card code.
- The engine stays pure and only depends on `types`. Determinism is checked once, in the interpreter, not card by card.
- The vocabulary grows with the cards: section 800 and the first champion decks (M4) will drive it. Some cards will wait for a building block; manual mode covers them meanwhile.
- `docs/04-cards-and-effects.md`, `docs/01-architecture.md` (what `cards` depends on and what `rules/effects` exports) and the `cards` and `rules` `CLAUDE.md` files change. ADR 0007 stays in force (a typed DSL in `cards`, statuses); this ADR replaces its "custom code" exception with point 4.
- Card definitions in the state grow. They are shared between states (structural sharing) and fingerprinted once per game (Merkle digests, ADR 0005 and `log`), so the cost stays small.

## Rejected alternatives

- **Card implementations as code, injected into the engine** (an engine instance created with a registry of card functions): the most flexible for odd cards. But a replay would depend on the card code of the day, not of the game; the AI workers and the browser would have to load the same code at the same version; and every card's function would have to be checked for purity and determinism.
- **Data, plus named custom handlers injected for the exceptions**: keeps both problems for the exceptions, and the exceptions are where bugs hide.
- **Card-specific code inside `rules`**: mixes the referee with the content, and makes `rules` grow with every set.
