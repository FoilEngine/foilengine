# ADR 0002 — TypeScript strict partout

**Statut** : Accepté
**Date** : 2026-10-30

## Contexte

Le moteur manipule un état riche où une erreur de type devient un bug de règle silencieux.

## Décision

TypeScript partout (moteur, serveur, clients, outils), avec `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Identifiants marqués, unions discriminées et `switch` exhaustifs.

## Conséquences

Le moteur peut tourner dans le navigateur (mode hors ligne) et sur le serveur sans duplication.

## Alternatives écartées

Rust ou Go pour le moteur : plus rapides, mais on perdrait le partage avec le client et on doublerait les compétences nécessaires. À reconsidérer seulement si les benchmarks l'imposent.
