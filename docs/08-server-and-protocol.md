# 08 — Serveur et protocole (`apps/server`, `@foilengine/protocol`)

## Rôle du serveur

Le serveur **fait autorité**. Il détient l'état complet de chaque partie, valide chaque action avec le moteur, persiste le journal et envoie à chaque client ce qu'il a le droit de voir. Le client n'est qu'un écran et une manette.

Responsabilités :
- comptes et sessions ;
- salons (privés, solo, avec code d'invitation) et matchmaking (constructed, sealed, BO1, BO3) ;
- déroulé des parties : timers, déconnexions, reprise, abandon ;
- spectateurs, avec un délai configurable et sans information cachée ;
- IA côté serveur pour les parties contre l'IA classées ou analysées ;
- API HTTP : decks, collection, historique, replays, résultats de simulations ;
- santé et métriques (voir `07-observability.md`).

## Protocole

- Transport : **WebSocket** pour les parties, **HTTP JSON** pour le reste.
- Tous les messages sont définis dans `@foilengine/protocol` avec des **schémas Zod**, validés à l'entrée **et** à la sortie du serveur.
- Chaque message a un `type`, un `v` (version du protocole) et un `id` (corrélation).
- Le protocole est versionné. Un client trop ancien reçoit `PROTOCOL_UNSUPPORTED` et un message lui demandant de recharger.

Messages de partie (forme indicative) :

| Sens | Message | Contenu |
| --- | --- | --- |
| client → serveur | `game.join` | `gameId`, `seat` ou spectateur |
| client → serveur | `game.intent` | une `Action` du moteur, plus `expectedSeq` (numéro du dernier événement vu) |
| client → serveur | `game.rewind.request` / `game.forward.request` | demande de retour en arrière |
| client → serveur | `game.emote`, `game.chat` | |
| serveur → client | `game.snapshot` | la vue du joueur et le numéro de séquence (à la connexion et à la reprise) |
| serveur → client | `game.events` | les événements filtrés pour ce joueur, depuis un numéro de séquence |
| serveur → client | `game.decision` | ce qu'on attend du joueur, avec les actions légales |
| serveur → client | `game.rejected` | action refusée, avec la raison du moteur |
| serveur → client | `game.ended` | résultat, lien vers le replay |

## Garanties

- **Ordre** : les événements portent un numéro de séquence croissant. Un client qui voit un trou demande `game.resync` et reçoit un snapshot.
- **Idempotence** : un `game.intent` rejoué avec le même `id` n'est appliqué qu'une fois.
- **Concurrence** : une seule action est traitée à la fois par partie (file par partie). `expectedSeq` permet de rejeter une action envoyée sur un état périmé.
- **Information cachée** : le serveur n'envoie que `viewFor` et les événements filtrés. Un test d'intégration vérifie, pour chaque type de message sortant, qu'aucune carte cachée au destinataire n'y figure.
- **Reprise** : le journal de chaque partie en cours est persisté au fil de l'eau. Après un redémarrage du serveur, les parties sont reconstruites en rejouant leur journal.

## Rewind et forward

Inspirés de Rift Atlas : le rewind annule la dernière action du demandeur et tout ce qui en dépend. Comme l'état est déterministe et journalisé, un rewind consiste à rejouer le journal jusqu'au point voulu. En partie entre humains, un rewind qui annule des actions de l'adversaire demande son accord. Le forward rétablit la ligne annulée pendant un court délai. Tout est enregistré dans le journal.

## Sécurité

- Limitation de débit par connexion et par compte (messages par seconde, salons créés).
- Validation stricte des entrées (Zod), taille maximale des messages.
- Jamais de logique de règles dans le client : une action illégale est toujours refusée par le serveur, et comptée dans `foil_engine_illegal_actions_total`.
- Les endpoints d'administration (`/health/details`, console) exigent un rôle admin.
- Signalement de joueurs (triche, comportement), comme sur Rift Atlas.

## Authentification

À décider dans l'ADR 0011. Proposition : connexion par Discord (OAuth), parce que la communauté Riftbound y est, plus un compte invité pour jouer sans inscription. Sessions côté serveur dans Postgres.
