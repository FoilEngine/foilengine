# 10 — Clients (`apps/play`, `apps/site`, `apps/console`, `@foilengine/ui`)

## Design system

The source of truth for the identity is the **`FoilEngine/brand`** repo: logos, tokens, sounds, motion, and the usage rules (`04-design-system/`). `@foilengine/ui` is its implementation:

- `tokens.css` and the TypeScript tokens generated from `brand/04-design-system/tokens.json` (sync script, never edited by hand);
- the components: Button, FoilSurface, GameCard, WeakPoint, then the table components;
- the **sound engine** (`brand/05-sons/foil-sound.js`, ported to TypeScript) and its sound catalog;
- the motion primitives: curves, durations, damped spring, gestures (lunge, parry, riposte, touch, return to guard, foil sheen, weak spot).

Key rules to follow (details in `brand`):
- Dark theme by default in the simulator, light on the website.
- Bodoni Moda only for the wordmark and the website headings; Inter Tight for the interface; JetBrains Mono for engine data.
- Foil is only used for the logo and for the moments when the AI acts.
- Official cards are displayed as they are (front and back). The design system only touches what surrounds them.
- `prefers-reduced-motion` respected everywhere; sound has its own switch and three levels (Full, Essential, Off).

## `apps/play`: the game client

- **Proposed stack** (ADR 0012): React, Vite, TypeScript, a light store (Zustand), table rendered in DOM and CSS (and canvas only if performance requires it).
- **Event-driven**: the table receives `game.events`, and each event triggers an animation and a sound defined in the design system. The displayed state is the last `game.snapshot` plus the events applied by the client to a copy of the view (projection), never a recomputed rule.
- Screens: home, room and matchmaking, deck import and management, card library, deckbuilder, sealed (booster opening, building from the pool), game table, replays, analysis and simulation results, settings (sound, motion, language).
- The table: two boards, battlefields, rune pool, hand, chain, log in notation, showdown controls (who has focus, pass), rewind and forward, automatic payment, emotes.
- **Targeting arrow**: whenever an action needs a target (a target of a spell or ability, the units that receive combat damage, a unit's destination), the player clicks the arrow handle on the source card; the arrow then follows the cursor (or the finger) and is dropped on a card or a battlefield on the table. Only the legal targets light up and accept the arrow: the client reads them from the engine (the pending `Decision`, such as `AssignDamage.targets`, or `legalActions`), it never computes them. Dropping elsewhere, or pressing Escape, cancels. Once the choices are complete, the client sends the intent and the server validates it with `isLegal`; a refusal shows the engine's reason. For combat damage (467.2.c), each arrow carries the amount assigned to its target. Alternatives with the same result: keyboard (Tab through the legal targets, Enter to confirm, Escape to cancel), long press on touch screens, and screen-reader labels naming the source and each target.
- **Touch** from the start (Rift Atlas does it): long press for a card's actions.
- **Languages**: English first, then French and Korean (translation files, no hard-coded strings).
- Offline mode against the AI: `rules`, `cards` and `mind` run in a Web Worker, from `src/offline/`.

## `apps/site`: the website

Static site (proposal: Astro). Pages: home (animated logo, what Foil does, screenshots), features, project status (card and rule coverage, published from the reports), legal notice with Riot's notice, link to the status page (Uptime Kuma). Sound off by default.

## `apps/console`

See `07-observability.md`. Same stack as `play`, for administrators only.

## Accessibility

Contrasts checked on both themes (already computed in `brand`), full keyboard navigation on the table, labels readable by screen readers for cards and zones, no information carried by color alone (rarity, weak spot, win and loss).
