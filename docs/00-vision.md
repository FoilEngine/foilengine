# 00 — Vision and scope

## What Foil Engine is

A Riftbound simulator that **knows the rules**. Existing simulators (Rift Atlas, TCG Arena, Tabletop Simulator) are manual tables: players move cards and apply the rules themselves. Foil Engine knows which moves are legal, resolves the chain and the triggers, and detects victory. That makes possible what no other tool does:

1. **An AI opponent** that plays full games and explains its moves (scored evaluation).
2. **Mass simulations**: thousands of games between two decks to measure a matchup, with a confidence interval.
3. **The weak spot**: the AI identifies the cards or moves that cost a deck the most.
4. **Exact replays**, rewind and game notation, because everything is deterministic and logged.
5. **Puzzles** generated from real positions.

## Audiences

- **Competitive players**: test a deck against the AI or against meta lists, measure matchups.
- **Casual players**: play online with a referee that prevents rules mistakes.
- **Collectors and sealed players**: open boosters faithful to the real rates and build a deck from a pool.

## What it takes to match the market

The current reference is Rift Atlas. Its basic features become the expected minimum: quick matchmaking and private rooms (1v1, free-for-all, 2v2), deck import (list or code), solo mode, spectators, sealed, rewind and forward, automatic cost payment, showdown controls, conquer, tokens, counters, emotes, replays.

## Out of scope (for now)

- Alternate runes, tokens and runes as collectibles (they are still handled as game objects).
- Monetization, in any form (see legal constraints).
- A native mobile app. The web client must, however, work with touch.

## Legal constraints (non-negotiable)

Foil Engine is a fan project governed by Riot Games' "Legal Jibber Jabber" policy:

- **Free**: no paywall, subscription, paid content, crowdfunding or commercial entity.
- **Mandatory notice**, visible on the website and in the application: "Foil was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project."
- **No Riot logo or trademark in Foil's identity** (name, logo, communication). Official cards are displayed as they are, backs included.
- Riot may ask for the project to stop at any time: the architecture must make nothing irreversible for user data (export of decks and replays).

## Identity

The visual and sound identity lives in the `FoilEngine/brand` repo (logos, tokens, sounds, motion). The name is "Foil", and "Engine" is the descriptor. The brand rules are in `brand/04-design-system/README.md`.
