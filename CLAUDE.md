# CLAUDE.md — Foil Engine

Ce fichier est lu automatiquement par Claude Code. Il donne le contexte du projet et les règles de travail. Chaque package a aussi son propre `CLAUDE.md`, plus précis : lis-le dès que tu travailles dans ce package.

## Le projet

Foil Engine est un simulateur de Riftbound (le jeu de cartes de Riot Games) doté d'un vrai moteur de règles : il sait quels coups sont légaux, résout les effets et détecte la victoire. Par-dessus, une IA qui joue contre l'utilisateur et des simulations de matchups en masse. Projet de fan **gratuit**, soumis à la politique « Legal Jibber Jabber » de Riot (voir `docs/00-vision.md`).

## Lis avant de coder

| Si tu touches à… | Lis d'abord |
| --- | --- |
| N'importe quoi, la première fois | `docs/00-vision.md`, `docs/01-architecture.md`, `docs/13-conventions.md`, `docs/12-roadmap.md` |
| L'état de jeu, les actions, les événements | `docs/02-game-model.md` |
| Le moteur de règles | `docs/03-rules-engine.md`, et le PDF des Core Rules dans `docs/rules/` |
| Une carte ou un effet | `docs/04-cards-and-effects.md` |
| Les données de cartes | `docs/05-codex-data.md` |
| Les tests | `docs/06-testing.md` |
| Les logs, métriques, healthchecks, la console | `docs/07-observability.md` |
| Le serveur et le protocole | `docs/08-server-and-protocol.md` |
| L'IA et les simulations | `docs/09-ai.md` |
| Les clients et le design system | `docs/10-clients.md` (et le repo `FoilEngine/brand`) |
| Le déploiement | `docs/11-infra.md` |
| Un terme du jeu | `docs/14-glossary.md` |
| Les règles de dépendance, l'outillage, la CI | `docs/01-architecture.md`, `docs/decisions/0017-toolchain-repository-checks-and-m0-decisions.md` |
| Un choix d'architecture | `docs/decisions/` (un ADR au statut « Proposé » ne s'implémente pas avant validation) |

## Les règles qui ne se discutent pas

1. **Le moteur de règles est pur.** `@foilengine/rules` ne fait aucune entrée-sortie : pas de réseau, pas de fichier, pas d'horloge, pas de `Math.random`. Il ne dépend que de `@foilengine/types`. Tout aléatoire passe par le RNG à graine de l'état.
2. **Déterminisme.** Même état initial, même graine et mêmes actions donnent exactement la même partie, octet pour octet. Tout test qui échoue au rejeu est un bug.
3. **`apply` renvoie des événements.** Le journal d'événements est la source de vérité : replays, rewind, animations, sons, métriques et entraînement de l'IA en dérivent.
4. **Jamais d'information cachée chez un client.** Le serveur envoie `viewFor(state, player)`, jamais l'état complet. Un test vérifie que la vue d'un joueur ne contient ni la main ni le deck adverses.
5. **Aucune règle dans le client.** Le client affiche ce que le serveur lui dit et envoie des intentions. Toute légalité se décide dans `rules`.
6. **Chaque règle implémentée a son test, qui cite son numéro.** Forme : `it('rule <numéro exact des Core Rules>: second player channels 3 runes on their first turn')`, avec le vrai numéro lu dans le PDF. Pas de numéro, pas de merge.
7. **Ne jamais inventer une règle.** Si les Core Rules ne tranchent pas, ou si tu n'es pas sûr, écris le cas dans `docs/rules/questions.md` et signale-le. Ne devine pas.
8. **Pas d'assets Riot dans l'identité de Foil.** Les images de cartes s'affichent telles quelles, mais aucun logo ni marque de Riot dans le nom, le logo ou la communication.

## Source hierarchy

When sources disagree, the higher one wins:

1. Card text, including official errata.
2. The Core Rules PDF (`docs/rules/`, current version `CR-2026-10-09`).
3. Official FAQ and rulings.
4. The Tournament Rules (formats and deckbuilding).
5. Our docs (`docs/`).

Our docs are only a reading map. When they conflict with the PDF, the PDF is right: fix the doc, never write code from the doc. Unofficial sources (riftboundfaq.com, guides, Discord) settle nothing. When the PDF is ambiguous, open a question in `docs/rules/questions.md`. Details in `docs/rules/README.md`.

## Commandes

```bash
pnpm install            # dépendances (installe aussi le hook commit-msg)
pnpm dev                # tout en mode dev (turbo)
pnpm build              # build de tous les packages
pnpm test               # tous les tests
pnpm typecheck
pnpm lint               # biome (lint et format, en mode CI)
pnpm format             # biome : applique le formatage et les corrections sûres
pnpm check:deps         # règles de dépendance entre packages (docs/01-architecture.md)
```

Prérequis : Node 24 LTS (`.nvmrc`) ; la version de pnpm est fixée par `packageManager`.

Scripts pas encore créés, avec le jalon où ils arrivent (`docs/12-roadmap.md`) :

| Script | Rôle | Jalon |
| --- | --- | --- |
| `pnpm test:rules` | tests de règles et rapport de couverture des règles | M1 |
| `pnpm fuzz` | parties aléatoires avec vérification des invariants | M2 |
| `pnpm infra:up`, `pnpm infra:obs` | dépendances et stack d'observabilité locales (`infra/README.md`) | M5 |
| `pnpm dev:obs` | l'application avec la stack d'observabilité locale | M5 |
| `pnpm health` | healthcheck complet de l'environnement courant (voir docs/07) | M5 |

Ne crée pas un script avant son jalon. Quand tu le crées, ajoute-le dans le `package.json` racine et retire-le de ce tableau.

## Façon de travailler

1. Lis le ou les docs concernés et la tâche dans `docs/12-roadmap.md`.
2. Écris un plan court avant de coder si la tâche touche plus d'un fichier.
3. Écris les tests d'abord pour toute règle ou tout effet (le test cite la règle).
4. Implémente le minimum qui fait passer les tests.
5. Lance `pnpm typecheck && pnpm lint && pnpm test` avant de dire que c'est fini.
6. Mets à jour la doc si tu changes un contrat (types publics, protocole, format d'événement, métrique). Un changement d'architecture passe par un nouvel ADR (`/new-adr`).

**Définition de « fini »** : tests verts, typecheck et lint verts, doc à jour, aucune règle devinée, et la tâche cochée dans la roadmap.

## Commandes Claude Code du projet

Dans `.claude/commands/` :
- `/add-rule-test <numéro de règle>` : écrit le test d'une règle à partir des Core Rules.
- `/implement-card <nom ou id>` : implémente une carte de bout en bout (données, effet, tests, statut).
- `/rule-coverage` : rapport des règles couvertes, partielles ou manquantes.
- `/healthcheck` : lance les vérifications de santé et résume.
- `/investigate-replay <fichier>` : rejoue une partie, trouve l'action fautive, écrit le test de régression.
- `/new-adr <titre>` : crée une décision d'architecture.
- `/milestone-status` : où en est la roadmap.
- `/rules-update <version>` : intègre une nouvelle version des Core Rules et marque les tests à revérifier.

## Langue

On travaille en anglais. Tout ce qui est produit est en anglais : code, identifiants, commentaires, tests, commits, branches, PR, issues, messages de log, noms de métriques, interface, et toute nouvelle doc ou section de doc (ADR, runbooks, questions de règles, rapports).

Les docs existantes sont en français et ne doivent pas être traduites. Quand tu modifies une doc française existante, tu peux garder la langue de la section touchée ; tout nouveau fichier est en anglais.
