# ADR 0008 — Tests de règles numérotés et couverture

**Statut** : Accepté
**Date** : 2026-10-30

## Contexte

Il faut pouvoir tester chaque règle et savoir lesquelles le sont.

## Décision

Chaque scénario cite le numéro exact de la règle des Core Rules. Les Core Rules sont indexées depuis le PDF, et un rapport donne pour chaque règle son statut (`covered`, `exercised`, `uncovered`, `stale`, `not-applicable`, `question`). Une règle ambiguë va dans `docs/rules/questions.md`, jamais devinée.

## Conséquences

On voit en permanence où en est le moteur, et une nouvelle version des Core Rules marque automatiquement les tests à revérifier.

## Alternatives écartées

Couverture de code seule : dit quelles lignes tournent, pas quelles règles sont respectées.
