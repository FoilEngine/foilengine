# docs/rules — The official rules

This folder holds Riftbound's official rules documents. **They are authoritative** for the whole engine.

## Source hierarchy

When two sources disagree, the higher one wins:

1. Card text, including official errata.
2. The Core Rules PDF.
3. Official FAQ and rulings.
4. The Tournament Rules (formats and deckbuilding).
5. Our docs (`docs/`).

Our docs are only a reading map. When they conflict with the PDF, the PDF is right: fix the doc, and never write code from the doc. Unofficial sources (riftboundfaq.com, guides, Discord) settle nothing. When the PDF is ambiguous, open a question in `questions.md`.

## Version identifiers

A Core Rules version is identified by `CR-<last update date>`, taken from the "Last Updated" line of the PDF. The current version is **`CR-2026-10-09`**. Riot's file names use release labels (`RUP5`); they are kept here as aliases only. The engine's `rulesVersion`, the rule index (`index/CR-2026-10-09.json`) and the question entries use the `CR-` identifier.

## Expected files

Downloaded from the official Rules Hub (playriftbound.com, Rules Hub section) and placed here, keeping the version in the name:

| File | Content |
| --- | --- |
| `core-rules-2026-10-09.pdf` | Core Rules in force, updated 2026-10-09. Identifier: **`CR-2026-10-09`** (Riot alias: `RUP5`, from the official file name `RiftboundCoreRulesRUP5_En_EN.pdf`) |
| `tournament-rules-2026-08-27.pdf` | Tournament Rules in force, updated 2026-08-27 (tournament deck construction, formats, sideboard). Official file: `RiftboundTournamentRulesRUP5_en_EN.pdf` |
| `faq/*.pdf` or `faq/*.md` | Official FAQ per set |
| `errata/*.md` | Official errata, copied with their source |

Previous versions stay in `archive/`: they are used to replay old replays and to compare texts.

## Index

`foil rules index` reads the PDF and produces `index/<version>.json`: one entry per rule with its number, its title, its text and a fingerprint of the text. It is the basis of the rule coverage report (see `docs/06-testing.md`).

## New version of the Core Rules

Use `/rules-update <version>`:
1. add the new PDF and archive the old one;
2. re-index;
3. compare the two indexes: rules added, removed, renumbered, with changed text;
4. the tests of the changed rules become `stale`;
5. write a summary of the changes in `changes/<version>.md`;
6. review and update every `stale` test, then move the engine's `rulesVersion` to the new version.

Riot also publishes rules patch notes: quote them in `changes/<version>.md`.

## Open questions

Every ambiguous, contradictory or missing rule goes into `questions.md`. We never guess.
