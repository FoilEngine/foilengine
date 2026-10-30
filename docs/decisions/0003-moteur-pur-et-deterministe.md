# ADR 0003 — Moteur pur et déterministe

**Statut** : Accepté
**Date** : 2026-10-30

## Contexte

Les replays, le rewind, les tests, le fuzzing, l'IA et la détection de bugs en production reposent tous sur la capacité à rejouer une partie à l'identique.

## Décision

`@foilengine/rules` ne fait aucune entrée-sortie, n'utilise ni l'horloge ni `Math.random`, et ne dépend que de `types`. L'aléatoire vient d'un PRNG à graine (xoshiro128** ou PCG) dont l'état est stocké dans `GameState`.

## Conséquences

Rejouer graine + actions redonne exactement la même partie. Toute divergence est un bug détectable automatiquement (fuzzer, rejeu de contrôle en production).

## Alternatives écartées

Aléatoire côté serveur passé en paramètre à chaque appel : plus fragile, et le rejeu dépendrait d'un fichier externe.
