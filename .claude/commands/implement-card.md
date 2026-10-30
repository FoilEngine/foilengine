---
description: Implements a card end to end (data, effect, tests, status)
argument-hint: <riftbound_id or card name>
---

Implement the card $ARGUMENTS following `docs/04-cards-and-effects.md`.

1. Find the card in the `codex` snapshot in force: text in force (errata included), type, cost, domains, might, keywords. Show this information before starting.
2. Identify the relevant rules and keywords and re-read them in `docs/rules/`. Look for the official rulings and FAQ on this card. Card text (with errata) wins over the Core Rules.
3. Write the scenarios first (`card <id>: …`, in `packages/spec/test/cards/<set>/`), with the edge cases: target that became illegal, card leaving the board during resolution, interaction with a replacement, multiple choices.
4. Implement with the `@foilengine/cards` DSL. If the DSL is not enough, write a custom implementation that only uses the effect API, and justify it in a comment.
5. Update the card's status (`complete`, or `partial` with precise notes) and its `sources`.
6. Run the card's tests, then a short fuzzing run with the card included in the random decks.
7. Summarize: status, tests added, any open rule questions.
