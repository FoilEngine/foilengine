---
description: Écrit le ou les scénarios de test d'une règle des Core Rules
argument-hint: <numéro de règle, ex. 315.3>
---

Écris les tests de la règle $ARGUMENTS des Core Rules.

1. Lis le texte exact de la règle $ARGUMENTS et de ses sous-règles dans le PDF de `docs/rules/` (version en vigueur). Lis aussi les règles qu'elle référence.
2. Vérifie dans `docs/rules/questions.md` qu'il n'y a pas de question ouverte sur cette règle.
3. Liste les comportements à tester : le cas nominal, chaque sous-règle, les cas limites (zone vide, ressource insuffisante, objet qui change de zone, plusieurs joueurs).
4. Écris un scénario par comportement avec le harnais de `@foilengine/testkit` (`docs/06-testing.md`), dans `packages/rules/test/rules/<section>/`. Chaque titre commence par `rule <numéro exact>:` et déclare `rules: [...]`.
5. Utilise des cartes de test (`test:*`) plutôt que de vraies cartes, sauf si la règle concerne une carte précise.
6. Lance les tests. S'ils échouent parce que la règle n'est pas implémentée, dis-le clairement : c'est attendu.
7. Lance `pnpm test:rules` et indique le nouveau statut de la règle dans le rapport de couverture.

Si le texte de la règle est ambigu, n'invente pas : ajoute une entrée dans `docs/rules/questions.md` et arrête-toi en expliquant pourquoi.
