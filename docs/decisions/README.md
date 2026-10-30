# Décisions d'architecture (ADR)

Chaque décision structurante est consignée ici, une par fichier, numérotée.

## Statuts

- **Proposé** : en attente de validation par Alexandre. Ne pas implémenter avant.
- **Accepté** : en vigueur.
- **À décider** : question ouverte, aucune option retenue.
- **Remplacé par NNNN** : obsolète, garder le fichier pour l'historique.

## Créer un ADR

Utiliser `/new-adr <titre>`, ou copier ce modèle dans `NNNN-titre-court.md` :

```markdown
# ADR NNNN — Titre

**Statut** : Proposé
**Date** : AAAA-MM-JJ

## Contexte
Le problème, les contraintes, ce qui oblige à décider.

## Décision
Ce qu'on fait, précisément.

## Conséquences
Ce que ça change, ce que ça coûte, ce qu'il faudra surveiller.

## Alternatives écartées
Les autres options et pourquoi on ne les retient pas.
```

## Index

| N° | Titre | Statut |
| --- | --- | --- |
| 0001 | Monorepo pnpm et Turborepo | Accepté |
| 0002 | TypeScript strict partout | Accepté |
| 0003 | Moteur pur et déterministe | Accepté |
| 0004 | État immuable et sérialisable | Proposé |
| 0005 | Le journal d'événements est la source de vérité | Accepté |
| 0006 | Serveur autoritaire et vues par joueur | Accepté |
| 0007 | Les effets des cartes en DSL | Accepté |
| 0008 | Tests de règles numérotés et couverture | Accepté |
| 0009 | Mode manuel pour les cartes non implémentées | Accepté |
| 0010 | Stack serveur : Node 22, Fastify, WebSocket, Zod | Proposé |
| 0011 | Données : PostgreSQL, Drizzle, Valkey, BullMQ, authentification Discord | Proposé |
| 0012 | Clients : React et Vite, Astro pour la vitrine | Proposé |
| 0013 | Hébergement : un VPS, Docker Compose, Caddy | Proposé |
| 0014 | Observabilité : OpenTelemetry et la stack Grafana | Proposé |
| 0015 | Projet gratuit sous la politique Legal Jibber Jabber | Accepté |
| 0016 | Licence du code | À décider |
