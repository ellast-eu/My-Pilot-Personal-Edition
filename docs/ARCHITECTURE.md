# Architecture

```
navigateur                                   conteneur app                     volume pilot-data
┌──────────────────────────────┐            ┌──────────────────────┐          ┌──────────────────┐
│ /pilot/  PST·PILOT + perso.js│── /api ───▶│ server.js (Node)     │──SQLite─▶│ pilot.db (WAL)   │
│   └ onglet Idées (iframe)    │            │  ├ docs + révisions  │          │ snapshots/       │
│      /cristallisoir/?embed=1 │── /api ───▶│  ├ instantanés       │          └────────┬─────────┘
└──────────────────────────────┘            │  └ pont Claude Code ─┼─▶ claude -p      │ Litestream
                                            └──────────────────────┘   (abonnement)   ▼ (profil replication)
                                                                                 S3 / SFTP distant
```

## Données

Chaque module est un **document JSON** dans la table `documents` : `pilot` (l'objet de données de PST·PILOT, même format que `pstp-data.json`) et `ideas` (l'état du Cristallisoir). Ce choix garde intacte la logique de PST·PILOT, qui travaille sur un objet complet en mémoire.

- Écriture : `PUT /api/docs/:id` avec `baseRev` ; un écart renvoie `409` (modifié ailleurs) et l'interface demande quoi garder.
- Historique : table `revisions`, alimentée avec un pas minimal de 5 minutes et à chaque enregistrement manuel.
- Hors ligne : chaque page garde une copie dans le navigateur et la renvoie au retour du serveur, si personne n'a modifié la version du serveur entre-temps.

Évolution possible : éclater `pilot` en tables (activités, notes, contacts) le jour où des requêtes côté serveur deviennent utiles (statistiques, recherche, synchronisation fine entre appareils).

## API

| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/api/health` | version, schéma |
| GET | `/api/docs` | liste des documents |
| GET / PUT | `/api/docs/:id` | lire / écrire (verrou optimiste) |
| GET | `/api/docs/:id/revisions[/:rev]` | historique |
| POST | `/api/docs/:id/restore/:rev` | restaurer une version |
| GET / POST | `/api/backup` | lister / créer un instantané |
| GET | `/api/claude/status` | Claude Code disponible ? |
| POST | `/api/claude` | `{prompt, json, model}` → `{json}` ou `{text}` |

## Pilotage : couche personnelle

`web/pilot/index.html` est produit par `scripts/build_pilot.py` à partir de l'original, avec quelques patchs ciblés (démarrage différé, onglet Idées, bloc Données). Tout le reste passe par `web/pilot/perso.js`, chargé après le script principal, qui remplace des fonctions globales de PST·PILOT : profil (`vierge`, `normaliser`), persistance (`modifie`, `enregistrer`, `ecrireFichier`, `majEtat`) et rendu de l'onglet Idées (`rendre`).

## Idées → activités

Le Cristallisoir, ouvert dans l'onglet Idées, envoie `creer-activite` au pilotage par `postMessage` (même origine vérifiée). Le pilotage crée l'activité dans la catégorie la plus proche (Projet par défaut) et une tâche par première étape, puis répond avec l'identifiant de l'activité, gardé dans l'idée unifiée pour pouvoir la rouvrir.
