# 07 — Observabilité et santé

Objectif : pouvoir vérifier à tout moment que le backend va bien, comprendre ce qui se passe dans une partie, et être prévenu avant les joueurs quand quelque chose casse.

## Les trois signaux

Tout passe par `@foilengine/telemetry`. Aucun package n'utilise directement `console.log`, un client Prometheus ou un SDK de traces.

### Logs

- **Pino**, en JSON, une ligne par événement.
- Champs systématiques : `ts`, `level`, `service`, `version` (commit), `env`, `msg`, et selon le contexte `requestId`, `gameId`, `playerId` (pseudonymisé), `traceId`, `spanId`.
- Niveaux : `error` (action requise), `warn` (anomalie tolérée), `info` (cycle de vie : partie créée, terminée, joueur connecté), `debug` (détail, désactivé en production par défaut, activable à chaud par partie).
- Jamais de secret, de jeton, d'adresse e-mail ni de main de joueur en clair dans les logs.
- Collecte par Grafana Alloy (ou Promtail) vers **Loki**.

### Métriques

- Format **Prometheus**, exposé sur `/metrics` (port interne, non public).
- Préfixe `foil_`. Les noms suivent les conventions Prometheus (`_total` pour les compteurs, `_seconds` pour les durées).

Métriques minimales :

| Métrique | Type | Labels | Pourquoi |
| --- | --- | --- | --- |
| `foil_games_active` | gauge | `mode` | Parties en cours |
| `foil_games_started_total` / `foil_games_finished_total` | counter | `mode`, `result` | Activité, abandons |
| `foil_engine_apply_seconds` | histogram | `action_type` | Latence du moteur |
| `foil_engine_legal_actions_seconds` | histogram | | Latence du moteur |
| `foil_engine_illegal_actions_total` | counter | `reason` | Clients qui tentent des coups illégaux (bug client ou triche) |
| `foil_engine_errors_total` | counter | `kind` (`invariant`, `not_implemented`) | Bugs moteur, cartes manquantes |
| `foil_engine_invariant_violations_total` | counter | `invariant` | Vérifications échantillonnées en production |
| `foil_engine_nondeterminism_total` | counter | | Rejeu de contrôle qui diverge |
| `foil_cards_not_implemented_total` | counter | `card` | Quelles cartes manquent le plus en vrai |
| `foil_manual_overrides_total` | counter | `card` | Usage du mode manuel |
| `foil_ws_connections` | gauge | | Connexions WebSocket |
| `foil_ws_messages_total` | counter | `direction`, `type` | Trafic |
| `foil_ws_reconnects_total` | counter | | Stabilité réseau |
| `foil_action_roundtrip_seconds` | histogram | | Du message client à l'envoi des événements |
| `foil_matchmaking_wait_seconds` | histogram | `mode` | Attente en file |
| `foil_ai_think_seconds` | histogram | `policy` | Temps de réflexion de l'IA |
| `foil_sim_jobs` | gauge | `state` (`queued`, `running`, `failed`) | File des simulations |
| `foil_sim_games_per_second` | gauge | | Débit des workers |
| `foil_http_request_seconds` | histogram | `route`, `status` | API |
| `foil_db_query_seconds` | histogram | `query` | Base de données |

Plus les métriques par défaut du runtime Node (event loop lag, mémoire, GC).

### Traces

- **OpenTelemetry**, exportées vers **Tempo**.
- Une trace par requête HTTP et par message WebSocket. Spans dédiés autour de `isLegal`, `apply`, la persistance du journal, la diffusion aux clients, la réflexion de l'IA.
- Le `traceId` est présent dans les logs pour passer d'une ligne de log à sa trace dans Grafana.

### Erreurs

- **GlitchTip** auto-hébergé (compatible avec le SDK Sentry, donc gratuit) pour le serveur, les workers et le client. Chaque erreur moteur joint le `gameId`, la version des règles et un lien vers le replay dans la console.

## Endpoints de santé

Sur `apps/server` (et chaque worker expose les mêmes sur son port interne) :

| Endpoint | Rôle | Contenu |
| --- | --- | --- |
| `GET /healthz` | Vivant ? Pour le redémarrage automatique. | `200 {"status":"ok"}` si le processus répond. Ne vérifie aucune dépendance. |
| `GET /readyz` | Prêt à recevoir du trafic ? | `200` si toutes les dépendances critiques répondent, sinon `503` avec le détail. |
| `GET /health/details` | Diagnostic complet (protégé, admin uniquement) | Voir ci-dessous |
| `GET /metrics` | Prometheus | Port interne uniquement |

Réponse de `/health/details` :

```json
{
  "status": "degraded",
  "version": "a1b2c3d",
  "rulesVersion": "CR-2026-10-09",
  "codexSnapshot": "2026-10-30",
  "uptimeSeconds": 86400,
  "checks": {
    "postgres":     { "status": "ok", "latencyMs": 2, "migrations": "up-to-date" },
    "valkey":       { "status": "ok", "latencyMs": 1 },
    "queue":        { "status": "warn", "queued": 340, "running": 4, "oldestJobSeconds": 620 },
    "engineSelfTest": { "status": "ok", "replays": 25, "durationMs": 180 },
    "websocket":    { "status": "ok", "connections": 112 },
    "workers":      { "status": "ok", "alive": 4, "expected": 4 },
    "disk":         { "status": "ok", "freePercent": 64 },
    "eventLoopLag": { "status": "ok", "p99Ms": 12 }
  }
}
```

Chaque check a un seuil `warn` et `fail`, défini dans la config et documenté ici quand il change.

**L'auto-test du moteur** (`engineSelfTest`) rejoue les replays de référence au démarrage et toutes les 10 minutes, et compare les empreintes. Les replays de référence sont des fichiers de données (`.foilreplay`) lus au démarrage : le serveur n'importe pas `testkit`, il les rejoue avec `rules` et `log`. S'il échoue, `/readyz` passe en échec : un moteur qui ne joue plus juste ne doit pas recevoir de parties.

## La commande `pnpm health` (et `foil health`)

Un seul point d'entrée pour vérifier un environnement, en local ou en production :

```bash
pnpm health                 # environnement local
foil health --env prod      # production (avec un jeton admin)
foil health --json          # pour un script ou la CI
```

Elle vérifie, dans l'ordre :
1. Les services répondent (`/healthz`, `/readyz`) : serveur, workers, Postgres, Valkey, Prometheus, Grafana, Loki, Tempo, GlitchTip.
2. Le détail de `/health/details`.
3. Un **parcours synthétique** : se connecter en WebSocket, créer une partie solo contre l'IA aléatoire, jouer jusqu'à la fin, vérifier le replay, supprimer la partie.
4. Les alertes actives dans Alertmanager.
5. Les versions déployées (commit, version des règles, snapshot codex).

Sortie lisible, une ligne par vérification avec un statut, et un code de sortie non nul en cas d'échec. Le même parcours synthétique tourne toutes les 5 minutes en production et alimente une métrique `foil_synthetic_check_success`.

## La console (`apps/console`)

Une application web réservée aux administrateurs. Elle passe par l'API du serveur pour tout ce qu'elle affiche ou lance, et n'importe pas `testkit`. Pages :

1. **Santé** : l'équivalent visuel de `/health/details`, en direct, avec l'historique des dernières 24 heures.
2. **Parties en cours** : liste, mode, durée, joueurs (pseudonymisés), dernière action, latence. Ouvrir une partie en spectateur administrateur, ce qui permet de voir l'état complet.
3. **Replays** : rechercher une partie, la rejouer pas à pas avec l'état complet et les événements, exporter le replay, lancer `/investigate-replay` sur un replay (génère un fichier pour Claude Code).
4. **Règles** : le rapport de couverture des règles (statut par numéro), les questions ouvertes, et un **lanceur de scénarios** : choisir ou écrire un scénario (YAML), l'exécuter contre la version déployée via l'API du serveur et voir le résultat. Question ouverte (ADR 0017) : le serveur n'importe pas `testkit`, il reste à décider comment il exécute un scénario.
5. **Cartes** : couverture des cartes par set et par legend, cartes les plus souvent en mode manuel, cartes les plus impliquées dans des erreurs moteur.
6. **Simulations** : file des jobs, débit des workers, résultats récents.
7. **Erreurs** : les dernières erreurs moteur avec un lien vers GlitchTip et vers le replay.
8. **Métriques** : graphes Grafana intégrés pour les tableaux de bord principaux.

## Tableaux de bord Grafana

Versionnés dans `infra/grafana/dashboards/` en JSON, provisionnés automatiquement :

- **Vue d'ensemble** : parties actives, joueurs connectés, erreurs, latences p50/p95/p99, état des checks.
- **Moteur** : latences `apply` et `legalActions` par type d'action, actions illégales par raison, erreurs moteur, cartes non implémentées.
- **Temps réel** : connexions, messages, reconnexions, aller-retour d'une action.
- **Simulations et IA** : file, débit, temps de réflexion.
- **Infrastructure** : CPU, mémoire, disque, Postgres, Valkey.

## Alertes

Règles Prometheus versionnées dans `infra/prometheus/alerts/`, routées par Alertmanager vers un webhook Discord (et e-mail en secours) :

| Alerte | Condition | Gravité |
| --- | --- | --- |
| `ServerDown` | `/healthz` ne répond pas depuis 1 min | critique |
| `NotReady` | `/readyz` en échec depuis 2 min | critique |
| `EngineSelfTestFailed` | auto-test du moteur en échec | critique |
| `EngineNondeterminism` | `foil_engine_nondeterminism_total` augmente | critique |
| `EngineInvariantViolations` | violations d'invariants > 0 sur 10 min | haute |
| `EngineErrorsSpike` | erreurs moteur > 1 % des actions sur 10 min | haute |
| `SyntheticCheckFailing` | parcours synthétique en échec deux fois de suite | haute |
| `HighActionLatency` | p95 de l'aller-retour d'une action > 250 ms sur 10 min | moyenne |
| `SimQueueBacklog` | job le plus ancien > 15 min | moyenne |
| `DiskAlmostFull` | moins de 15 % libre | moyenne |
| `BackupMissing` | aucune sauvegarde réussie depuis 26 h | haute |

Chaque alerte renvoie vers un runbook dans le repo `infra` (`docs/runbooks/`).

## Uptime externe

**Uptime Kuma** vérifie depuis l'extérieur la page publique, l'API et le WebSocket, et publie une page de statut publique.

## En local

`infra/docker-compose.observability.yml` démarre Prometheus, Grafana (avec les tableaux de bord), Loki, Tempo, Alertmanager, GlitchTip et Uptime Kuma. `pnpm dev:obs` lance l'application avec cette stack, pour développer le monitoring dans les mêmes conditions qu'en production.
