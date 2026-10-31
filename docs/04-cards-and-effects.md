# 04 — Cards and effects (`@foilengine/cards`)

Implementing the effects of more than a thousand cards is the biggest job of the project. Adding a card must therefore be simple, safe and verifiable.

## Principle

- Cards are **data** written in a typed DSL: triggers, conditions, targets, atomic actions. No code. The DSL builds plain JSON, stored in the card definition, and the engine interprets it (ADR 0019): a game, and its replay, carry the effects of its cards.
- The vocabulary is defined in `@foilengine/types` (`effects.ts`); each building block has one interpreter in `rules`, with its rule numbers and its tests.
- A card that the vocabulary cannot express stays `partial` or `missing` (manual mode) until a new building block is added. A building block is named after the mechanic, never after a card: there is no card-specific code in the engine.

## The DSL (indicative shape)

```ts
defineCard('ogn-011-298', {
  keywords: ['Assault'],
  abilities: [
    triggered({
      when: on.played(self),
      effect: seq(
        target(unit({ controller: 'opponent', at: 'any' })),
        deal(2, 'target'),
      ),
    }),
    activated({
      cost: [exhaust(self), energy(1)],
      timing: 'action',
      effect: draw(1),
    }),
  ],
});
```

The DSL building blocks follow the sections of the Core Rules:

| Building block | Sections |
| --- | --- |
| Triggers (`on.played`, `on.attack`, `on.defend`, `on.conquer`, `on.hold`, `on.dies`, start or end of turn…) | triggered abilities (360+) |
| Passive abilities and continuous effects | 360+, layers 475+ |
| Replacement effects | 360+ |
| Activated abilities, costs, timing (Action, Reaction) | 360+, 806, 813 |
| Atomic actions (`deal`, `draw`, `move`, `ready`, `exhaust`, `kill`, `heal`, `buff`, `recycle`, `banish`, `recall`, `channel`, `add`, `score`, `createToken`…) | 408–446, 700+ |
| Targeting and selectors | playing a card (349+), untargetable (756) |
| Keywords | 800+ (one module per keyword) |

The exact list of keywords and their text are read in section 800 of the PDF. Each keyword has its module, its tests and its line in the coverage report.

## Status of each card

Each card has a status, stored with its implementation:

| Status | Meaning |
| --- | --- |
| `missing` | Not implemented. In a game, it switches to manual mode. |
| `partial` | Part of the effect works. The gaps are described in `notes`. |
| `complete` | Full effect, tests green. |
| `verified` | Complete, and checked against the official rulings and FAQ (links in `sources`). |

The card coverage report (`pnpm cards:coverage`) gives, per set and per legend, the percentage of cards that are `complete` or `verified`. The console displays it. A legend is "playable" when every card of its champion deck is at least `complete`.

## Adding a card (`/implement-card` workflow)

1. Get the card definition from the `codex` snapshot (exact text, cost, domain, might, keywords, errata in force).
2. Read the text and identify the relevant rules. When in doubt, search the official FAQ and record the question in `docs/rules/questions.md`.
3. Write the tests first, with the scenario harness (`06-testing.md`): one test per behavior, with the edge cases (illegal target, card leaving the board during resolution, interaction with a replacement…).
4. Write the implementation in the DSL, or custom if needed.
5. Update the status and the `sources`.
6. Check that the fuzzer still runs without invariant violations with the card included in the random decks.

## Manual mode

For a `missing` or `partial` card, the server offers the player to resolve the effect by hand: they describe what they do (free text) and apply the changes with allowed atomic actions (move, deal damage, draw…). The action is recorded as a `ManualOverride` in the log, with the card concerned. A game that contains manual actions is excluded from simulation statistics and from AI training data.

## Errata and banned cards

Errata change the rules text of a printed card. The implementation follows **the text in force**, and the applied errata version is recorded. The list of banned cards comes from `codex` and is checked at deck validation, depending on the format.
