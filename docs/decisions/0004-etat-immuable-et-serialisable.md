# ADR 0004 — État immuable et sérialisable

**Statut** : Proposé
**Date** : 2026-10-30

## Contexte

L'état doit être rejouable, comparable (empreinte), envoyé sur le réseau et stocké.

## Décision

L'état est du JSON pur (pas de `Map`, de classe ni de fonction). `apply` ne modifie jamais l'état reçu. En interne, on utilise **Immer** pour écrire les transitions de façon lisible avec partage structurel.

## Conséquences

Comparaison et sérialisation simples. Coût d'Immer à mesurer avec les benchmarks : si c'est trop lent pour les simulations, passer à des mises à jour immuables écrites à la main sur les chemins chauds.

## Alternatives écartées

Mutation directe avec copie profonde : simple mais coûteux. Structures persistantes (Immutable.js) : pas du JSON pur.
