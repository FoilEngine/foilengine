# 03 — Moteur de règles (`@foilengine/rules`)

L'arbitre. Il décide de ce qui est légal, résout tout ce qui se passe et détecte la victoire. Tout le reste du projet s'appuie sur lui.

## API publique

```ts
createGame(setup: GameSetup, seed: Seed): { state: GameState; events: GameEvent[] }
legalActions(state: GameState, player: PlayerId): ActionTemplate[]
isLegal(state: GameState, action: Action): { ok: true } | { ok: false; reason: IllegalReason }
apply(state: GameState, action: Action): { state: GameState; events: GameEvent[] }
outcome(state: GameState): Outcome            // en cours, gagnant, égalité, abandon
viewFor(state: GameState, player: PlayerId): PlayerView
pendingDecision(state: GameState): Decision | null   // qui doit agir, et sur quoi
```

- `apply` sur une action illégale **ne modifie rien** et lève une `IllegalActionError` avec la raison. Le serveur appelle `isLegal` d'abord.
- `GameSetup` contient les decks résolus (définitions de cartes issues de `codex` et implémentations issues de `cards`), le mode et la version des règles.

## Invariants de conception

1. **Pur.** Aucune entrée-sortie, aucune horloge, aucun `Math.random`, aucune variable globale mutable. Une même entrée donne toujours la même sortie.
2. **Immuable vu de l'extérieur.** `apply` renvoie un nouvel état. En interne, on peut muter un brouillon (structural sharing via Immer ou équivalent, à décider dans l'ADR 0004), mais aucun état reçu en argument n'est jamais modifié.
3. **Sérialisable.** L'état est du JSON pur : pas de `Map`, de classe, de fonction ni de référence circulaire. `JSON.parse(JSON.stringify(state))` doit donner un état équivalent.
4. **Déterministe.** Le RNG est dans l'état (`rng`) : un PRNG à graine, de qualité (xoshiro128** ou PCG), dont l'état complet est sérialisé. Chaque tirage avance le compteur.
5. **Borné.** Toute boucle (cleanup, chaîne, déclencheurs) a une borne. La dépasser lève une `EngineInvariantError`, jamais une boucle infinie.
6. **Traçable.** Chaque événement porte la règle qui l'a produit quand c'est pertinent.

## Organisation interne

```
src/
  index.ts              API publique uniquement
  setup/                mise en place, mulligan, ordre du tour (104–118)
  turn/                 phases et étapes (300–317)
  cleanup/              cleanup à point fixe (318–324)
  chain/                chaîne et boucle HOT FEPR (325–340)
  showdown/             showdowns (341–348)
  play/                 processus de jeu d'une carte, coûts (349–359)
  abilities/            capacités passives, de remplacement, activées, déclenchées (360–406)
  actions/              actions de jeu atomiques : draw, recycle, exhaust, ready, channel, kill, heal, add, move, recall, banish, deal… (407–444)
  movement/             déplacements (445–458)
  combat/               combat et ses étapes (459–466)
  scoring/              tenir, conquérir, dernier point (467–472)
  layers/               effets continus appliqués par couches (473–480)
  modes/                modes de jeu (481–648)
  resources/            runes, pool, paiement et paiement automatique (160–168)
  view/                 viewFor
  legal/                legalActions, isLegal, raisons de refus
  rng/                  PRNG à graine
  errors.ts
```

Chaque dossier correspond à une section des Core Rules. Un fichier qui implémente une règle a un commentaire d'en-tête citant les numéros couverts.

## Actions de jeu atomiques

Toute modification d'état passe par une **action de jeu atomique** (draw, recycle, exhaust, ready, channel, kill, heal, add, move, recall, banish, deal, score…). Chacune :

- vérifie ses préconditions ;
- passe par les **effets de remplacement** applicables avant de s'exécuter ;
- émet ses événements ;
- met un cleanup en file si la règle 319 le demande ;
- notifie les **déclencheurs** concernés, qui créent des tâches ou des éléments de chaîne selon les règles des capacités déclenchées.

Les effets des cartes (`cards`) n'ont pas le droit de modifier l'état autrement qu'en appelant ces actions atomiques. C'est ce qui garantit que les remplacements, les déclencheurs et les cleanups s'appliquent partout.

## Effets continus et couches

Les caractéristiques d'un objet (might, mots-clés, coût…) ne sont jamais stockées « calculées » dans l'état. Elles sont dérivées à la lecture par `characteristics(state, objectId)`, qui part des valeurs imprimées et applique les effets continus dans l'ordre des couches (473–480). Le résultat peut être mis en cache par version d'état, mais la source de vérité reste la liste des effets.

## Choix des joueurs

Quand la règle demande un choix (cibles, ordre de déclencheurs simultanés, mode, paiement, mulligan), le moteur s'arrête et expose une `Decision` via `pendingDecision`. L'action suivante doit répondre à cette décision. Il n'y a jamais de callback ou de promesse dans le moteur : tout choix est une action.

L'ordre des déclencheurs simultanés suit l'ordre du tour, en commençant par le joueur actif (303.2.a). Quand un même joueur en a plusieurs, il choisit l'ordre (décision).

## Erreurs

| Erreur | Signification | Traitement |
| --- | --- | --- |
| `IllegalActionError` | Action refusée par les règles | Normal, renvoyée au client avec une raison |
| `EngineInvariantError` | État impossible (borne dépassée, carte dupliquée, objet introuvable) | Bug : log en erreur, métrique, capture de l'état et du journal pour reproduction |
| `NotImplementedError` | Carte ou mécanique pas encore codée | Propose le mode manuel au joueur, métrique par carte |

## Performance

Le moteur sera appelé des millions de fois par les simulations et l'IA. Budgets indicatifs, mesurés par des benchmarks (`vitest bench`) en CI :

- `legalActions` : moins de 0,2 ms en milieu de partie.
- `apply` : moins de 0,2 ms pour une action simple.
- Une partie complète aléatoire : moins de 20 ms.

Une régression de plus de 20 % sur un benchmark fait échouer la CI.

## Versions des règles

Le moteur porte la version des Core Rules qu'il implémente (`rulesVersion`). Quand Riot publie une nouvelle version :

1. on ajoute le nouveau PDF dans `docs/rules/` ;
2. le script d'indexation (voir `06-testing.md`) compare les textes et liste les règles modifiées ;
3. les tests de ces règles sont marqués « à revérifier » jusqu'à relecture ;
4. le moteur passe à la nouvelle version une fois tout revérifié.

Les replays enregistrent la version des règles. Rejouer un ancien replay utilise la version de l'époque si elle est encore disponible ; sinon, l'écart est signalé.
