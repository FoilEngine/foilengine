# ADR 0005 — Le journal d'événements est la source de vérité

**Statut** : Accepté
**Date** : 2026-10-30

## Contexte

Animations, sons, replays, rewind, statistiques, entraînement de l'IA et débogage ont tous besoin de savoir ce qui s'est passé, dans l'ordre.

## Décision

`apply` renvoie des événements typés, numérotés, avec la règle qui les a produits et leur visibilité. Le journal d'une partie (graine, decks, version des règles, actions, événements) est persisté et suffit à la reconstruire.

## Conséquences

Le client s'anime à partir des événements, jamais d'un diff d'état. Le format du journal est versionné.

## Alternatives écartées

Diffs d'état : impossibles à animer proprement et ne disent pas pourquoi l'état a changé.
