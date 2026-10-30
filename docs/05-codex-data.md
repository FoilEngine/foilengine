# 05 — Card data (`@foilengine/codex`)

`codex` fetches the card data, normalizes it and produces **versioned snapshots** used by the rest of the project. The engine never fetches data online.

## Sources

| Source | What it provides | What it does not provide |
| --- | --- | --- |
| **Riftcodex** (`api.riftcodex.com`, open API, no key) | Game data: name, type, supertype, rarity, domains, cost (energy, power), might, text (rich and plain), keywords, set, collector number, `riftbound_id`, artist, image, orientation, and three flags: `alternate_art`, `overnumbered`, `signature`. TCGplayer identifier. | Foil status, promos, prices |
| **TCGplayer catalog** (through the `tcgplayer_id` identifier) | Printings (normal or foil), catalog rarity (including "Showcase" and "Promo"), promo sets, prices | Reliable rules text |
| **Riot's official pages** (Rules Hub, errata, bans, FAQ) | Errata, banned cards, rulings | Structured data: entered by hand in `codex/data/manual/` |

The details of rarities, treatments and promos are documented in the `brand` repo (`04-design-system/cartes.md`). Summary useful for the code:

- The collector number carries the information: suffix `a` for an alt art, a number above the set total for an overnumbered, an asterisk for a signature, prefix `R` for a rune, `T` for a token.
- Ultimate (one card per set that has one) and Special Art have no flag: they are identified by name or by catalog rarity.
- Rares and epics are always foil in boosters.

## Normalized model

Two notions are kept apart:

- **`CardDefinition`**: the card **as a rule** (a single record for all printings of the same card): name, type, supertype, domains, costs, might, rules text in force, keywords, tags.
- **`Printing`**: a **printing** of that card: set, number, rarity, treatments (`alternateArt`, `overnumbered`, `signature`, `ultimate`, `specialArt`, `promo` with its origin, `metal`), available finishes (`normal`, `foil`), image, artist, external identifiers.

The engine only knows `CardDefinition`. The client and the collection use `Printing`. Two printings of the same card are strictly equivalent in play.

## Snapshots

- The `foil codex sync` command queries the sources, normalizes, validates (Zod) and writes `packages/codex/data/snapshots/<date>/<set>.json`, plus a `manifest.json` (version, sources, card counts, fingerprint).
- Snapshots are **committed**. Tests and simulations use a specific snapshot, never the network.
- A readable diff between two snapshots is produced at every sync (cards added, text changed, rarity changed): that is what signals an erratum to carry over into `cards`.

## Data entered by hand

In `packages/codex/data/manual/`:

- `errata.json`: card, date, old text, new text, source.
- `bans.json`: format, card, date, source.
- `booster-config.json`: booster composition and pull rates per set, with for each rate its source and whether it is official or estimated by the community (see `brand/04-design-system/cartes.md`).
- `rulings.json`: official rulings useful for tests.

## Deck validation

`codex` exposes `validateDeck(deck, format, snapshot)`: number of cards, legend, chosen champion, 12 runes, battlefields, domains allowed by the legend, maximum number of copies, banned cards. The exact rules are in section 101 of the Core Rules and in the Tournament Rules.

## Deck import formats

To support: text list (one line per card with a quantity), deck codes from the main deckbuilders (Piltover Archive, Riftbound.gg, Rift Atlas) if their format is documented, and a native Foil format in JSON. Each format has its tests with real examples.
