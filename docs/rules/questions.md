# Open rule questions

One entry per question. An entry is never removed: it is marked resolved, with the source.

## Template

```markdown
### Q-NNN — Short title

- **Rules**: 431.4.a, 115
- **Version**: CR-2026-10-09
- **Question**: what is unclear, with an example situation.
- **Sources consulted**: Core Rules passages, official FAQ and rulings. Unofficial sources (RiftJudge, riftboundfaq.com, guides, Discord) may be listed but settle nothing (see the source hierarchy in `README.md`).
- **Provisional decision**: what the engine does meanwhile, and the test that encodes it (marked `question` in the coverage report).
- **Status**: open | resolved (date, official source)
```

## Questions

### Q-001 — Second player's extra runes on the first turn

- **Rules**: 115.2, 485.7, 487.7, 488.7, 489.7, 490.7, 491.7 (first quoted as 315.3 and 115.2 against CR-1.4)
- **Version**: CR-2026-10-09 (question opened against CR-1.4)
- **Question**: the active player channels 2 runes at the Channel Phase. Play guides say the second player channels 3 on their first turn. Where and how is this bonus defined, and does it depend on the mode?
- **Sources consulted**: Core Rules CR-2026-10-09: 315.3.b (channel 2 runes), 115.2 (first-turn adjustments are defined by the mode of play), 485.7 (every mode defines a First Turn Process), 487.7 to 491.7 (the First Turn Process of each sanctioned mode). Earlier: Core Rules 1.4, unofficial play guides, maintainer confirmation.
- **Decision**: it depends on the mode.
  - 1v1 Duel (487.7) and 1v1 Match (488.7): "The player going second channels an extra Rune from their Rune Deck during their first Channel Phase of the game." So 2 runes for the first player, 3 for the second on their first turn, then 2 per turn for both. This matches the maintainer's decision of 2026-10-30.
  - FFA3 (489.7), FFA4 (490.7) and 2v2 (491.7): "The player going first does not draw a card during their first Draw Phase of the game. The player going last channels an extra Rune from their Rune Deck during their first Channel Phase of the game."
  - Tests quote the rule of the mode under test (`rule 487.7: …` for 1v1).
- **Status**: resolved (2026-10-30, Core Rules CR-2026-10-09, rules 115.2, 485.7, 487.7–491.7).

### Q-002 — "All Game Objects in the Play Areas are Public" against private hands and secret decks

- **Rules**: 109, 109.1
- **Version**: CR-2026-10-09
- **Question**: 109 says "All Game Objects in the collective Play Areas are Public Information", and 109.1 that any player may view the face-up information of the cards in the Play Area. But 106 makes the Play Area all the zones, the Non-Board Zones included; 123 counts "Main Deck cards in any zone" among Game Objects; and 108.7.c makes the cards in a hand Private, 108.4.e and 108.5.d the order of the decks Secret. Read literally, 109 would make an opponent's hand public. Is "Play Area" in 109 meant as the Board only, or does 109 yield to the privacy of each zone (128)?
- **Sources consulted**: Core Rules CR-2026-10-09: 106, 107, 108.4.e, 108.5.d, 108.7.c, 109, 109.1, 109.2, 120–123, 128. No official FAQ or ruling found.
- **Provisional decision**: the engine applies the privacy of each zone (108.4.e, 108.5.d, 108.7.c, 128): hands are private to their owner, decks are secret to everyone. 109.2 (the state of game objects is public) is tested on the Board (`packages/spec/test/rules/105-zones/zones.test.ts`). The privacy tests (`privacy.test.ts`, the no-leak test and the fuzzer's `no-leak` invariant) encode it.
- **Status**: open
