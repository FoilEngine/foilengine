# Foil Engine

Simulateur et IA pour Riftbound, avec un vrai moteur de règles.

- **Arbitre** : le moteur sait quels coups sont légaux, résout la chaîne et les déclencheurs, et détecte la victoire.
- **Adversaire** : une IA qui joue contre toi et explique ses coups.
- **Analyse** : des milliers de parties simulées pour mesurer un matchup ou trouver le point faible d'un deck.

## Structure

```
apps/
  server/      serveur de parties (HTTP + WebSocket), API, healthchecks, métriques
  play/        client de jeu
  site/        site vitrine
  console/     console d'administration et de monitoring
  cli/         outil en ligne de commande `foil`
packages/
  types/       types partagés (état, actions, événements, vues)
  rules/       le moteur de règles, pur et déterministe
  cards/       les effets des cartes (DSL et implémentations)
  codex/       import et normalisation des données de cartes
  protocol/    messages client-serveur (schémas Zod)
  log/         journal d'événements, replays, notation
  mind/        l'IA
  sim/         simulations en masse et analyse
  testkit/     harnais de scénarios, fuzzing, invariants, couverture
  spec/        scénarios de règles et de cartes (tests uniquement)
  telemetry/   logs, métriques, traces, healthchecks
  db/          schéma et migrations
  ui/          design system (tokens, composants, son, motion)
scripts/       outillage du monorepo (vérification des dépendances)
infra/         docker compose local, monitoring, alertes, tableaux de bord
docs/          documentation (commencer par docs/00-vision.md)
```

## Démarrer

Node 24 LTS (`.nvmrc`) et pnpm, dont la version est fixée par `packageManager` (Corepack ou pnpm ≥ 9.7 basculent tout seuls).

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
```

La documentation de référence est dans `docs/`. Le fichier `CLAUDE.md` donne les règles de travail.

## Mention légale

Foil was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.
