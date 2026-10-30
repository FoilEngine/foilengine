# CLAUDE.md — apps/server

Serveur de parties : salons, matchmaking, comptes, API, WebSocket, santé, métriques. Seul détenteur de l'état complet.

## Dépendances

- **Autorisées** : tous les packages sauf `ui` et `testkit`.
- **Interdites** : envoyer l'état complet à un client ; implémenter une règle.

## API publique

Routes HTTP, messages WebSocket du `protocol`, `/healthz`, `/readyz`, `/health/details`, `/metrics`.

## Points d'attention

- Une action à la fois par partie ; `expectedSeq` pour rejeter les actions périmées.
- Persister le journal au fil de l'eau ; reconstruire les parties en cours au démarrage.
- L'auto-test du moteur au démarrage conditionne `/readyz`. Il rejoue les replays de référence, lus comme fichiers de données (`.foilreplay`), avec `rules` et `log` : jamais en important `testkit`.
- Exécuter un scénario pour le lanceur de la console sans `testkit` reste une question ouverte (ADR 0017).
- Configuration validée par Zod au démarrage ; `.env.example` à jour.

## À lire

- `docs/08-server-and-protocol.md`
- `docs/07-observability.md`

Les règles générales du projet sont dans le `CLAUDE.md` racine.
