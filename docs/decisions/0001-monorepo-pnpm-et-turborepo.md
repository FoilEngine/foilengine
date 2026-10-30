# ADR 0001 — Monorepo pnpm et Turborepo

**Statut** : Accepté
**Date** : 2026-10-30

## Contexte

Le moteur de règles est au centre de tout : serveur, IA, simulations, console et tests en dépendent. Un changement de règle ou de type doit pouvoir toucher tous les consommateurs dans un seul commit, testé en une seule CI.

## Décision

Un monorepo `foilengine` géré avec pnpm workspaces et Turborepo (cache des builds et des tests). Les packages sont privés au monorepo ; seuls les formats qui sortent (protocole, journal, snapshot codex) sont versionnés.

## Conséquences

Pas de publication de packages à synchroniser. Turborepo évite de tout reconstruire. En contrepartie, la CI doit rester rapide : on s'appuie sur le cache et sur l'exécution limitée aux packages touchés.

## Alternatives écartées

Plusieurs repos avec des packages publiés : trop lourd pour un projet qui bouge vite. Nx : plus complet mais plus lourd que nécessaire.
