# 05 — Données de cartes (`@foilengine/codex`)

`codex` récupère les données de cartes, les normalise et produit des **snapshots versionnés** utilisés par le reste du projet. Le moteur ne va jamais chercher de données en ligne.

## Sources

| Source | Ce qu'elle apporte | Ce qu'elle n'apporte pas |
| --- | --- | --- |
| **Riftcodex** (`api.riftcodex.com`, API ouverte, sans clé) | Données de jeu : nom, type, supertype, rareté, domaines, coût (énergie, puissance), might, texte (riche et brut), mots-clés, set, numéro de collection, `riftbound_id`, artiste, image, orientation, et trois drapeaux : `alternate_art`, `overnumbered`, `signature`. Identifiant TCGplayer. | Le statut foil, les promos, les prix |
| **Catalogue TCGplayer** (via l'identifiant `tcgplayer_id`) | Les impressions (normal ou foil), la rareté de catalogue (dont « Showcase » et « Promo »), les sets de promos, les prix | Le texte de règles fiable |
| **Pages officielles de Riot** (Rules Hub, errata, bannissements, FAQ) | Errata, cartes interdites, rulings | Données structurées : à saisir à la main dans `codex/data/manual/` |

Le détail des raretés, traitements et promos est documenté dans le repo `brand` (`04-design-system/cartes.md`). Résumé utile pour le code :

- Le numéro de collection porte l'information : suffixe `a` pour une alt art, numéro au-dessus du total du set pour une overnumbered, astérisque pour une signature, préfixe `R` pour une rune, `T` pour un jeton.
- Ultimate (une carte par set qui en a une) et Special Art n'ont pas de drapeau : ils se repèrent par le nom ou la rareté de catalogue.
- Les rares et épiques sont toujours foil en booster.

## Modèle normalisé

On sépare deux notions :

- **`CardDefinition`** : la carte **en tant que règle** (un seul enregistrement pour toutes les impressions d'une même carte) : nom, type, supertype, domaines, coûts, might, texte de règles en vigueur, mots-clés, tags.
- **`Printing`** : une **impression** de cette carte : set, numéro, rareté, traitements (`alternateArt`, `overnumbered`, `signature`, `ultimate`, `specialArt`, `promo` avec son origine, `metal`), finitions disponibles (`normal`, `foil`), image, artiste, identifiants externes.

Le moteur ne connaît que `CardDefinition`. Le client et la collection utilisent `Printing`. Deux impressions de la même carte sont strictement équivalentes en jeu.

## Snapshots

- La commande `foil codex sync` interroge les sources, normalise, valide (Zod) et écrit `packages/codex/data/snapshots/<date>/<set>.json`, plus un `manifest.json` (version, sources, nombres de cartes, empreinte).
- Les snapshots sont **commités**. Les tests et les simulations utilisent un snapshot précis, jamais le réseau.
- Un diff lisible entre deux snapshots est produit à chaque synchronisation (cartes ajoutées, texte modifié, rareté modifiée) : c'est ce qui signale un errata à répercuter dans `cards`.

## Données saisies à la main

Dans `packages/codex/data/manual/` :

- `errata.json` : carte, date, ancien texte, nouveau texte, source.
- `bans.json` : format, carte, date, source.
- `booster-config.json` : composition des boosters et taux de tirage par set, avec pour chaque taux sa source et s'il est officiel ou estimé par la communauté (voir `brand/04-design-system/cartes.md`).
- `rulings.json` : rulings officiels utiles aux tests.

## Validation de deck

`codex` expose `validateDeck(deck, format, snapshot)` : nombre de cartes, legend, chosen champion, 12 runes, battlefields, domaines autorisés par la legend, nombre maximal d'exemplaires, cartes interdites. Les règles exactes sont dans la section 101 des Core Rules et dans les Tournament Rules.

## Formats d'import de deck

À supporter : liste texte (une ligne par carte avec quantité), codes de deck des principaux deckbuilders (Piltover Archive, Riftbound.gg, Rift Atlas) si leur format est documenté, et un format Foil natif en JSON. Chaque format a ses tests avec des exemples réels.
