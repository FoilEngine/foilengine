# Questions de règles ouvertes

Une entrée par question. On ne retire jamais une entrée : on la marque résolue, avec la source.

## Modèle

```markdown
### Q-NNN — Short title

- **Rules**: 431.4.a, 115
- **Version**: CR-2026-10-09
- **Question**: what is unclear, with an example situation.
- **Sources consulted**: Core Rules passages, official FAQ and rulings. Unofficial sources (RiftJudge, riftboundfaq.com, guides, Discord) may be listed but settle nothing (see the source hierarchy in `README.md`).
- **Provisional decision**: what the engine does meanwhile, and the test that encodes it (marked `question` in the coverage report).
- **Status**: open | resolved (date, official source)
```

## Questions

### Q-001 — Runes supplémentaires du second joueur au premier tour

- **Règles** : 315.3, 115.2, section des modes de jeu
- **Version** : CR-2026-10-09 (question ouverte sur CR-1.4)
- **Question** : la règle 315.3 dit que le joueur actif canalise 2 runes. Les guides de jeu indiquent que le second joueur en canalise 3 à son premier tour. Vérifier dans le PDF où et comment ce bonus est défini (ajustements de premier tour en 115.2 ou section du mode 1v1), et s'il dépend du mode.
- **Sources consultées** : Core Rules 1.4 (315.3), guides de jeu non officiels, confirmation du mainteneur.
- **Décision** : en 1v1, le premier joueur canalise 2 runes à son premier tour, le second joueur en canalise 3. Ensuite, 2 runes par tour pour les deux. Le test doit citer le numéro exact de la règle qui définit ce bonus dans le PDF (115.2 ou section du mode) ; s'il n'est pas trouvé, le test est marqué `question` jusqu'à ce qu'il le soit.
- **Statut** : résolue sur le comportement (2026-10-30, mainteneur). Numéro de règle à confirmer dans le PDF.
- **À faire (CR-2026-10-09)** : le bonus du second joueur doit être retrouvé dans le nouveau PDF. Les numéros cités plus haut viennent de CR-1.4 : dans CR-2026-10-09, 315.3 est l'en-tête « Channel Phase » et c'est 431.4.a qui dit qu'un joueur canalise deux runes pendant la Channel Phase. La renumérotation se fait avec `/rules-update` au début de M1.
