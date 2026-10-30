# 12 — Roadmap

Chaque jalon a des critères d'acceptation vérifiables. On ne passe au suivant que quand tous sont remplis. Les cases se cochent dans ce fichier au fil du travail.

L'ordre est dicté par les dépendances : le moteur d'abord, testé, puis tout ce qui s'appuie dessus. L'observabilité arrive tôt, parce qu'on construit dessus dès le premier serveur.

## M0 — Outillage

- [x] Monorepo pnpm + Turborepo, TypeScript strict (`tsconfig.base.json` : `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- [x] Biome (lint et format), Vitest, fast-check.
- [x] CI GitHub Actions : install, lint, typecheck, test, sur chaque PR et sur `main`.
- [x] Vérification des règles de dépendance entre packages (`01-architecture.md`) en CI.
- [x] Conventional Commits vérifiés (commitlint) et modèles d'issues et de PR.
- [x] Les PDF des Core Rules et des Tournament Rules dans `docs/rules/`.

**Accepté quand** : `pnpm install && pnpm lint && pnpm typecheck && pnpm test` passe en local et en CI sur un repo sans code métier.

## M1 — Modèle et squelette du moteur

- [ ] `types` : identifiants, `CardDefinition`, état, zones, actions, événements, vues, décisions.
- [ ] `rules` : RNG à graine sérialisable (xoshiro128** ou PCG) et ses tests.
- [ ] `rules` : `createGame` avec la mise en place complète (104–118), mulligan compris.
- [ ] `rules` : `viewFor` et le test de non-fuite.
- [ ] `testkit` : `board()`, `scenario()`, cartes de test, et l'indexation des Core Rules (`foil rules index`).
- [ ] `testkit` : rapport de couverture des règles (même vide).

**Accepté quand** : une partie se crée de façon déterministe à partir d'une graine, le mulligan est testé avec ses numéros de règles, et le rapport de couverture liste toutes les règles du PDF.

## M2 — Un jeu complet, cartes sans capacités

Le but : une vraie partie de bout en bout, avec des unités sans texte, des runes et des battlefields sans capacité.

- [ ] Le tour : début de tour (Awaken, Beginning avec scoring, Channel, Draw et Burn Out), phase principale, fin de tour (315–317).
- [ ] Le pool de runes, l'énergie et la puissance, le paiement et le paiement automatique (160–168).
- [ ] Jouer une unité (349–359, sans capacités).
- [ ] Le déplacement standard (144, 445+).
- [ ] Les cleanups à point fixe (318–324).
- [ ] Les showdowns sans sorts (341–348) et le combat (459–466).
- [ ] Tenir et conquérir, la règle du dernier point (467–472), la victoire (193–196), l'abandon (649).
- [ ] Le mode 1v1 (section des modes), avec ses particularités de premier tour (second joueur : 3 runes au premier tour, voir Q-001).
- [ ] `log` : format du journal, sérialisation, replay, empreinte d'état.
- [ ] Fuzzer et invariants (`06-testing.md`), 10 000 parties sans violation.
- [ ] Benchmarks du moteur et budgets en CI.

**Accepté quand** : 10 000 parties aléatoires vont au bout sans violation d'invariant, chaque règle des sections ci-dessus est `covered`, et le rejeu de chaque partie est déterministe.

## M3 — La chaîne, les capacités et les mots-clés

- [ ] La chaîne et le processus HOT FEPR (325–340), avec un nom par étape dans le code.
- [ ] Les sorts (153–159), le timing Action et Reaction (806, 813), les showdowns avec sorts.
- [ ] Les capacités passives, de remplacement, activées, déclenchées (360+), l'ordre des déclencheurs simultanés.
- [ ] Les couches (473–480) et `characteristics()`.
- [ ] Les équipements et l'attachement (147–152, 716).
- [ ] Les jetons (179–187).
- [ ] Le DSL de `cards` et un module par mot-clé de la section 800.
- [ ] Le mode manuel (`ManualOverride`).

**Accepté quand** : chaque mot-clé a ses scénarios, le fuzzer tourne avec des cartes de test couvrant tous les mots-clés, et les sections ci-dessus sont `covered`.

## M4 — Les vraies cartes

- [ ] `codex` : synchronisation Riftcodex, normalisation `CardDefinition` et `Printing`, snapshots, diff entre snapshots.
- [ ] Errata, bannissements, configuration des boosters (saisis à la main avec leurs sources).
- [ ] Validation de deck et import (liste texte, format Foil, codes des deckbuilders si documentés).
- [ ] Implémentation complète de deux decks champion (pool fermé), statut `complete` pour toutes leurs cartes.
- [ ] Rapport de couverture des cartes.

**Accepté quand** : deux decks champion s'affrontent sur 10 000 parties sans mode manuel ni violation d'invariant.

## M5 — Serveur, observabilité, console

- [ ] `telemetry` : logs Pino, métriques Prometheus, traces OpenTelemetry, erreurs GlitchTip.
- [ ] `infra/` : Docker Compose des dépendances et de la stack d'observabilité, tableaux de bord et alertes versionnés.
- [ ] `apps/server` : `/healthz`, `/readyz`, `/health/details`, `/metrics`, auto-test du moteur au démarrage.
- [ ] `protocol` et WebSocket : rejoindre, intention, événements filtrés, décision, refus, fin, resynchronisation, reprise après redémarrage.
- [ ] Salons privés et solo, comptes invités.
- [ ] `apps/cli` : `foil health`, `foil replay`, `foil scenario`, `foil rules coverage`, `foil codex sync`.
- [ ] Parcours synthétique et métrique associée.
- [ ] `apps/console` : santé, parties en cours, replays, règles (couverture et lanceur de scénarios), cartes, erreurs.

**Accepté quand** : `pnpm health` est vert sur la stack locale complète, une partie entre deux navigateurs se joue jusqu'au bout, un redémarrage du serveur en pleine partie la reprend sans perte, et la console affiche tout ce qui est listé dans `07-observability.md`.

## M6 — Le client de jeu

- [ ] `ui` : tokens synchronisés depuis `brand`, composants, son, motion.
- [ ] `apps/play` : table complète pilotée par les événements, decks, bibliothèque, replays.
- [ ] Rewind et forward, paiement automatique, contrôles de showdown, emotes.
- [ ] Tactile, clavier, lecteurs d'écran, `prefers-reduced-motion`.

**Accepté quand** : une partie complète se joue au clavier seul, sur mobile, et avec les animations réduites ; les tests Playwright couvrent un tour complet.

## M7 — L'IA

- [ ] Politiques `random`, `greedy`, `mcts` avec déterminisation.
- [ ] Explication des coups affichée dans le client.
- [ ] IA dans un Web Worker pour le mode hors ligne.
- [ ] Tournoi nocturne entre politiques et alerte de non-régression.

**Accepté quand** : `mcts` bat `greedy` dans au moins 70 % des parties sur le panel de decks, avec un budget de 2 secondes par coup.

## M8 — Simulations, point faible, sealed

- [ ] `sim` : jobs, workers, file, résultats avec intervalles de confiance.
- [ ] Point faible d'un deck et d'un coup.
- [ ] Sealed : ouverture de boosters fidèle à `booster-config.json`, construction depuis le pool.
- [ ] Matchmaking public (constructed et sealed, BO1 et BO3), spectateurs.

**Accepté quand** : une simulation de 10 000 parties entre deux decks rend un résultat reproductible avec son intervalle de confiance, et l'ouverture de boosters reproduit les taux configurés sur 100 000 tirages.

## M9 — Mise en production

- [ ] Repo privé `infra` : VPS, Compose, Caddy, déploiement par étiquette d'image, secrets chiffrés.
- [ ] Sauvegardes et test de restauration.
- [ ] Uptime Kuma externe et page de statut.
- [ ] `apps/site` avec la mention de Riot.
- [ ] Runbooks de toutes les alertes.

**Accepté quand** : la production passe `foil health --env prod`, une restauration de sauvegarde a été testée, et chaque alerte a son runbook.
