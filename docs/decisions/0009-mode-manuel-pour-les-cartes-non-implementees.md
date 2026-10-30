# ADR 0009 — Mode manuel pour les cartes non implémentées

**Statut** : Accepté
**Date** : 2026-10-30

## Contexte

Le moteur n'implémentera pas toutes les cartes avant longtemps, mais les joueurs veulent jouer leurs decks.

## Décision

Une carte `missing` ou `partial` peut être résolue à la main par le joueur via `ManualOverride`, enregistré comme tel dans le journal. Ces parties sont exclues des statistiques et de l'entraînement de l'IA.

## Conséquences

Le simulateur est utilisable tôt, et les cartes les plus utilisées en mode manuel indiquent quoi implémenter en premier.

## Alternatives écartées

Bloquer les decks incomplets : le produit resterait inutilisable trop longtemps.
