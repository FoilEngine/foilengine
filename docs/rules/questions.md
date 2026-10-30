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

- **Rules**: 315.3, 115.2, game modes section
- **Version**: CR-2026-10-09 (question opened against CR-1.4)
- **Question**: rule 315.3 says the active player channels 2 runes. Play guides say the second player channels 3 on their first turn. Check in the PDF where and how this bonus is defined (first-turn adjustments in 115.2 or the 1v1 mode section), and whether it depends on the mode.
- **Sources consulted**: Core Rules 1.4 (315.3), unofficial play guides, maintainer confirmation.
- **Decision**: in 1v1, the first player channels 2 runes on their first turn, the second player channels 3. After that, 2 runes per turn for both. The test must quote the exact number of the rule that defines this bonus in the PDF (115.2 or the mode section); if it is not found, the test is marked `question` until it is.
- **Status**: resolved on behavior (2026-10-30, maintainer). Rule number to be confirmed in the PDF.
- **To do (CR-2026-10-09)**: the second player's bonus must be found in the new PDF. The numbers quoted above come from CR-1.4: in CR-2026-10-09, 315.3 is the "Channel Phase" heading, and 431.4.a is the rule saying a player channels two runes during the Channel Phase. Renumbering is done with `/rules-update` at the start of M1.
