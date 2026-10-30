# 04 — Cartes et effets (`@foilengine/cards`)

Implémenter les effets de plus de mille cartes, c'est le plus gros chantier du projet. Il faut donc que l'ajout d'une carte soit simple, sûr et vérifiable.

## Principe

- La plupart des cartes sont **des données** écrites dans un DSL typé : déclencheurs, conditions, cibles, actions atomiques. Pas de code.
- Une carte qui ne rentre pas dans le DSL a une **implémentation sur mesure**, en TypeScript, qui n'utilise que l'API d'effets exposée par `rules`. C'est l'exception, et chaque cas doit être justifié dans un commentaire.
- Quand trois cartes sur mesure partagent un motif, on l'ajoute au DSL.

## Le DSL (forme indicative)

```ts
defineCard('ogn-011-298', {
  keywords: ['Assault'],
  abilities: [
    triggered({
      when: on.played(self),
      effect: seq(
        target(unit({ controller: 'opponent', at: 'any' })),
        deal(2, 'target'),
      ),
    }),
    activated({
      cost: [exhaust(self), energy(1)],
      timing: 'action',
      effect: draw(1),
    }),
  ],
});
```

Les briques du DSL suivent les sections des Core Rules :

| Brique | Sections |
| --- | --- |
| Déclencheurs (`on.played`, `on.attack`, `on.defend`, `on.conquer`, `on.hold`, `on.dies`, début ou fin de tour…) | capacités déclenchées (360+) |
| Capacités passives et effets continus | 360+, couches 473+ |
| Effets de remplacement | 360+ |
| Capacités activées, coûts, timing (Action, Reaction) | 360+, 806, 813 |
| Actions atomiques (`deal`, `draw`, `move`, `ready`, `exhaust`, `kill`, `heal`, `buff`, `recycle`, `banish`, `recall`, `channel`, `add`, `score`, `createToken`…) | 407–444, 700+ |
| Ciblage et sélecteurs | jouer une carte (349+), non-ciblable (756) |
| Mots-clés | 800+ (un module par mot-clé) |

La liste exacte des mots-clés et leur texte se lisent dans la section 800 du PDF. Chaque mot-clé a son module, ses tests et sa ligne dans le rapport de couverture.

## Statut de chaque carte

Chaque carte a un statut, stocké avec son implémentation :

| Statut | Signification |
| --- | --- |
| `missing` | Pas implémentée. En partie, on bascule en mode manuel pour elle. |
| `partial` | Une partie de l'effet fonctionne. Les écarts sont décrits dans `notes`. |
| `complete` | Effet complet, tests verts. |
| `verified` | Complète, et vérifiée contre les rulings officiels et FAQ (liens dans `sources`). |

Le rapport de couverture des cartes (`pnpm cards:coverage`) donne, par set et par legend, le pourcentage de cartes `complete` ou `verified`. La console l'affiche. Une legend est « jouable » quand toutes les cartes de son deck champion sont au moins `complete`.

## Ajouter une carte (workflow `/implement-card`)

1. Récupérer la définition de la carte dans le snapshot `codex` (texte exact, coût, domaine, might, mots-clés, errata en vigueur).
2. Lire le texte et identifier les règles concernées. En cas de doute, chercher dans les FAQ officielles et noter la question dans `docs/rules/questions.md`.
3. Écrire les tests d'abord, avec le harnais de scénarios (`06-testing.md`) : un test par comportement, avec les cas limites (cible illégale, carte qui quitte le plateau en cours de résolution, interaction avec un remplacement…).
4. Écrire l'implémentation en DSL, ou sur mesure si nécessaire.
5. Mettre à jour le statut et les `sources`.
6. Vérifier que le fuzzer tourne toujours sans violation d'invariant avec la carte incluse dans les decks aléatoires.

## Mode manuel

Pour une carte `missing` ou `partial`, le serveur propose au joueur de résoudre l'effet à la main : il décrit ce qu'il fait (texte libre) et applique les modifications avec des actions atomiques autorisées (déplacer, infliger des dégâts, piocher…). L'action est enregistrée comme `ManualOverride` dans le journal, avec la carte concernée. Une partie qui contient des actions manuelles est exclue des statistiques de simulation et des données d'entraînement de l'IA.

## Errata et cartes interdites

Les errata changent le texte de règles d'une carte imprimée. L'implémentation suit **le texte en vigueur**, et la version d'errata appliquée est enregistrée. La liste des cartes interdites vient de `codex` et est vérifiée à la validation du deck, selon le format.
