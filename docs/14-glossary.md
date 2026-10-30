# 14 — Glossaire

Termes du jeu (anglais, tels qu'utilisés dans le code) et termes du projet.

## Jeu

| Terme | Sens | Core Rules |
| --- | --- | --- |
| Legend (Champion Legend) | La carte qui définit le deck et ses domaines, dans la zone de legend | 111, 173–176 |
| Chosen Champion | L'unité champion choisie, placée dans la zone de champion au départ | 112 |
| Main Deck | Le deck de cartes jouables | 101, 114 |
| Rune Deck | Les 12 runes | 114, 161 |
| Battlefield | Lieu où les unités combattent et que l'on contrôle pour marquer | 169–172 |
| Base | La zone de chaque joueur où arrivent ses unités et équipements | 107 |
| Domain | Une des six couleurs (Fury, Calm, Mind, Body, Chaos, Order) | 134 |
| Energy | Ressource sans domaine, produite en épuisant une rune | 163 |
| Power | Ressource de domaine, produite en recyclant une rune | 163 |
| Rune Pool | Réserve conceptuelle d'énergie et de puissance, vidée à chaque phase principale et en fin de tour | 165–167 |
| Might | La force d'une unité | 137, 143 |
| Exhaust / Ready | Incliner (épuiser) / redresser | 315.1, 407+ |
| Recycle | Mettre une carte sous son deck | 407+ |
| Channel | Mettre en jeu des runes depuis le rune deck | 315.3 |
| Hold | Marquer en contrôlant un battlefield au début de son tour | 315.2, 467+ |
| Conquer | Marquer en prenant le contrôle d'un battlefield pendant son tour | 467+ |
| Burn Out | Devoir piocher avec un main deck vide | 315.4 |
| Showdown | Fenêtre où les joueurs jouent des sorts à tour de rôle sur un battlefield | 341–348 |
| Combat | Affrontement d'unités adverses sur un battlefield | 459–466 |
| Chain | Zone temporaire des cartes et capacités en cours de résolution | 327–340 |
| Pending / Finalized | États d'un élément de la chaîne | 329 |
| HOT FEPR | Le processus de résolution : Handle Outstanding Tasks, puis Finalize, Execute, Pass, Resolve | 332–340 |
| Priority | Droit d'agir de façon discrétionnaire | 312 |
| Focus | Droit d'agir pendant un showdown ouvert | 313 |
| Neutral / Showdown, Open / Closed | Les deux axes de l'état du tour | 307–310 |
| Cleanup | Vérifications automatiques après les changements d'état | 318–324 |
| Contested | Statut d'un battlefield disputé, qui déclenche un showdown | 323, 344 |
| Token | Objet de jeu créé par un effet, qui n'est pas une carte | 179–187 |
| Layer | Ordre d'application des effets continus | 473–480 |
| Action / Reaction | Mots-clés de timing des sorts et capacités | 806, 813 |
| Overnumbered, Alt art, Signature, Ultimate | Traitements de collection d'une impression | — (voir `05-codex-data.md`) |

## Projet

| Terme | Sens |
| --- | --- |
| Moteur, arbitre | `@foilengine/rules` |
| Vue | Ce qu'un joueur a le droit de voir (`viewFor`) |
| Intention | Une action envoyée par un client, pas encore validée |
| Journal | La suite ordonnée des événements d'une partie |
| Replay | Un journal rejouable avec sa graine et ses decks |
| Empreinte | Hash stable d'un état, pour vérifier le déterminisme |
| Scénario | Un test de règle ou de carte écrit avec le harnais de `testkit`, rangé dans `spec` |
| Invariant | Propriété vérifiée à chaque étape par le fuzzer |
| Mode manuel | Résolution à la main d'une carte non implémentée (`ManualOverride`) |
| Point faible | Carte ou coup qui coûte le plus de victoires à un deck |
| Snapshot codex | Version figée des données de cartes |
