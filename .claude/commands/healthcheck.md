---
description: Vérifie la santé de l'environnement et résume
argument-hint: [local|staging|prod]
---

Vérifie la santé de l'environnement `$ARGUMENTS` (local par défaut), en suivant `docs/07-observability.md`.

1. Lance `pnpm health` (ou `foil health --env $ARGUMENTS --json`).
2. Pour chaque vérification en `warn` ou `fail`, donne la cause probable et va voir plus loin : logs récents du service concerné (Loki), métriques associées (Prometheus), dernières erreurs (GlitchTip), alertes actives (Alertmanager).
3. Si le parcours synthétique échoue, indique à quelle étape.
4. Si l'auto-test du moteur échoue, identifie le replay de référence qui diverge et la première action en cause.
5. Résume en trois parties : ce qui va bien, ce qui ne va pas, ce qu'il faut faire, avec le runbook correspondant du repo `infra` quand il existe.

Ne modifie rien en production. Propose les actions, ne les exécute pas.
