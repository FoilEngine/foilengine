---
description: Rejoue une partie, trouve où le moteur s'écarte des règles, écrit le test de régression
argument-hint: <chemin du fichier .foilreplay ou identifiant de partie>
---

Enquête sur la partie $ARGUMENTS.

1. Charge le replay avec `foil replay inspect $ARGUMENTS` : version des règles, version du moteur, decks, nombre d'actions, résultat, actions manuelles éventuelles.
2. Rejoue-le avec la version actuelle du moteur et compare l'empreinte d'état à chaque étape avec celle enregistrée. Signale la première divergence.
3. Si le signalement décrit une règle mal appliquée, trouve la première action où le comportement s'écarte du texte des Core Rules (cite le numéro exact).
4. Écris un scénario minimal qui reproduit le problème (le plus petit état et la plus courte suite d'actions possibles), avec le numéro de règle. Vérifie qu'il échoue.
5. Propose la correction, applique-la, vérifie que le scénario passe et que le reste des tests et le fuzzer passent toujours.
6. Si l'interaction est intéressante, ajoute le replay (réduit) aux replays de référence de `testkit`.
