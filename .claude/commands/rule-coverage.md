---
description: Rapport de couverture des règles des Core Rules
---

Lance `pnpm test:rules` et résume le rapport de couverture :

1. Le pourcentage de règles `covered`, `exercised`, `uncovered`, `stale`, `question` et `not-applicable`, globalement et par section (300, 318, 325, 341, 459, 467…).
2. Les règles `stale` à revérifier en priorité.
3. Les règles `uncovered` qui bloquent le jalon en cours de `docs/12-roadmap.md`.
4. Les questions ouvertes de `docs/rules/questions.md`.

Termine par les cinq prochaines règles à couvrir, dans l'ordre, avec la raison.
