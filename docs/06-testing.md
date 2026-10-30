# 06 — Tests (`@foilengine/testkit`)

L'objectif : pouvoir tester **chaque règle** des Core Rules, savoir à tout moment lesquelles sont couvertes, et transformer chaque bug en test.

## Les niveaux

| Niveau | Outil | Ce qu'il vérifie | Quand |
| --- | --- | --- | --- |
| Unitaires | Vitest | Une fonction (RNG, calcul de coût, couche) | Chaque commit |
| **Scénarios de règles** | Harnais `scenario()` | Une règle précise, citée par son numéro | Chaque commit |
| **Scénarios de cartes** | Harnais `scenario()` | Le comportement d'une carte | Chaque commit |
| **Fuzzing** | `fuzz()` + fast-check | Des milliers de parties aléatoires, invariants à chaque étape | Court à chaque commit, long chaque nuit |
| **Replays de référence** | `golden/` | Des parties complètes rejouées, état final identique au bit près | Chaque commit |
| Propriétés | fast-check | Sérialisation, déterminisme, `viewFor` sans fuite | Chaque commit |
| Benchmarks | `vitest bench` | Budgets de performance du moteur | Chaque PR |
| Intégration serveur | Vitest + serveur réel + Postgres et Valkey en conteneurs | Protocole, salons, reprise après déconnexion, autorité | Chaque PR |
| Charge | k6 | Parties simultanées, latence WebSocket | Avant chaque mise en production importante |
| Bout en bout | Playwright | Parcours dans le client (créer un salon, jouer un tour, voir le replay) | Chaque PR touchant `play` |
| IA | `sim` | Taux de victoire des politiques entre elles, non-régression | Chaque nuit |

## Le harnais de scénarios

Un scénario décrit un état de départ, des actions, et ce qu'on attend. Il cite toujours la ou les règles testées.

```ts
scenario('rule 315.3: turn player channels 2 runes at Channel step', {
  rules: ['315.3'],
  setup: board()
    .player('A', { runeDeck: 10 })
    .player('B')
    .activePlayer('A')
    .atStep('start.channel'),
  then: (t) => {
    t.expectEvents(['RuneChanneled', 'RuneChanneled']);
    t.expect(t.player('A').runesInPlay).toHaveLength(2);
  },
});

scenario('rule 315.3.b: channel only what remains when the rune deck is short', {
  rules: ['315.3.b'],
  setup: board().player('A', { runeDeck: 1 }).activePlayer('A').atStep('start.channel'),
  then: (t) => t.expectEvents(['RuneChanneled']),
});
```

Les éléments du harnais :

- **`board()`** : un constructeur d'état lisible (joueurs, zones, cartes par nom ou id, unités sur les battlefields, phase et étape, priorité, focus, chaîne). Il passe par les mêmes validations que `createGame`, pour ne jamais produire un état impossible.
- **`act(...)`** : applique des actions et échoue si l'une est illégale (ou `actIllegal(...)` pour vérifier un refus et sa raison).
- **`expectEvents`**, **`expectState`**, **`expectLegal`**, **`expectIllegal(reason)`**, **`expectDecision`**.
- **Cartes de test** : des cartes fictives (`test:vanilla-2-2`, `test:draw-on-play`…) pour tester une règle sans dépendre d'une vraie carte.
- Les scénarios peuvent être écrits en TypeScript, ou en YAML pour les cas simples (lisibles par un non-développeur et générables depuis la console).

## Couverture des règles

1. **Indexation des Core Rules** : un script (`foil rules index`) extrait du PDF la liste des règles (numéro, titre, texte) et l'écrit dans `docs/rules/index/<version>.json`, avec une empreinte du texte de chaque règle.
2. **Collecte** : chaque scénario déclare ses `rules`. Le moteur, de son côté, marque dans les événements la règle qui les a produits.
3. **Rapport** (`pnpm test:rules`) : pour chaque règle, son statut :

| Statut | Signification |
| --- | --- |
| `covered` | Au moins un scénario dédié, vert |
| `exercised` | Pas de scénario dédié, mais la règle a produit des événements pendant les tests ou le fuzzing |
| `uncovered` | Ni l'un ni l'autre |
| `stale` | Le texte de la règle a changé dans une nouvelle version des Core Rules depuis l'écriture du test : à revérifier |
| `not-applicable` | Règle sans effet sur le moteur (définitions, conseils), avec justification |
| `question` | Règle ambiguë, en attente dans `docs/rules/questions.md` |

Le rapport est produit en JSON (pour la console et la CI) et en Markdown (pour la PR). La CI échoue si une règle `covered` passe en `uncovered` ou si un test `stale` n'est pas traité.

La même mécanique produit la **couverture des cartes** (statuts de `04-cards-and-effects.md`) et la **couverture des mots-clés**.

## Fuzzing et invariants

Le fuzzer joue des parties complètes avec une politique aléatoire (et des politiques biaisées vers les actions rares : abandon, mulligan maximal, chaînes longues). À **chaque étape**, il vérifie les invariants :

- Le nombre total de cartes de chaque joueur est constant (aucune carte créée ni détruite ; seuls les jetons apparaissent et disparaissent).
- Aucun `ObjectId` n'est dupliqué ; tout objet référencé existe.
- Les points ne descendent jamais sous 0 et ne baissent que par un effet qui le dit.
- Il y a au plus une chaîne ; priorité et focus respectent 312–313.
- `legalActions` n'est jamais vide tant que la partie n'est pas finie et qu'une décision est attendue.
- Toute action renvoyée par `legalActions` passe `isLegal`.
- L'état est sérialisable, et `deserialize(serialize(state))` est équivalent.
- **Déterminisme** : rejouer la partie depuis la graine et le journal redonne exactement la même empreinte d'état à chaque étape.
- **Pas de fuite** : `viewFor(state, p)` ne contient aucun identifiant de carte cachée à `p`.
- La partie se termine en moins de N actions (borne anti-boucle).

Une violation produit un **fichier de reproduction** (graine, decks, journal jusqu'à l'action fautive) dans `testkit/repros/`, que `/investigate-replay` sait exploiter. Le fuzzer réduit automatiquement la reproduction (shrinking) quand c'est possible.

## Replays de référence

`testkit/golden/*.foilreplay` : des parties complètes, issues de vraies parties ou écrites à la main pour couvrir une interaction. La CI les rejoue et compare l'empreinte de l'état final et la suite d'événements. Un changement volontaire de comportement met à jour le replay avec une justification dans le commit.

## Bugs de règles

Tout bug de règle signalé (issue « Rule applied incorrectly ») suit le même chemin :

1. Récupérer le replay de la partie (la console permet de l'exporter).
2. `/investigate-replay` : rejouer, trouver la première action où le moteur s'écarte des règles.
3. Écrire un scénario minimal qui reproduit l'écart, avec le numéro de règle.
4. Corriger, puis ajouter le replay aux références si l'interaction est intéressante.

## Tests en production

Le moteur tourne aussi des vérifications en production (voir `07-observability.md`) : auto-test au démarrage sur les replays de référence, vérification d'invariants échantillonnée sur les vraies parties, et rejeu des parties terminées en tâche de fond pour détecter tout non-déterminisme.
