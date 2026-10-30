---
description: Intègre une nouvelle version des Core Rules
argument-hint: <version, ex. 1.5>
---

Intègre la version $ARGUMENTS des Core Rules, en suivant `docs/rules/README.md`.

1. Vérifie que le nouveau PDF est dans `docs/rules/`. Archive l'ancien dans `docs/rules/archive/`.
2. Réindexe (`foil rules index`) et compare avec l'index précédent : règles ajoutées, supprimées, renumérotées, au texte modifié.
3. Écris `docs/rules/changes/$ARGUMENTS.md` : la liste des changements, regroupés par section, avec leur impact sur le moteur.
4. Marque les tests concernés en `stale` et donne la liste.
5. Ne change pas `rulesVersion` du moteur tant que tous les tests `stale` n'ont pas été relus et mis à jour.
