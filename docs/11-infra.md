# 11 — Infrastructure

## Two repos

- **`foilengine/infra/`** (public): everything needed to run the project **locally**: Docker Compose for the dependencies (Postgres, Valkey) and the observability stack, Prometheus configuration, alerts, Grafana dashboards. No secrets.
- **`FoilEngine/infra`** (private): **production**: server configuration, deployment, encrypted secrets, backups, runbooks. See that repo's README.

## Environments

| Environment | Where | Data |
| --- | --- | --- |
| `local` | Developer's machine, Docker Compose | Disposable |
| `ci` | GitHub Actions, ephemeral containers | Disposable |
| `staging` | Same machine as prod, another Compose stack | Anonymized copy or disposable |
| `prod` | One VPS | Real, backed up |

## Production proposal (ADR 0013)

The project must stay free and cheap to run:

- **One VPS** (around 4 vCPU and 8 to 16 GB of RAM) at a European host.
- **Docker Compose**, with **Caddy** as the reverse proxy (automatic HTTPS).
- Services: `server`, `worker` (×N), `postgres`, `valkey`, and the observability stack (Prometheus, Alertmanager, Grafana, Loki, Tempo, GlitchTip, Uptime Kuma). Uptime Kuma can run elsewhere to really check from the outside.
- **Images** built by the CI and published on GitHub Container Registry (free for public repos), tagged by commit.
- **Deployment**: a GitHub Action in the private `infra` repo connects to the server and updates the stack to an image tag. Rollback = redeploy the previous tag.
- **Database migrations** run by a dedicated container before the server starts.
- **Backups**: daily encrypted Postgres dump, sent to external object storage, with a monthly restore test (runbook).
- **Secrets**: encrypted in the private repo (sops + age), never in clear, never in images.

## Application configuration

All configuration goes through environment variables, validated at startup by a Zod schema (the server refuses to start if a variable is missing or invalid). The full list is in `.env.example`, kept up to date.
