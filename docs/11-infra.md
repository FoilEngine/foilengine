# 11 — Infrastructure

## Deux repos

- **`foilengine/infra/`** (public) : tout ce qu'il faut pour faire tourner le projet **en local** : Docker Compose des dépendances (Postgres, Valkey) et de la stack d'observabilité, configuration de Prometheus, des alertes, des tableaux de bord Grafana. Aucun secret.
- **`FoilEngine/infra`** (privé) : la **production** : configuration des serveurs, déploiement, secrets chiffrés, sauvegardes, runbooks. Voir le README de ce repo.

## Environnements

| Environnement | Où | Données |
| --- | --- | --- |
| `local` | Machine du développeur, Docker Compose | Jetables |
| `ci` | GitHub Actions, conteneurs éphémères | Jetables |
| `staging` | Même machine que la prod, autre stack Compose | Copie anonymisée ou jetable |
| `prod` | Un VPS | Réelles, sauvegardées |

## Proposition pour la production (ADR 0013)

Le projet doit rester gratuit et peu coûteux à faire tourner :

- **Un VPS** (de l'ordre de 4 vCPU et 8 à 16 Go de RAM) chez un hébergeur européen.
- **Docker Compose**, avec **Caddy** en reverse proxy (HTTPS automatique).
- Services : `server`, `worker` (×N), `postgres`, `valkey`, et la stack d'observabilité (Prometheus, Alertmanager, Grafana, Loki, Tempo, GlitchTip, Uptime Kuma). Uptime Kuma peut tourner ailleurs pour vérifier vraiment depuis l'extérieur.
- **Images** construites par la CI et publiées sur GitHub Container Registry (gratuit pour les repos publics), étiquetées par commit.
- **Déploiement** : une GitHub Action du repo privé `infra` se connecte au serveur et met à jour la stack sur une étiquette d'image. Retour arrière = redéployer l'étiquette précédente.
- **Migrations de base** jouées par un conteneur dédié avant le démarrage du serveur.
- **Sauvegardes** : dump Postgres quotidien chiffré, envoyé vers un stockage objet externe, avec un test de restauration mensuel (runbook).
- **Secrets** : chiffrés dans le repo privé (sops + age), jamais en clair, jamais dans les images.

## Configuration de l'application

Toute la configuration passe par des variables d'environnement, validées au démarrage par un schéma Zod (le serveur refuse de démarrer si une variable manque ou est invalide). La liste complète est dans `.env.example`, tenue à jour.
