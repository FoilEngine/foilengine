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
| `@foilengine/cards` | Le DSL des effets et l'implémentation de chaque carte, avec son statut. | `types`, `rules` (interfaces d'effets uniquement) |
| `@foilengine/codex` | Import des données de cartes (Riftcodex, catalogue TCGplayer), normalisation, snapshots versionnés. | `types` |
| `@foilengine/protocol` | Messages client-serveur, schémas Zod, versionnés. | `types` |
| `@foilengine/log` | Format du journal d'événements, sérialisation, replays, notation, rewind. | `types`, `rules` |
| `@foilengine/mind` | L'IA : politiques (aléatoire, heuristique, MCTS), déterminisation, évaluation. | `types`, `rules`, `cards` |
| `@foilengine/sim` | Simulations en masse, statistiques, intervalles de confiance, point faible. | `rules`, `cards`, `mind`, `log` |
| `@foilengine/testkit` | Scénarios de règles, fuzzer, invariants, couverture des règles et des cartes, replays de référence. | `rules`, `cards`, `log` |
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

Elles sont vérifiées en CI (dependency-cruiser ou équivalent) :

- `types` ne dépend de rien.
- `rules` ne dépend que de `types`. Aucune bibliothèque d'entrée-sortie, aucun accès à l'horloge, aucun `Math.random`.
- `cards` ne dépend que de `types` et des interfaces d'effets exposées par `rules`.
- Aucun package ne dépend d'une app.
- Les apps clientes (`play`, `site`, `console`) ne dépendent jamais de `rules` pour décider d'une légalité. `play` peut l'importer uniquement pour le mode hors ligne contre l'IA, en tournant dans un Web Worker.
- `telemetry` est la seule porte vers les logs, métriques et traces : aucun `console.log` ailleurs que dans les scripts.

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
