# ADR 0014 — Observabilité : OpenTelemetry et la stack Grafana

**Statut** : Proposé
**Date** : 2026-10-30

## Contexte

Le projet demande de pouvoir vérifier la santé du backend à tout moment et de diagnostiquer chaque partie.

## Décision

Instrumentation **OpenTelemetry** et **Pino**, centralisée dans `@foilengine/telemetry`. **Prometheus** + **Alertmanager** (métriques et alertes), **Grafana** (tableaux de bord versionnés), **Loki** (logs), **Tempo** (traces), **GlitchTip** (erreurs, compatible Sentry), **Uptime Kuma** (disponibilité externe et page de statut). Alertes vers Discord.

## Conséquences

Tout est auto-hébergé et gratuit. La console du projet complète Grafana pour ce qui est propre au jeu (replays, couverture des règles, scénarios).

## Alternatives écartées

Services managés (Datadog, Sentry payant, Grafana Cloud) : plus simples, mais coûteux ou limités au-delà des offres gratuites.
