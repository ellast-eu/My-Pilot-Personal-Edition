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
- Les documents d'espaces partagés (`s-…`) sont exclus de cet échange, dans les deux sens : ils ont leur propre canal chiffré.

## Espaces partagés (chiffrés de bout en bout)

Conception et décisions : [PARTAGE.md](PARTAGE.md).

```
appareil membre                                         hôte de l'espace (serveur de la propriétaire)
document s-<id> en clair ── sceller (AES-256-GCM) ────▶ /api/spaces/<id>/sync : fiches chiffrées,
           ◀──────────────── ouvrir ─────────────────── la plus récente (HLC) gagne, origine = membre
```

- **Membre = appareil** : chaque appareil a sa paire X25519 (table `meta`, jamais synchronisée). Rôles : propriétaire (invite, retire) ou membre. Statuts : `en_attente`, `actif`, `retire`.
- **Fiche** : AES-256-GCM avec la clé de l'époque en cours. Données associées : `doc|coll|id|hlc`, si bien que l'hôte ne peut ni échanger deux fiches ni rejouer une ancienne version. Une fiche illisible est ignorée et signalée.
- **Invitation** : lien `https://hôte/rejoindre/#v1.<espace>.<invitation>.<secret>.<empreinte>.<nom>`.
  - Tout ce qui suit `#` reste côté client.
  - L'hôte ne reçoit que l'identifiant d'invitation, à usage unique et valable 7 jours.
  - L'arrivant envoie sa clé publique et une preuve : HMAC du secret sur l'espace, l'invitation et sa clé publique.
- **Remise de la clé** : l'appareil propriétaire qui a créé l'invitation vérifie la preuve. Une clé publique substituée par l'hôte est donc refusée. Il enveloppe ensuite la clé d'espace par Diffie-Hellman statique (sa clé privée, la clé publique de l'arrivant), puis HKDF et AES-GCM. L'arrivant n'accepte qu'une clé remise par l'appareil dont le lien donnait l'empreinte.
- **Tables** :
  - côté hôte : `host_spaces`, `host_members` (jetons stockés hachés), `host_keys`, `host_invites` ;
  - côté appareil : `my_spaces` (jeton, clés, invitations en cours, cache des membres).
- **Cartes de membres** : nom, couleur, empreinte et nom d'appareil vivent dans la collection `members` de l'espace, donc chiffrés.
- **Cristallisoir** : les idées des espaces sont fusionnées dans la même liste que les idées privées, avec un marqueur `_sp`. À l'envoi, chacune repart vers son document : `ideas` pour le privé, `s-<id>` pour le partagé, le partagé en premier. Chaque modification faite ici porte `modifiePar` / `modifieLe` ; `par` désigne le membre qui a proposé l'idée.
- **Boîte « Reçues »** (table `inbox`) : alimentée à la réception des fiches d'un espace, avant de les appliquer, par comparaison avec la version locale. Les catégories sont partage, modification, cristallisation, activité et retrait. Le premier échange après l'arrivée n'est pas signalé, et les gestes d'un membre qui porte votre nom (votre autre appareil) sont écartés.

## Exposition sur Internet

- **Caddy** ([deploy/Caddyfile](../deploy/Caddyfile)) fait le HTTPS et les en-têtes de sécurité. L'authentification reste dans l'application.
- **`TRUST_PROXY=1`** : l'adresse du visiteur est lue dans la dernière valeur de `X-Forwarded-For`. Sans mot de passe, le serveur refuse alors de démarrer.
- **`garde.js`** freine les identifiants faux : mot de passe, jeton de synchronisation, jeton de membre, invitation. 5 échecs passent sans délai, puis l'attente double de 1 à 60 s, puis l'adresse est bloquée 15 min au 20ᵉ échec. Une requête sans identifiant (premier accès d'un navigateur) ne compte pas.

## Application de bureau

`desktop/main.cjs` démarre le serveur dans le processus Electron, sur `127.0.0.1` et un port libre, avec un jeton de session déposé en cookie : aucune autre application de la machine ne peut lire les données par ce port. Les fichiers du serveur et des pages sont copiés tels quels dans les ressources de l'application.

## API

| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/api/health` | public : `{ok}` ; avec identifiants : version, schéma, mode |
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
| POST | `/api/spaces` | hôte : créer un espace (jeton `SYNC_TOKEN`) |
| POST | `/api/spaces/:id/join` | hôte : rejoindre avec une invitation (sans jeton, freiné) |
| GET | `/api/spaces/:id/members`, `/api/spaces/:id/key` | hôte : membres, clés enveloppées pour ce membre |
| POST | `/api/spaces/:id/invites`, `…/members/:m/approve`, `…/members/:m/revoke` | hôte : inviter, remettre la clé, retirer (propriétaires) |
| POST | `/api/spaces/:id/sync` | hôte : échange de fiches chiffrées (jeton de membre) |
| GET | `/api/partage` | appareil : identité et espaces rejoints |
| PUT | `/api/partage/identite` | appareil : nom affiché, couleur |
| POST | `/api/partage/espaces`, `/api/partage/rejoindre`, `/api/partage/sync` | appareil : créer, rejoindre, synchroniser |
| POST | `/api/partage/espaces/:id/invitations`, `…/membres/:m/retirer`, `…/quitter` | appareil : inviter, retirer, quitter |
| GET / POST | `/api/partage/recues`, `/api/partage/recues/vues` | appareil : boîte « Reçues », marquer comme vues |
| PUT | `/api/partage/notifications` | appareil : notifications du système activées ou non |
| GET | `/api/claude/status` | Claude Code disponible ? |
| POST | `/api/claude` | `{prompt, json, model}` → `{json}` ou `{text}` |

## Pilotage : couche personnelle

`web/pilot/index.html` est produit par `scripts/build_pilot.py` à partir de l'original, avec quelques patchs ciblés (démarrage différé, onglet Idées, bloc Données). Tout le reste passe par `web/pilot/perso.js`, chargé après le script principal, qui remplace des fonctions globales de PST·PILOT : profil (`vierge`, `normaliser`), persistance (`modifie`, `enregistrer`, `ecrireFichier`, `majEtat`) et rendu de l'onglet Idées (`rendre`).

## Idées → activités

Le Cristallisoir, ouvert dans l'onglet Idées, envoie `creer-activite` au pilotage par `postMessage` (même origine vérifiée). Le pilotage crée l'activité dans la catégorie la plus proche (Projet par défaut) et une tâche par première étape, puis répond avec l'identifiant de l'activité, gardé dans l'idée unifiée pour pouvoir la rouvrir.
