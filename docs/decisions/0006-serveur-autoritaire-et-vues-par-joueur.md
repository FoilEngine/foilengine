# ADR 0006 — Serveur autoritaire et vues par joueur

**Statut** : Accepté
**Date** : 2026-10-30

## Contexte

Un jeu de cartes en ligne a de l'information cachée (main, deck). Envoyer l'état complet au client permet de tricher.

## Décision

Le serveur détient l'état complet, valide toute action avec le moteur, et n'envoie que `viewFor(state, player)` et les événements filtrés. Aucune règle dans le client.

## Conséquences

Un test vérifie qu'aucun message sortant ne contient d'information cachée au destinataire. L'IA utilise aussi `viewFor` : elle ne triche pas.

## Alternatives écartées

Logique dupliquée dans le client pour la réactivité : source de désynchronisations et de triche.
