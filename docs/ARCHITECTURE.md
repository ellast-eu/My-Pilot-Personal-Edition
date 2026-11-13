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

- Échange toutes les 30 s, 2,5 s après une modification, et à la demande (onglet Options).
- Une fiche locale envoyée ou en attente, remplacée par une version plus récente venue d'ailleurs, est copiée dans le **journal des conflits** avant d'être écrasée.
- Les suppressions voyagent comme des fiches marquées supprimées.
- Le hub authentifie les appareils par le jeton `SYNC_TOKEN`.
- Les documents d'espaces partagés (`s-…`) sont exclus de cet échange, dans les deux sens : ils ont leur propre canal chiffré.

### Fusion champ par champ (0.10)

- Chaque fiche envoyée porte ses **versions d'origine** (`bases`), c'est-à-dire la ou les versions dont elle découle.
  - Pour une modification faite ici, c'est la dernière version échangée (table `rec_bases`).
  - Pour une version reçue puis relayée, ce sont celles qu'elle portait (colonne `records.parent`).
  - Pour une fusion, ce sont ses deux sources.
- À la réception (`applyRemote`) :
  - si la version locale fait partie des origines, c'est une simple suite, appliquée telle quelle ;
  - sinon, si la version locale a été écrite ici ou que des origines sont connues, `fusionner3` fusionne champ par champ à partir de la version commune. Un champ modifié des deux côtés prend la valeur la plus récente (HLC) et est noté dans le journal avec son nom ;
  - sinon, la plus récente gagne.
- Une fusion qui diffère de la version reçue est écrite ici avec une horloge plus récente, puis renvoyée dans le même cycle.
- `accepted` dans la réponse de l'échange liste les fiches gardées telles quelles par l'autre côté. Elles deviennent la nouvelle version commune.
- L'hôte d'un espace ne lit pas les fiches : chez lui, la plus récente gagne, et ce sont les appareils membres qui fusionnent en recevant. Les versions d'origine circulent chiffrées.
- `putDoc` (page partie d'une version dépassée) fusionne aussi champ par champ.

### Clés et rôles (0.10)

- **Retrait d'un membre** : l'appareil propriétaire crée l'époque n+1 et l'enveloppe pour chaque membre restant (`POST /api/spaces/:id/rekey`). Les nouvelles fiches sont scellées avec la dernière époque.
- **Arrivée** : l'arrivant reçoit toutes les époques.
- **Clés reçues** : un membre n'accepte une clé que si son expéditeur est l'appareil du lien d'invitation, ou un membre dont la carte chiffrée porte cette clé publique.
- **Fiche d'une époque inconnue** : le cycle récupère les clés ; si la clé manque encore, il s'arrête sans avancer son curseur.
- **Rôle `lecteur`** : l'hôte n'accepte de lui que sa carte. Les pages annulent ses modifications et ouvrent les fenêtres en consultation.

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
- **Pilotage** : même principe pour les activités. `D.chantiers` et `D.notes` contiennent les fiches des espaces, avec `_sp`. Une note prend toujours l'espace de son activité (`affecterPartages`), et `privD()` est ce qui part vers le document `pilot`. `suitesOuvertes` est filtré : une tâche partagée attribuée (`suite.pour`) à un autre membre n'apparaît pas dans « En attente ». Le fil de discussion d'une activité, ce sont ses notes, signées par leur auteur (pas de collection séparée).
- **Boîte « Reçues »** (table `inbox`) : alimentée à la réception des fiches d'un espace, avant de les appliquer, par comparaison avec la version locale. Les catégories sont partage, modification, cristallisation, activité et retrait. Le premier échange après l'arrivée n'est pas signalé, et les gestes d'un membre qui porte votre nom (votre autre appareil) sont écartés.

## Veilles (0.11)

- Document `veilles`, avec trois collections :
  - `veilles` : configuration ;
  - `fiches` : résultats ;
  - `etats` : dernière exécution, nombre de nouveautés, erreur.
- Ce document est synchronisé comme les autres. Chaque veille porte son exécutant : `serveur`, ou `appareil:<id>`.
- `server/src/veilles.js` :
  - toutes les minutes, l'instance exécute les veilles qui lui sont attribuées et arrivées à échéance (`aEcheance`, heure locale du fuseau enregistré) ;
  - `telecharger` récupère les flux en refusant les adresses privées, y compris après redirection, avec une taille et un délai limités ;
  - `lireFlux` lit RSS 2.0 et Atom sans dépendance ;
  - `filtrer`, puis dédoublonnage par clé d'élément (guid, lien ou titre) sur les fiches existantes.
- API :

| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/api/veilles/info` | exécutant de cette instance et nom de l'appareil |
| POST | `/api/veilles/flux` | vérifier un flux (titre, 5 derniers éléments) |
| POST | `/api/veilles/essai` | essai à blanc d'une configuration, rien n'est enregistré |
| POST | `/api/veilles/:id/executer` | exécuter maintenant, ici |

**Opérations par Claude** (0.12) : `traiterParClaude` traite les nouveaux éléments par paquets de 40.
- Chaque demande donne note, résumé, action proposée et raison, ainsi que la synthèse, demandée au premier paquet seulement.
- Elle passe par `claude.ask` (Claude Code, abonnement) avec le modèle choisi.
- Les éléments sont transmis en JSON entre balises `<elements>`, présentés comme des données.
- La réponse est filtrée par `lireReponse`.
- Le plafond quotidien est compté dans `etats[].appels`.

**Sources spécialisées** (0.13) : `lireSource` selon `type`.
- `rss` : flux RSS ou Atom.
- `kev` : JSON du catalogue CISA, ajouts des N derniers jours (`lireKev`).
- `nvd` : API NVD 2.0, `pubStartDate` / `pubEndDate`, jusqu'à 2 000 résultats, score CVSS dans `score` (`lireNvd`).
- `francetravail` : jeton OAuth2 `client_credentials` (realm `/partenaire`, scope `api_offresdemploiv2 o2dsoffre`), gardé jusqu'à expiration. Une recherche `offres/search` par mot-clé (`motsCles`, `departement`, `minCreationDate` / `maxCreationDate`, `range=0-149`). Le contrat de l'offre est placé dans `contrat` (`lireOffres`).
- Filtres supplémentaires : `scoreMin`, `contrats`.

**Révision** : `revisionSiDue` produit au plus une fiche `type: 'revision'` par semaine (questions et réponses), comptée dans le plafond.
- Les éléments sous le seuil sont écartés et comptés dans `stats.ecartesNote`.

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
