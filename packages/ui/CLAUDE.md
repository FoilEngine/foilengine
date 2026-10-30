# CLAUDE.md — packages/ui

Le design system : tokens, composants, moteur de son, motion.

## Dépendances

- **Autorisées** : React, rien de métier.
- **Interdites** : éditer les tokens à la main (ils sont générés depuis le repo `brand`).

## API publique

Tokens CSS et TS, composants, `Sound`, primitives de motion.

## Points d'attention

- La source de vérité est `FoilEngine/brand` (`04-design-system/`). Relire ses règles avant de créer un composant.
- Respecter `prefers-reduced-motion` ; le son a son propre interrupteur et ses niveaux.

## À lire

- `docs/10-clients.md`
- repo brand : 04-design-system/README.md, motion.md, sound.md, cartes.md

Les règles générales du projet sont dans le `CLAUDE.md` racine.
