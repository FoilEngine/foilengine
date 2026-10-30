# CLAUDE.md — packages/telemetry

Logs, métriques, traces, erreurs et healthchecks partagés.

## Dépendances

- **Autorisées** : Pino, prom-client, OpenTelemetry, SDK Sentry (vers GlitchTip).
- **Interdites** : dépendre d'un package métier.

## API publique

`createLogger`, `metrics` (registre et métriques déclarées), `tracer`, `captureError`, `createHealthRegistry` (checks avec seuils).

## Points d'attention

- Toutes les métriques sont déclarées ici, avec le préfixe `foil_`, et listées dans `docs/07-observability.md`.
- Jamais de secret, de jeton ni d'information cachée de jeu dans les logs.

## À lire

- `docs/07-observability.md`

Les règles générales du projet sont dans le `CLAUDE.md` racine.
