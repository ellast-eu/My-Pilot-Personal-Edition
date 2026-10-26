# Versions

## Numérotation

`MAJEUR.MINEUR.CORRECTIF`, selon le [versionnage sémantique](https://semver.org/lang/fr/) :

- **MAJEUR** : changement qui demande une action (migration de données non automatique, configuration à modifier).
- **MINEUR** : nouvelle fonction, compatible.
- **CORRECTIF** : correction sans nouvelle fonction.

Tant que le projet est en `0.x`, une version mineure peut encore changer des comportements.

Trois numéros distincts coexistent :

| Numéro | Où | Rôle |
|---|---|---|
| Version de l'application | `VERSION`, affichée dans l'en-tête | ce document |
| Schéma de la base | migrations dans `server/src/db.js` | appliquées automatiquement au démarrage |
| Base My Pilot Pro | `vendor/`, `scripts/build_pilot.py` | version de My Pilot Pro (ex-PST·PILOT) dont dérive le pilotage |

## Messages de commit

[Conventional Commits](https://www.conventionalcommits.org/fr/), en français : `feat(pilot): …`, `fix(server): …`, `docs: …`, `chore(release): …`. Portées courantes : `server`, `pilot`, `idees`, `deploy`, `docs`.

## Publier

1. Ajouter les changements sous `## [Non publié]` dans `CHANGELOG.md` au fil de l'eau.
2. `scripts/release.sh 0.2.0` : lance les tests, met à jour `VERSION`, date le CHANGELOG, commit et tag `v0.2.0`.
3. L'archive `dist/my-pilot-personal-edition-v0.2.0.zip` est créée au passage ; elle s'extrait dans un dossier `my-pilot-personal-edition-v0.2.0/` qui contient tout l'historique Git. Pour la refaire seule : `scripts/package.sh`.
4. `git push` : le workflow GitHub **Releases** crée le tag et la release à partir du CHANGELOG.
5. Sur le serveur : `git pull && docker compose up -d --build`. Faire un instantané avant une mise à jour majeure.

## Reprendre une nouvelle version de My Pilot Pro (ex-PST·PILOT)

1. Déposer le fichier dans `vendor/`, retirer l'ancien et mettre à jour `SOURCE` dans `scripts/build_pilot.py`.
2. `python3 scripts/build_pilot.py`. Les patchs s'appliquent **les uns après les autres** : chaque ancre doit exister une seule fois dans le résultat des patchs précédents. Si un patch échoue, son ancre a changé dans l'original (ou un patch précédent l'a modifiée) : l'ajuster.
3. Vérifier qu'aucune insertion n'est en double : quand la pro ajoute elle-même un élément que la perso insérait (bouton Aide, onglet Idées…), retirer le patch correspondant.
4. Ouvrir l'application et vérifier le pilotage (persistance, onglets Idées et Veilles, aide, fenêtre À propos), puis commit `feat(pilot): base My Pilot Pro x.y.z`.
