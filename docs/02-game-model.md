# 02 — Modèle de jeu

Ce document décrit comment l'état d'une partie de Riftbound est représenté dans `@foilengine/types` et `@foilengine/rules`. Il s'appuie sur les **Core Rules 1.4 (Vendetta, mises à jour le 2026-03-30)**. Les numéros cités ici servent de repère : **la référence reste le PDF dans `docs/rules/`**. Avant d'implémenter une règle, relis son texte exact dans le PDF et vérifie son numéro : il peut changer d'une version à l'autre.

## Carte des Core Rules

| Section | Contenu | Package concerné |
| --- | --- | --- |
| 000–056 | Règle d'or (le texte de carte prime sur les règles) et règle d'argent (terminologie, « Can't » bat « Can », faire autant que possible) | `rules`, `cards` |
| 100–118 | Concepts, construction de deck, mise en place, mulligan | `rules` (setup), `codex` (validation de deck) |
| 119–124 | Objets de jeu. **124 : changer de zone crée un nouvel objet** | `types`, `rules` |
| 125–139 | Anatomie d'une carte (coût, nom, catégorie, domaine, texte, bonus de might) | `types`, `codex` |
| 140–159 | Unités (dégâts, déplacement standard, emplacement), équipements, sorts | `rules`, `cards` |
| 160–168 | Runes, énergie et puissance, pool de runes | `rules` |
| 169–176 | Battlefields et legends (ni l'un ni l'autre ne sont des permanents) | `rules` |
| 177–187 | Types multiples, jetons (les jetons ne sont pas des cartes) | `rules`, `cards` |
| 188–192 | Contrôle | `rules` |
| 193–196 | Victoire | `rules` |
| 197–206 | Emplacements, coûts | `rules` |
| 300–318 | Le tour : états, priorité et focus, phases | `rules` |
| 318–324 | Cleanups | `rules` |
| 325–348 | Chaîne (processus HOT FEPR) et showdowns | `rules` |
| 349–359 | Jouer une carte (étapes du processus de jeu, coût total) | `rules` |
| 360–406 | Capacités (passives, remplacement, activées, déclenchées) | `rules`, `cards` |
| 407–444 | Actions de jeu (piocher, recycler, épuiser, redresser, canaliser, tuer, soigner, ajouter, rappeler, bannir, infliger…) | `rules` |
| 445–458 | Déplacement | `rules` |
| 459–466 | Combat et ses étapes | `rules` |
| 467–472 | Scoring : tenir et conquérir | `rules` |
| 473–480 | Couches (ordre d'application des effets continus) | `rules` |
| 481–648 | Modes de jeu (1v1, free-for-all, 2v2…) | `rules` |
| 649 | Abandon | `rules` |
| 700–766 | Règles additionnelles : buffs, Mighty, dégâts bonus, attachement, inactif, XP, tours additionnels, compteurs, choix, non-ciblable, nommer, ignorer des effets | `rules`, `cards` |
| 800+ | Mots-clés (Accelerate, Action, Assault, Deflect, Ganking, Hidden, Reaction, Temporary, Equip, Quick-Draw, etc.) | `cards` |

Les numéros de 360 à 800 viennent d'un index d'une version antérieure (décembre 2025). Vérifie-les dans le PDF actuel avant de les citer.

## Objets de jeu et identité

- Chaque objet de jeu a un **`ObjectId`** unique dans la partie, attribué par un compteur de l'état (déterministe).
- **Règle 124 : un changement de zone crée un nouvel objet.** Une carte qui passe de la main au plateau, ou du plateau à la défausse, reçoit un nouvel `ObjectId`. On garde séparément le **`CardRef`** (quelle carte imprimée c'est) et l'historique (`previousObjectId`) pour les effets qui doivent la suivre.
- Une carte a un **propriétaire** (`owner`, ne change jamais) et, sur le plateau, un **contrôleur** (`controller`, peut changer, section 188).
- Les **jetons** ne sont pas des cartes (185) : ils ont un `TokenDef` au lieu d'un `CardRef`, et cessent d'exister en quittant le plateau.

## Zones

Zones par joueur (sections 104–108) :

| Zone | Visibilité | Ordonnée | Notes |
| --- | --- | --- | --- |
| `mainDeck` | Cachée à tous | Oui | Pioche par le dessus |
| `runeDeck` | Cachée à tous | Oui | 12 runes (161.2.a) ; les runes recyclées y reviennent |
| `hand` | Visible par le propriétaire | Non | |
| `base` | Publique | Non | Unités, équipements, runes en jeu |
| `legendZone` | Publique | — | La Champion Legend (111) |
| `championZone` | Publique | — | Le Chosen Champion avant d'être joué (112) |
| `trash` | Publique | Oui | |
| `banishment` | Publique | Non | |

Zones partagées :

| Zone | Notes |
| --- | --- |
| `battlefields[]` | Chaque battlefield a un contrôleur éventuel, des unités de chaque joueur, des statuts (Contested, etc.). Le nombre dépend du mode (172). |
| `chain` | Zone temporaire qui n'existe que pendant qu'une carte est jouée ou une capacité activée (328). Éléments `pending` ou `finalized` (329). |

Les objets d'un plateau sont une information publique (109). Les cartes face cachée (Hidden, 811) sont l'exception à modéliser explicitement.

## État de la partie (forme de haut niveau)

```ts
interface GameState {
  version: number;              // version du schéma d'état
  rulesVersion: string;         // ex. "CR-1.4"
  mode: ModeId;                 // ex. "duel-1v1"
  rng: RngState;                // graine et compteur, sérialisables
  nextObjectId: number;
  players: Record<PlayerId, PlayerState>;
  turnOrder: PlayerId[];        // file circulaire (115.1.c)
  turn: TurnState;              // joueur actif, phase, étape, numéro de tour
  battlefields: BattlefieldState[];
  chain: ChainItem[];
  priority: PlayerId | null;    // 312
  focus: PlayerId | null;       // 313
  showdown: ShowdownState | null;
  combat: CombatState | null;
  pendingCleanup: boolean;      // 319
  continuousEffects: ContinuousEffect[]; // appliqués par couches (473+)
  winner: PlayerId | null;
  log: { eventSeq: number };
}

interface PlayerState {
  id: PlayerId;
  points: number;               // ne descend jamais sous 0 (194.4)
  zones: PlayerZones;
  runePool: { energy: number; power: Partial<Record<Domain | 'universal', number>> }; // 165–167
  scoredThisTurn: BattlefieldId[]; // pour la règle de conquête une fois par tour
  // ...
}
```

Les noms exacts sont fixés dans `@foilengine/types`. Toute modification de la forme de l'état incrémente `version` et doit rester rejouable (voir `log`).

## Le tour

### États (307–310)

Deux axes indépendants :
- **Neutral** ou **Showdown** (308) : un showdown ou un combat est en cours. En showdown, seules les cartes et capacités Action ou Reaction peuvent être jouées.
- **Open** ou **Closed** (309) : une chaîne existe (Closed, seules les Reaction sont jouables) ou non (Open).

Ce qui donne quatre états : Neutral Open, Neutral Closed, Showdown Open, Showdown Closed (310). `legalActions` dépend directement de cet état combiné.

### Priorité et focus (311–313)

- Au plus un joueur a la **priorité**, nécessaire pour les actions discrétionnaires (312.1). Certaines actions limitées ne la demandent pas (312.1.b.1).
- Le **focus** permet d'agir pendant un showdown ouvert (313). L'obtenir donne aussi la priorité. Passer la priorité ne fait pas perdre le focus. Personne n'a le focus en état Neutral.

### Phases (314–317)

1. **Début de tour (315)**
   - **Awaken** : le joueur actif redresse tout ce qu'il contrôle et qui peut l'être.
   - **Beginning** : effets de début de phase, puis étape de scoring où le joueur actif **tient** les battlefields qu'il contrôle.
   - **Channel** : il canalise 2 runes de son rune deck, ou ce qu'il reste (315.3). Exception de premier tour en 1v1 : le premier joueur canalise 2 runes, le second joueur en canalise 3 (voir Q-001 dans `docs/rules/questions.md` ; numéro de règle à confirmer dans le PDF, 115.2 ou section du mode).
   - **Draw** : il pioche 1 carte. Deck vide : il fait un **Burn Out** (315.4.b.1), puis pioche quand même.
2. **Phase principale (316)** : le pool de runes se vide, puis les effets de début de phase principale. Ensuite, aucune structure imposée : le joueur actif agit en état Neutral Open (316.5). Le combat a lieu quand des unités adverses sont sur le même battlefield (316.7). Un showdown accompagne chaque combat, et un showdown hors combat a lieu quand un joueur arrive sur un battlefield vide (316.8).
3. **Fin de tour (317)** : étape de fin (effets de fin de tour), puis étape d'expiration : cleanup spécial de fin, soin des unités, expiration des effets « ce tour-ci », vidage du pool de runes. Puis le joueur suivant devient joueur actif.

### Cleanups (318–324)

Un cleanup est mis en file après la plupart des changements d'état (319). Il se répète jusqu'à ce que l'état ne change plus (322). Ses étapes, dans l'ordre (323) :

1. Vérifier s'il y a un gagnant.
2. Attribuer ou retirer les rôles d'attaquant et de défenseur en combat.
3. Gérer le plateau : mettre en file les déclencheurs des unités qui ont subi des dégâts mortels (Deathknell…), puis envoyer ces unités à la défausse de leur propriétaire.
4. Les battlefields vides en état Open, sans showdown ni combat, perdent leur contrôleur.
5. Rappeler les équipements non attachés et les runes mal placés, retirer les cartes Hidden des battlefields que leur propriétaire ne contrôle pas.
6. Préparer les showdowns et combats là où le statut Contested a été appliqué.
7. Retirer le statut Contested quand il n'a plus lieu d'être.
8. En état Neutral Open, le joueur actif démarre le showdown ou le combat préparé.

Le cleanup est **une fonction pure qu'on appelle en boucle jusqu'à point fixe**, avec une borne d'itérations qui lève une erreur moteur (et une métrique) si elle est atteinte.

### La chaîne et le processus HOT FEPR (327–340)

Une seule chaîne à la fois (330). Les éléments y entrent en **pending** et deviennent **finalized** une fois l'étape de vérification de légalité passée (329). Le moteur boucle sur :

- **HOT, Handle Outstanding Tasks** : traiter d'abord toutes les tâches en attente (334).
- **F, Finalize** (337) : le contrôleur de l'élément pending le plus ancien le finalise. Les unités, équipements et capacités qui ajoutent des ressources se résolvent immédiatement.
- **E, Execute** (338) : le joueur qui a la priorité peut jouer quelque chose de légal (retour à F), ou passer.
- **P, Pass** (339) : si tout le monde passe à la suite sans rien ajouter, on va en R. Sinon, retour en E.
- **R, Resolve** (340) : l'élément finalisé le plus récent se résout entièrement. Si la chaîne est vide, l'état redevient Open. En showdown, le focus passe au joueur suivant, sauf si la chaîne a été ouverte par une capacité déclenchée ou une capacité qui ajoute des ressources.

Cette boucle doit être explicite dans le code, avec un nom par étape, parce que c'est là que naîtront la plupart des bugs.

### Showdowns (341–348)

- Un showdown commence pendant un cleanup en état Neutral Open quand le contrôle d'un battlefield est Contested (344). Le joueur qui a appliqué Contested reçoit le focus (345).
- Le joueur qui a le focus joue une carte ou une capacité légale (ce qui ouvre une chaîne, et le focus passe quand elle se ferme) ou passe. Si tous les joueurs passent une fois à la suite, le showdown se ferme (347).
- Un showdown de combat enchaîne sur les étapes du combat. Un showdown hors combat donne le contrôle au seul joueur restant, avec une conquête possible s'il n'a pas déjà marqué ce battlefield ce tour-ci (348).

## Mise en place (104–118)

1. Chaque joueur place sa Champion Legend dans sa zone de legend (111) et son Chosen Champion dans sa zone de champion (112).
2. Les battlefields sont mis de côté, puis placés selon le mode (113).
3. Chaque joueur mélange son main deck et son rune deck séparément (114) : avec le RNG de l'état.
4. L'ordre du tour est tiré au hasard (115), avec le RNG de l'état.
5. Chacun pioche 4 cartes (116).
6. Mulligan, dans l'ordre du tour : chacun met de côté jusqu'à 2 cartes, pioche autant, puis recycle les cartes mises de côté (117).
7. Le premier joueur commence son tour (118).

La construction de deck (101) est validée par `codex`/`rules` avant la création de la partie : nombre de cartes, legend, champion, 12 runes, battlefields, domaines.

## Ressources (160–168)

- Une rune produit de l'**énergie** (pour les coûts numériques, sans domaine) en s'épuisant, ou de la **puissance** de son domaine (pour les coûts de domaine) en étant recyclée (163–164).
- Les ressources passent par le **pool de runes**, qui se vide au début de chaque phase principale et à la fin de chaque tour (167). Les ressources non dépensées sont perdues.
- Le paiement automatique (comme sur Rift Atlas) est une fonction de `rules` qui propose un ensemble de runes à épuiser ou recycler. Le joueur peut toujours payer à la main. C'est une aide, pas une règle.

## Victoire (193–196)

- On gagne des points en **tenant** un battlefield, en le **conquérant**, par des sorts ou capacités, et par les Burn Out de l'adversaire (194.1).
- On gagne pendant un cleanup si on a au moins le score de victoire et plus de points que tous les autres (194.2). Le score de victoire par défaut est 8, et le mode ou des effets peuvent le changer (194.3).
- Les points ne descendent jamais sous 0 (194.4).
- On gagne aussi si un effet le dit, ou si on est le dernier joueur restant (195).
- La règle de conquête du dernier point (on ne gagne pas en conquérant si on n'a pas aussi marqué sur les autres battlefields ce tour-ci) est dans la section scoring (467–472) : à lire et à tester en priorité.

## Actions

Une `Action` est une **intention d'un joueur**, sérialisable, sans référence à des objets JavaScript. Familles :

- `Mulligan { cards }`
- `PlayCard { card, choices, payment }` (choix des cibles, modes, coûts additionnels, 349–359)
- `ActivateAbility { source, ability, choices, payment }`
- `StandardMove { units, destination }` (144, 445+)
- `PassPriority`, `PassFocus`
- `EndTurn`
- `Concede` (649)
- `ManualOverride { description, patch }` : mode manuel, toujours marqué comme tel dans le journal

`legalActions(state)` renvoie les actions possibles **à structure près** (par exemple `PlayCard` avec les cibles valides), et une fonction `isLegal(state, action)` vérifie une action complète avec une raison en cas de refus.

## Événements

Un `GameEvent` décrit **ce qui s'est passé**, dans l'ordre exact, avec un numéro de séquence. Exemples : `CardDrawn`, `RuneChanneled`, `CardPlayed`, `ChainItemAdded`, `ChainItemFinalized`, `ChainItemResolved`, `UnitMoved`, `DamageDealt`, `UnitKilled`, `ShowdownStarted`, `FocusPassed`, `BattlefieldConquered`, `BattlefieldHeld`, `PointsScored`, `TurnStarted`, `PhaseChanged`, `CleanupRan`, `GameWon`.

Chaque événement porte la **règle qui l'a produit** (`rule: "315.3"`) quand c'est pertinent. C'est ce qui permet la couverture des règles en production et le débogage.

Les événements ont une **visibilité** : publique, ou réservée à certains joueurs (une carte piochée n'est visible que par son propriétaire, les autres voient « une carte piochée »). Le filtrage est fait par `log`, pas par le serveur à la main.

## Vues par joueur

`viewFor(state, player)` renvoie ce que ce joueur a le droit de voir : sa main, ses decks réduits à leur taille, la main adverse réduite à sa taille, les objets publics, la chaîne, les choix en attente qui le concernent. Elle est utilisée par le serveur, par l'IA (qui ne doit pas tricher) et par les tests.
