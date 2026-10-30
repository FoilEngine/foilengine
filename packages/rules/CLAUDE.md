# CLAUDE.md — packages/rules

Le moteur de règles : l'arbitre. Décide de la légalité, résout tout, détecte la victoire.

## Dépendances

- **Autorisées** : `@foilengine/types` uniquement.
- **Interdites** : réseau, fichiers, horloge (`Date`, `performance`), `Math.random`, variables globales mutables, `console`, toute bibliothèque d'entrée-sortie.

## API publique

`createGame`, `legalActions`, `isLegal`, `apply`, `outcome`, `viewFor`, `pendingDecision`, `characteristics`, et l'API d'effets utilisée par `cards`.

## Points d'attention

- Toujours relire le texte exact de la règle dans `docs/rules/` avant de l'implémenter, et citer son numéro dans le test et dans un commentaire d'en-tête.
- Règle 124 : changer de zone crée un nouvel objet (nouvel `ObjectId`).
- Toute modification d'état passe par une action de jeu atomique (`actions/`), pour que remplacements, déclencheurs et cleanups s'appliquent.
- La boucle de la chaîne (HOT FEPR) et le cleanup à point fixe sont bornés : dépasser la borne lève `EngineInvariantError`.
- Les caractéristiques ne sont jamais stockées calculées : `characteristics()` applique les couches à la lecture.
- Un choix du joueur est une `Decision`, jamais un callback.
- En cas de doute sur une règle : `docs/rules/questions.md`, pas de supposition.

## À lire

- `docs/02-game-model.md`
- `docs/03-rules-engine.md`
- `docs/06-testing.md`
- `docs/rules/`

Les règles générales du projet sont dans le `CLAUDE.md` racine.
