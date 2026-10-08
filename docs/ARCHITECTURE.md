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

La base SQLite range chaque document (`pilot`, `ideas`) **fiche par fiche** : une ligne par activité, note, contact, organisation, point de vigilance, idée, idée unifiée, et une ligne par réglage global (paramètres, carte Pause…). Chaque ligne porte :

- une **horloge hybride** (HLC : millisecondes, compteur, identifiant d'appareil), comparable d'un appareil à l'autre ;
- un **numéro de séquence** local, qui dit ce qui a changé depuis le dernier échange ;
- l'**origine** (l'appareil qui a fait la dernière modification).

Les pages continuent de lire et d'écrire un document entier (`GET/PUT /api/docs/:id`) : le serveur le découpe et le réassemble. Si une page envoie un document construit sur une version dépassée (autre onglet, fiches arrivées par synchronisation), le serveur fait une **fusion à trois voies** à partir de la version de départ, conservée dans la table `bases`, et renvoie la version fusionnée, que la page reprend dès qu'aucune saisie n'est en cours.

La clé `meta` du pilotage reste propre à chaque appareil et n'est jamais synchronisée.

## Synchronisation

```
appareil                                   hub (serveur Docker)
changesSince(envoyé, origine = moi) ──────▶ applyRemote : la fiche la plus récente (HLC) gagne
applyRemote ◀───────────────────────────── changesSince(curseur, origine ≠ appareil)
curseurs « envoyé » et « reçu » mis à jour
```

- Échange toutes les 30 s, 2,5 s après une modification, et à la demande (onglet Données).
- Une fiche locale envoyée ou en attente, remplacée par une version plus récente venue d'ailleurs, est copiée dans le **journal des conflits** avant d'être écrasée.
- Les suppressions voyagent comme des fiches marquées supprimées.
- Le hub authentifie les appareils par le jeton `SYNC_TOKEN`.

## Application de bureau

`desktop/main.cjs` démarre le serveur dans le processus Electron, sur `127.0.0.1` et un port libre, avec un jeton de session déposé en cookie : aucune autre application de la machine ne peut lire les données par ce port. Les fichiers du serveur et des pages sont copiés tels quels dans les ressources de l'application.

## API

| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/api/health` | version, schéma |
| GET | `/api/docs` | liste des documents |
| GET / PUT | `/api/docs/:id` | lire / écrire (fusion à trois voies si la version de départ est dépassée) |
| GET | `/api/docs/:id/rev` | numéro de version, pour suivre les changements |
| GET | `/api/docs/:id/revisions[/:rev]` | historique |
| POST | `/api/docs/:id/restore/:rev` | restaurer une version |
| GET / POST | `/api/backup` | lister / créer un instantané |
| POST | `/api/sync` | échange avec un appareil (rôle hub, jeton `SYNC_TOKEN`) |
| GET / PUT | `/api/sync/status`, `/api/sync/config` | état et réglages de la synchronisation de cet appareil |
| POST | `/api/sync/now` | lancer un échange |
| GET / POST | `/api/sync/conflicts`, `/api/sync/conflicts/seen` | journal des conflits |
| GET | `/api/claude/status` | Claude Code disponible ? |
| POST | `/api/claude` | `{prompt, json, model}` → `{json}` ou `{text}` |

## Pilotage : couche personnelle

`web/pilot/index.html` est produit par `scripts/build_pilot.py` à partir de l'original, avec quelques patchs ciblés (démarrage différé, onglet Idées, bloc Données). Tout le reste passe par `web/pilot/perso.js`, chargé après le script principal, qui remplace des fonctions globales de PST·PILOT : profil (`vierge`, `normaliser`), persistance (`modifie`, `enregistrer`, `ecrireFichier`, `majEtat`) et rendu de l'onglet Idées (`rendre`).

## Idées → activités

Le Cristallisoir, ouvert dans l'onglet Idées, envoie `creer-activite` au pilotage par `postMessage` (même origine vérifiée). Le pilotage crée l'activité dans la catégorie la plus proche (Projet par défaut) et une tâche par première étape, puis répond avec l'identifiant de l'activité, gardé dans l'idée unifiée pour pouvoir la rouvrir.
