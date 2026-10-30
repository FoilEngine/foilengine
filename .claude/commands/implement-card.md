---
description: Implémente une carte de bout en bout (données, effet, tests, statut)
argument-hint: <riftbound_id ou nom de la carte>
---

Implémente la carte $ARGUMENTS en suivant `docs/04-cards-and-effects.md`.

1. Trouve la carte dans le snapshot `codex` en vigueur : texte en vigueur (errata compris), type, coût, domaines, might, mots-clés. Affiche ces informations avant de commencer.
2. Identifie les règles et mots-clés concernés et relis-les dans `docs/rules/`. Cherche les rulings et FAQ officiels sur cette carte.
3. Écris les scénarios d'abord (`card <id>: …`), avec les cas limites : cible devenue illégale, carte qui quitte le plateau pendant la résolution, interaction avec un remplacement, choix multiples.
4. Implémente avec le DSL de `@foilengine/cards`. Si le DSL ne suffit pas, écris une implémentation sur mesure en n'utilisant que l'API d'effets, et justifie-la en commentaire.
5. Mets à jour le statut de la carte (`complete`, ou `partial` avec des notes précises) et ses `sources`.
6. Lance les tests de la carte, puis un fuzzing court avec la carte incluse dans les decks aléatoires.
7. Résume : statut, tests ajoutés, éventuelles questions de règles ouvertes.
