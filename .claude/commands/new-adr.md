---
description: Crée une décision d'architecture (ADR)
argument-hint: <titre de la décision>
---

Crée un ADR pour : $ARGUMENTS.

1. Lis `docs/decisions/README.md` et les ADR existants pour éviter un doublon ou une contradiction.
2. Prends le numéro suivant et crée `docs/decisions/NNNN-titre-court.md` avec le modèle du README, statut **Proposé**.
3. Remplis contexte, décision, conséquences et alternatives écartées, de façon concrète.
4. Si l'ADR remplace une décision existante, mets l'ancienne au statut « Remplacé par NNNN ».
5. Ajoute la ligne dans l'index du README.

N'implémente rien tant que le statut n'est pas passé à « Accepté ».
