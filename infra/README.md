# infra/ — Environnement local

Tout ce qu'il faut pour faire tourner Foil Engine et son monitoring **en local**. Aucun secret ici. La production est dans le repo privé `FoilEngine/infra`.

## Contenu attendu

```
infra/
  docker-compose.yml                 Postgres, Valkey
  docker-compose.observability.yml   Prometheus, Alertmanager, Grafana, Loki, Tempo, GlitchTip, Uptime Kuma, collecteur (Alloy)
  prometheus/
    prometheus.yml                   cibles : server, workers
    alerts/*.yml                     règles d'alerte (liste dans docs/07-observability.md)
  alertmanager/alertmanager.yml      routage (webhook Discord en local optionnel)
  grafana/
    provisioning/                    sources de données et tableaux de bord provisionnés
    dashboards/*.json                vue d'ensemble, moteur, temps réel, simulations et IA, infrastructure
  loki/, tempo/                      configurations minimales
```

## Commandes

```bash
pnpm infra:up        # dépendances
pnpm infra:obs       # stack d'observabilité
pnpm dev:obs         # application + dépendances + observabilité
pnpm health          # vérification complète
```

Grafana : `http://localhost:3001` (identifiants dans `.env.example`). Les tableaux de bord et les alertes sont versionnés ici : les modifier dans Grafana puis exporter le JSON dans `grafana/dashboards/`.

Les mêmes fichiers de configuration (alertes, tableaux de bord) sont réutilisés par la production : le repo privé ne contient que ce qui diffère (secrets, domaines, ressources).
