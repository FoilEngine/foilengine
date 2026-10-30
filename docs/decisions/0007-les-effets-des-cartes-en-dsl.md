# ADR 0007 — Les effets des cartes en DSL

**Statut** : Accepté
**Date** : 2026-10-30

## Contexte

Il y a plus de mille cartes. Les écrire toutes en code serait long, fragile et difficile à vérifier.

## Décision

Un DSL typé (déclencheurs, conditions, cibles, actions atomiques, mots-clés) dans `@foilengine/cards`. Le code sur mesure est l'exception justifiée. Chaque carte a un statut (`missing`, `partial`, `complete`, `verified`).

## Conséquences

L'ajout d'une carte devient surtout de la donnée, testable et contribuable par d'autres plus tard.

## Alternatives écartées

Tout en code : plus souple au début, ingérable à l'échelle.
