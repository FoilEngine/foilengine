# ADR 0013 — Hébergement : un VPS, Docker Compose, Caddy

**Statut** : Proposé
**Date** : 2026-10-30

## Contexte

Projet gratuit, donc coûts minimaux, mais exigence forte de monitoring.

## Décision

Un VPS européen, **Docker Compose**, **Caddy** (HTTPS automatique), images construites par la CI et publiées sur **GitHub Container Registry**, déploiement par étiquette d'image depuis le repo privé `infra`, secrets chiffrés avec **sops + age**, sauvegardes Postgres chiffrées vers un stockage objet externe.

## Conséquences

Coût prévisible, tout l'environnement reproductible en local. Pas de haute disponibilité au départ : assumé, et compensé par la reprise des parties depuis le journal.

## Alternatives écartées

Kubernetes : disproportionné. PaaS (Fly.io, Railway) : pratique mais coûteux avec la stack d'observabilité complète.
