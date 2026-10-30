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

`pnpm foil rules index` reads the most recent `core-rules-<date>.pdf` and writes `index/<version>.json` (`--check` only verifies that the committed file is up to date). The parser lives in `@foilengine/testkit` (`indexCoreRules`); the PDF is read by `apps/cli` with `unpdf`. It is the basis of the rule coverage report (see `docs/06-testing.md`).

Each entry has:

- `number`: the exact number as printed, without the trailing dot (`103`, `103.2.b.1`);
- `parent`: the enclosing rule (`103.2.b` for `103.2.b.1`), or `null`;
- `text`: the full text, continuation lines and examples included, whitespace collapsed;
- `fingerprint`: the first 16 hex characters of the SHA-256 of `text`, to detect rules whose text changed between two versions.

The PDF has no separate title field: a heading such as `104. Setup` is a rule whose text is the heading, so the index has no `title`. A rule is identified by its number; two rules can share a fingerprint when their texts are identical (`Battlefields` appears under several numbers).

The parser refuses an extraction that looks wrong: no "Last Updated" date, numbers that do not increase, or a sub-rule without its parent. The file name date must match the PDF's "Last Updated" date.

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
