---
description: Checks the health of the environment and summarizes it
argument-hint: [local|staging|prod]
---

Check the health of the `$ARGUMENTS` environment (local by default), following `docs/07-observability.md`.

1. Run `pnpm health` (or `foil health --env $ARGUMENTS --json`).
2. For each check in `warn` or `fail`, give the likely cause and dig further: recent logs of the service (Loki), related metrics (Prometheus), latest errors (GlitchTip), active alerts (Alertmanager).
3. If the synthetic journey fails, say at which step.
4. If the engine self-test fails, identify the reference replay that diverges and the first action at fault.
5. Summarize in three parts: what is fine, what is wrong, what to do, with the matching runbook from the `infra` repo when there is one.

Change nothing in production. Propose the actions, do not run them.
