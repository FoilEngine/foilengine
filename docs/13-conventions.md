# 13 — Conventions

## Langue

- On travaille en **anglais**. Tout ce qui est produit l'est en anglais : code, identifiants, commentaires, tests, commits, branches, PR, issues, messages de log, noms de métriques, nouvelles docs (ADR, runbooks, questions de règles, rapports).
- Les docs existantes, écrites en français, ne sont **pas** à traduire. Un nouveau fichier de doc est en anglais.
- Interface du produit : anglais d'abord, avec des fichiers de traduction.
- Les termes de jeu reprennent le vocabulaire officiel anglais de Riftbound (legend, battlefield, rune, might, showdown, chain, focus…). On ne les traduit pas dans le code.

## TypeScript

- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Pas de `any` ; `unknown` puis validation.
- Modules ES, imports explicites avec extension quand la résolution l'exige.
- Pas de classes dans l'état de jeu : objets simples et fonctions pures. Les classes sont acceptées ailleurs (serveur, clients) quand elles simplifient.
- Les identifiants sont des types marqués (`type ObjectId = string & { readonly __brand: 'ObjectId' }`).
- Les unions discriminées (`type`) pour les actions, événements et messages, avec un `switch` exhaustif (`assertNever`).
- Les erreurs attendues sont des valeurs (`{ ok: false, reason }`) ; les exceptions sont réservées aux bugs et aux cas impossibles.
- Pas de dépendance ajoutée sans raison écrite dans la PR. Toute dépendance de `rules` ou `types` demande un ADR.

## Nommage

| Élément | Convention | Exemple |
| --- | --- | --- |
| Fichiers | kebab-case | `hot-fepr.ts` |
| Types, interfaces | PascalCase | `GameState` |
| Fonctions, variables | camelCase | `legalActions` |
| Constantes | SCREAMING_SNAKE_CASE | `DEFAULT_VICTORY_SCORE` |
| Événements | PascalCase au passé | `RuneChanneled` |
| Actions | PascalCase à l'impératif | `PlayCard` |
| Messages du protocole | `domaine.action` | `game.intent` |
| Métriques | `foil_` + snake_case | `foil_engine_apply_seconds` |

## Tests

- Les tests sont à côté de leur package dans `test/`, nommés `*.test.ts`. Les scénarios de règles sont dans `packages/rules/test/rules/<section>/`.
- Un scénario de règle commence par `rule <numéro>:`. Un scénario de carte par `card <id>:`.
- Pas de test qui dépend du réseau, de l'heure ou de l'ordre d'exécution.

## Git

- Branche principale : `main`, protégée. Tout passe par une PR, même en solo (la CI doit être verte).
- Branches : `feat/…`, `fix/…`, `rules/…` (implémentation de règles), `cards/…`, `docs/…`, `chore/…`.
- Commits : **Conventional Commits** avec le package en portée : `feat(rules): implement channel step (315.3)`, `fix(server): resync on sequence gap`, `test(rules): cover mulligan (117)`.
- Une PR = un sujet. Le modèle de PR demande les règles touchées, les tests ajoutés et l'impact sur le protocole ou le format du journal.
- Versionnement : les packages restent privés au monorepo. Les formats qui sortent du repo (protocole, journal, snapshot codex) ont leur propre numéro de version, incrémenté à chaque changement incompatible.

## Documentation

- Un changement de contrat (types publics, protocole, format du journal, métrique, endpoint de santé) met à jour la doc correspondante dans la même PR.
- Une décision d'architecture passe par un ADR (`docs/decisions/`, modèle dans `README.md` du dossier).
- Une règle ambiguë va dans `docs/rules/questions.md`, avec le numéro, la question, les sources consultées et la décision provisoire.
