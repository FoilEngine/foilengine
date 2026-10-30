# infra/ — Local environment

Everything needed to run Foil Engine and its monitoring **locally**. No secrets here. Production lives in the private `FoilEngine/infra` repo.

## Expected content

```
infra/
  docker-compose.yml                 Postgres, Valkey
  docker-compose.observability.yml   Prometheus, Alertmanager, Grafana, Loki, Tempo, GlitchTip, Uptime Kuma, collector (Alloy)
  prometheus/
    prometheus.yml                   targets: server, workers
    alerts/*.yml                     alert rules (list in docs/07-observability.md)
  alertmanager/alertmanager.yml      routing (optional local Discord webhook)
  grafana/
    provisioning/                    provisioned data sources and dashboards
    dashboards/*.json                overview, engine, real time, simulations and AI, infrastructure
  loki/, tempo/                      minimal configurations
```

## Commands

These scripts arrive with milestone M5 (see the table in the root `CLAUDE.md`).

```bash
pnpm infra:up        # dependencies
pnpm infra:obs       # observability stack
pnpm dev:obs         # application + dependencies + observability
pnpm health          # full check
```

Grafana: `http://localhost:3001` (credentials in `.env.example`). Dashboards and alerts are versioned here: edit them in Grafana, then export the JSON into `grafana/dashboards/`.

Production reuses the same configuration files (alerts, dashboards): the private repo only contains what differs (secrets, domains, resources).
