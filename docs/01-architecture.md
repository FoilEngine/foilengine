# 01 — Architecture

## Vue d'ensemble

```
                 ┌──────────────────────── apps ─────────────────────────┐
                 │ play (client)   site (vitrine)   console (admin)   cli │
                 └───────┬───────────────────────────────┬───────────┬───┘
                         │ WebSocket + HTTP (protocol)   │ HTTP      │
                 ┌───────▼───────────────────────────────▼───────────▼───┐
                 │                     apps/server                       │
                 │  rooms · matchmaking · auth · API · healthchecks      │
                 └──┬─────────────┬─────────────┬─────────────┬──────────┘
                    │             │             │             │
              ┌─────▼────┐  ┌─────▼────┐  ┌─────▼────┐  ┌─────▼─────┐
              │  rules   │  │   log    │  │   mind   │  │ db / queue│
              │ (arbitre)│  │ (journal)│  │   (IA)   │  │ (Postgres,│
              └─────┬────┘  └──────────┘  └─────┬────┘  │  Valkey)  │
                    │                           │       └───────────┘
              ┌─────▼────┐                ┌─────▼────┐
              │  cards   │                │   sim    │  ← workers
              │ (effets) │                │ (batch)  │
              └─────┬────┘                └──────────┘
              ┌─────▼────┐
              │  types   │   codex (données) → produit les définitions de cartes
              └──────────┘
```

Tout est en TypeScript strict dans un monorepo pnpm + Turborepo.

## Packages

| Package | Rôle | Dépend de |
| --- | --- | --- |
| `@foilengine/types` | Types partagés : identifiants, définitions de cartes, état, actions, événements, vues. Aucune logique. | rien |
| `@foilengine/rules` | Le moteur de règles. API : `createGame`, `legalActions`, `apply`, `outcome`, `viewFor`. Pur et déterministe. | `types` |
| `@foilengine/cards` | Le DSL des effets et l'implémentation de chaque carte, avec son statut. | `types`, `rules` (API d'effets uniquement, via `@foilengine/rules/effects`) |
| `@foilengine/codex` | Import des données de cartes (Riftcodex, catalogue TCGplayer), normalisation, snapshots versionnés. | `types` |
| `@foilengine/protocol` | Messages client-serveur, schémas Zod, versionnés. | `types` |
| `@foilengine/log` | Format du journal d'événements, sérialisation, replays, notation, rewind. | `types`, `rules` |
| `@foilengine/mind` | L'IA : politiques (aléatoire, heuristique, MCTS), déterminisation, évaluation. | `types`, `rules`, `cards` |
| `@foilengine/sim` | Simulations en masse, statistiques, intervalles de confiance, point faible. | `rules`, `cards`, `mind`, `log` |
| `@foilengine/testkit` | Le harnais de test (`board()`, `scenario()`, cartes de test), fuzzer, invariants, couverture des règles et des cartes, replays de référence. Jamais importé par du code de production. | `types`, `rules`, `cards`, `log` |
| `@foilengine/spec` | Les scénarios de règles et de cartes (tests uniquement). Rien ne dépend de lui. | `types`, `rules`, `cards`, `testkit` |
| `@foilengine/telemetry` | Logs, métriques, traces, healthchecks : primitives partagées. | rien de métier |
| `@foilengine/db` | Schéma de base de données, migrations, accès. | `types` |
| `@foilengine/ui` | Design system : tokens, composants, moteur de son, motion (source : repo `brand`). | rien de métier |

| App | Rôle |
| --- | --- |
| `apps/server` | Serveur de parties : salons, matchmaking, authentification, API, WebSocket, endpoints de santé et de métriques. Seul détenteur de l'état complet. |
| `apps/play` | Client de jeu : table, bibliothèque, deckbuilder, sealed, replays. |
| `apps/site` | Site vitrine, statique. |
| `apps/console` | Console d'administration et de monitoring (voir `07-observability.md`). |
| `apps/cli` | Outil en ligne de commande `foil` : santé, replays, scénarios, couverture, synchronisation des données. |

## Règles de dépendance

- `types` ne dépend de rien.
- `rules` ne dépend que de `types`. Aucune bibliothèque d'entrée-sortie, aucun accès à l'horloge, aucun `Math.random`.
- `cards` ne dépend que de `types` et de l'API d'effets exposée par `rules` au point d'entrée `@foilengine/rules/effects`.
- `spec` héberge les scénarios de règles et de cartes ; rien ne dépend de lui. `rules` et `cards` ne dépendent jamais de `testkit` (ce serait un cycle).
- Aucun package ne dépend d'une app.
- Les apps clientes (`play`, `site`, `console`) ne dépendent jamais de `rules` pour décider d'une légalité. `play` peut l'importer uniquement pour le mode hors ligne contre l'IA, en tournant dans un Web Worker, et seulement depuis `apps/play/src/offline/`.
- `testkit` n'est importé par aucun code de production : ni `server`, ni `console` (qui passe par l'API du serveur).
- `telemetry` est la seule porte vers les logs, métriques et traces : aucun `console` ailleurs que dans `scripts/` et `apps/cli` (dont la sortie standard est l'interface).

### How they are enforced

See ADR 0017. Two mechanisms, run by `pnpm lint`, `pnpm check:deps` and the CI:

1. **`scripts/check-deps.ts`** compares the `package.json` of every workspace package with the matrix in `scripts/lib/dependency-rules.ts`, which mirrors the table above: allowed internal dependencies (dev dependencies included), no dependency on an app, no third-party dependency in `types` or `rules`, `workspace:` protocol. pnpm refuses imports of undeclared packages, so checking the manifests is enough at package level. The one gap is the root dev tools (Vitest, fast-check), reachable from every package: Biome's `noUndeclaredDependencies` closes it for `src/` folders. Changing the matrix means changing this document in the same PR.
2. **Biome**, per folder (`biome.json`): `rules/src` is pure (no `Date`, `performance`, timers, `console`, `process`, `globalThis`, `Math.random`, Node modules, nor any import other than `@foilengine/types`), `types/src` imports nothing, `cards/src` only reaches `rules` through `@foilengine/rules/effects`, `play` only imports the engine from `src/offline/`, `console` is forbidden outside `scripts/` and `apps/cli`, and no `src/` folder imports an undeclared dependency.

The tests in `scripts/test/` prove that each rule fires where it should, and only there.

## Flux d'une action en ligne

1. Le client envoie une **intention** (`protocol`) : « jouer la carte X sur la cible Y ».
2. Le serveur la valide contre `legalActions(state)`. Une action illégale est refusée avec une raison lisible, et compte dans une métrique.
3. Le serveur appelle `apply(state, action)`, qui renvoie `{ state, events }`.
4. Les événements sont ajoutés au journal de la partie (`log`) et persistés.
5. Chaque client reçoit les événements **filtrés pour lui** et sa vue `viewFor(state, player)`.
6. Le client anime et sonorise à partir des événements, jamais à partir d'un diff d'état.

## Topologie d'exécution

- Un processus `server` (HTTP + WebSocket), sans état local durable : l'état des parties en cours vit en mémoire, avec un journal persisté pour reprendre une partie après redémarrage.
- Des **workers** pour les simulations et l'IA lourde, alimentés par une file de jobs.
- PostgreSQL pour les données durables (comptes, decks, journaux, résultats de simulations).
- Valkey (compatible Redis) pour les sessions, le pub/sub entre instances et la file de jobs.
- La stack d'observabilité (voir `07-observability.md`) à côté, en Docker Compose.

Les choix de stack sont proposés dans `docs/decisions/` et doivent être validés avant implémentation.
