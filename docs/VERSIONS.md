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
| Base PST·PILOT | `vendor/`, `scripts/build_pilot.py` | version de PST·PILOT dont dérive le pilotage |

## Messages de commit

[Conventional Commits](https://www.conventionalcommits.org/fr/), en français : `feat(pilot): …`, `fix(server): …`, `docs: …`, `chore(release): …`. Portées courantes : `server`, `pilot`, `idees`, `deploy`, `docs`.

## Publier

1. Ajouter les changements sous `## [Non publié]` dans `CHANGELOG.md` au fil de l'eau.
2. `scripts/release.sh 0.2.0` : lance les tests, met à jour `VERSION`, date le CHANGELOG, commit et tag `v0.2.0`.
3. `git push && git push --tags`.
4. Sur le serveur : `git pull && docker compose up -d --build`. Faire un instantané avant une mise à jour majeure.

## Reprendre une nouvelle version de PST·PILOT

1. Déposer le fichier dans `vendor/` et mettre à jour `SOURCE` dans `scripts/build_pilot.py`.
2. `python3 scripts/build_pilot.py`. Si un patch échoue, son ancre a changé dans l'original : l'ajuster.
3. Vérifier le pilotage (persistance, onglet Idées), puis commit `feat(pilot): base PST·PILOT x.y.z`.
