# ADR 0012 — Clients : React et Vite, Astro pour la vitrine

**Statut** : Proposé
**Date** : 2026-10-30

## Contexte

Le client de jeu est une application riche et temps réel ; la vitrine doit être rapide et bien référencée.

## Décision

`apps/play` et `apps/console` : **React + Vite + TypeScript**, état local avec **Zustand**, rendu de la table en DOM et CSS (canvas seulement si nécessaire). `apps/site` : **Astro**, statique. `@foilengine/ui` partagé.

## Conséquences

Les animations et le son du design system sont déjà écrits en Web Animations et Web Audio : ils s'intègrent directement.

## Alternatives écartées

Next.js pour tout : SSR inutile pour un client de jeu derrière une connexion WebSocket. Un moteur de jeu (Pixi, Phaser) : à réserver à la table si les performances DOM ne suffisent pas.
