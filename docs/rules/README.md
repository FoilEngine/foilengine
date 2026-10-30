# docs/rules — Les règles officielles

Ce dossier contient les documents de règles officiels de Riftbound. **Ils font foi** pour tout le moteur.

## Source hierarchy

When two sources disagree, the higher one wins:

1. Card text, including official errata.
2. The Core Rules PDF.
3. Official FAQ and rulings.
4. The Tournament Rules (formats and deckbuilding).
5. Our docs (`docs/`).

Our docs are only a reading map. When they conflict with the PDF, the PDF is right: fix the doc, and never write code from the doc. Unofficial sources (riftboundfaq.com, guides, Discord) settle nothing. When the PDF is ambiguous, open a question in `questions.md`.

## Version identifiers

A Core Rules version is identified by `CR-<last update date>`, taken from the "Last Updated" line of the PDF. The current version is **`CR-2026-10-09`**. Riot's file names use release labels (`RUP5`); they are kept here as aliases only. The engine's `rulesVersion`, the rule index (`index/CR-2026-10-09.json`) and the question entries use the `CR-` identifier.

## Fichiers attendus

À télécharger depuis le Rules Hub officiel (playriftbound.com, section Rules Hub) et à déposer ici, en gardant la version dans le nom :

| Fichier | Contenu |
| --- | --- |
| `core-rules-2026-10-09.pdf` | Core Rules en vigueur, mises à jour le 2026-10-09. Identifiant : **`CR-2026-10-09`** (alias Riot : `RUP5`, d'après le nom du fichier officiel `RiftboundCoreRulesRUP5_En_EN.pdf`) |
| `tournament-rules-2026-08-27.pdf` | Tournament Rules en vigueur, mises à jour le 2026-08-27 (construction de deck en tournoi, formats, sideboard). Fichier officiel : `RiftboundTournamentRulesRUP5_en_EN.pdf` |
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
