# ADR 0010 — Stack serveur : Node 22, Fastify, WebSocket, Zod

**Statut** : Proposé
**Date** : 2026-10-30

## Contexte

Le serveur doit partager le moteur TypeScript, tenir des centaines de connexions WebSocket et être simple à opérer.

## Décision

Node.js 22, **Fastify** pour HTTP (plugins de santé, métriques et OpenTelemetry matures), **@fastify/websocket** (ws) pour le temps réel, **Zod** pour tous les schémas d'entrée et de sortie (`@foilengine/protocol`).

## Conséquences

Une seule stack. Si le nombre de connexions devient un problème, uWebSockets.js peut remplacer ws derrière la même interface.

## Alternatives écartées

Colyseus : framework de salons pratique, mais impose son modèle d'état synchronisé, contraire à l'ADR 0006. Hono : excellent, mais écosystème d'observabilité moins mûr que Fastify pour un serveur Node longue durée.
