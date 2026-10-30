# 14 — Glossary

Game terms (English, as used in the code) and project terms.

## Game

| Term | Meaning | Core Rules |
| --- | --- | --- |
| Legend (Champion Legend) | The card that defines the deck and its domains, in the legend zone | 111, 173–176 |
| Chosen Champion | The chosen champion unit, placed in the champion zone at the start | 112 |
| Main Deck | The deck of playable cards | 101, 114 |
| Rune Deck | The 12 runes | 114, 161 |
| Battlefield | Location where units fight and that players control to score | 169–172 |
| Base | Each player's zone where their units and gear arrive | 107 |
| Domain | One of the six colors (Fury, Calm, Mind, Body, Chaos, Order) | 134 |
| Energy | Domainless resource, produced by exhausting a rune | 163 |
| Power | Domain resource, produced by recycling a rune | 163 |
| Rune Pool | Conceptual reserve of energy and power, emptied at each main phase and at the end of the turn | 165–167 |
| Might | A unit's strength | 137, 143 |
| Exhaust / Ready | Tap (exhaust) / untap (ready) | 315.1, 407+ |
| Recycle | Put a card at the bottom of its deck | 407+ |
| Channel | Put runes into play from the rune deck | 315.3 |
| Hold | Score by controlling a battlefield at the start of one's turn | 315.2, 467+ |
| Conquer | Score by taking control of a battlefield during one's turn | 467+ |
| Burn Out | Having to draw with an empty main deck | 315.4 |
| Showdown | Window where players take turns playing spells on a battlefield | 341–348 |
| Combat | Clash of opposing units on a battlefield | 459–466 |
| Chain | Temporary zone of the cards and abilities being resolved | 327–340 |
| Pending / Finalized | States of a chain item | 329 |
| HOT FEPR | The resolution process: Handle Outstanding Tasks, then Finalize, Execute, Pass, Resolve | 332–340 |
| Priority | Right to act at one's discretion | 312 |
| Focus | Right to act during an open showdown | 313 |
| Neutral / Showdown, Open / Closed | The two axes of the turn state | 307–310 |
| Cleanup | Automatic checks after state changes | 318–324 |
| Contested | Status of a disputed battlefield, which triggers a showdown | 323, 344 |
| Token | Game object created by an effect, which is not a card | 179–187 |
| Layer | Application order of continuous effects | 473–480 |
| Action / Reaction | Timing keywords of spells and abilities | 806, 813 |
| Overnumbered, Alt art, Signature, Ultimate | Collection treatments of a printing | — (see `05-codex-data.md`) |

Rule numbers come from Core Rules 1.4; they are re-checked against `CR-2026-10-09` with `/rules-update` at the start of M1.

## Project

| Term | Meaning |
| --- | --- |
| Engine, referee | `@foilengine/rules` |
| View | What a player is allowed to see (`viewFor`) |
| Intent | An action sent by a client, not validated yet |
| Log (journal) | The ordered sequence of a game's events |
| Replay | A replayable log with its seed and its decks |
| Fingerprint | Stable hash of a state, to check determinism |
| Scenario | A rule or card test written with the `testkit` harness, stored in `spec` |
| Invariant | Property checked at every step by the fuzzer |
| Manual mode | Resolving an unimplemented card by hand (`ManualOverride`) |
| Weak spot | Card or move that costs a deck the most wins |
| Codex snapshot | Frozen version of the card data |
