# docs/rules — Les règles officielles

Ce dossier contient les documents de règles officiels de Riftbound. **Ils font foi** pour tout le moteur.

## Fichiers attendus

À télécharger depuis le Rules Hub officiel (playriftbound.com, section Rules Hub) et à déposer ici, en gardant la version dans le nom :

| Fichier | Contenu |
| --- | --- |
| `core-rules-1.4.pdf` | Core Rules en vigueur (version 1.4, Vendetta, mise à jour le 2026-03-30 au moment de la rédaction) |
| `tournament-rules-<date>.pdf` | Tournament Rules en vigueur (construction de deck en tournoi, formats, sideboard) |
| `faq/*.pdf` ou `faq/*.md` | FAQ officielles par set |
| `errata/*.md` | Errata officiels, recopiés avec leur source |

Les versions précédentes restent dans `archive/` : elles servent à rejouer les anciens replays et à comparer les textes.

## Index

`foil rules index` lit le PDF et produit `index/<version>.json` : une entrée par règle avec son numéro, son titre, son texte et une empreinte du texte. C'est la base du rapport de couverture des règles (voir `docs/06-testing.md`).

## Nouvelle version des Core Rules

Utiliser `/rules-update <version>` :
1. déposer le nouveau PDF et archiver l'ancien ;
2. réindexer ;
3. comparer les deux index : règles ajoutées, supprimées, renumérotées, au texte modifié ;
4. les tests des règles modifiées passent en `stale` ;
5. produire un résumé des changements dans `changes/<version>.md` ;
6. relire et mettre à jour chaque test `stale`, puis passer `rulesVersion` du moteur à la nouvelle version.

Riot publie aussi des notes de patch des règles : les citer dans `changes/<version>.md`.

## Questions ouvertes

Toute règle ambiguë, contradictoire ou absente va dans `questions.md`. On ne devine jamais.
