# My Pilot Personal Edition

Pilotage des activités personnelles, dérivé de PST·PILOT, avec le Cristallisoir intégré pour faire mûrir les idées jusqu'aux projets.

- **Pilotage** : la journée, le prochain jour, les activités, le journal, les contacts — le moteur de My Pilot Pro 3.33.0 (ex-PST·PILOT), réglé pour la vie hors travail (catégories Projet, Maison, Formation, Démarche, Loisir ; modules professionnels désactivés).
- **Idées** : boîte à idées en bulles ou en tableau, regroupement automatique en méta-idées, cristallisation par Claude, puis conversion en activité du pilotage avec ses tâches.
- **Application de bureau** (.deb, .exe) : fonctionne seule, sans navigateur ni réseau, avec sa propre base ; elle se synchronise fiche par fiche avec le serveur.
- **Données** : une base SQLite, avec un historique des versions, des instantanés quotidiens et une réplication continue vers un stockage distant.
- **Claude** : via Claude Code connecté à votre compte claude.ai, donc décompté de l'abonnement Pro, sans compte API.

## Aide

L'application contient son aide : bouton **Aide** en haut à droite, ou touche **F1** (rubrique de l'onglet affiché). Le contenu est dans [web/pilot/aide.js](web/pilot/aide.js) : une rubrique = un objet ; à compléter à chaque nouvelle fonction.

## Démarrer

Prérequis : Docker avec Compose, ou Podman avec `podman compose` / `podman-compose`. Dans ce README, `docker compose …` s'écrit aussi `scripts/compose.sh …`, qui utilise le moteur présent sur la machine.

```sh
cp .env.example .env        # renseigner au minimum APP_PASSWORD
docker compose up -d --build
```

Ouvrir http://localhost:8080. Le premier lancement crée une base vide avec le profil personnel.

Pour reprendre des données PST·PILOT existantes : onglet **Données**, « Importer un fichier (remplacer) » puis choisir le `pstp-data.json`. Les réglages et catégories du fichier sont conservés ; seuls les modules professionnels sont coupés au premier import (réactivables dans les paramètres).

Sans Docker, pour développer : `cd server && npm start` (Node 22.13 ou plus récent), puis http://localhost:8080.

## Application de bureau et synchronisation

L'application de bureau embarque le même serveur et sa propre base SQLite : elle fonctionne sans connexion. Le serveur Docker sert de point de synchronisation entre les appareils (2 ou 3 machines) et garde la sauvegarde distante.

**Installer**
- Linux (Debian, Ubuntu, Mint…) : `sudo apt install ./my-pilot-personal-edition_X.Y.Z_amd64.deb`
- Windows : lancer `my-pilot-personal-edition-X.Y.Z-setup.exe`. L'installateur n'est pas signé : Windows SmartScreen demande une confirmation (« Informations complémentaires », puis « Exécuter quand même »).

Les données restent dans le dossier de l'utilisateur (`~/.config/My Pilot Personal Edition/data` sous Linux, `%APPDATA%\My Pilot Personal Edition\data` sous Windows) ; menu **Fichier → Ouvrir le dossier des données**. Désinstaller l'application ne les supprime pas.

**Relier une application au serveur**
1. Sur le serveur : définir `SYNC_TOKEN` dans `.env` (par exemple `openssl rand -hex 32`), puis `docker compose up -d`. Le serveur doit être joignable en HTTPS depuis les appareils (proxy ou VPN, voir plus bas).
2. Dans l'application : **Données → Synchronisation → Configurer**, saisir l'adresse du serveur et le jeton, puis « Enregistrer et synchroniser ».

**Comment ça fusionne** : chaque activité, note, contact, point de vigilance, idée… est une fiche avec sa date de modification. Deux appareils qui modifient des fiches différentes, même hors ligne, retrouvent les deux changements. Si la même fiche a changé des deux côtés, la plus récente l'emporte et l'autre version va dans le **journal des conflits** (onglet Données), d'où on peut la remettre en place. Les réglages globaux (paramètres, carte Pause, réglages des idées) sont chacun une fiche.

**Construire les paquets** (Node 22 ou plus récent) : `cd desktop && npm ci && npm run dist`. Le .deb et le .exe arrivent dans `dist/desktop/`. Depuis Linux, l'installateur Windows est construit sans wine.

## Réglages depuis l'application

Onglet **Données → Réglages du serveur** (ou **Réglages de l'application** dans l'application de bureau) : mot de passe et identifiant de l'interface web, jeton de synchronisation (avec un bouton pour en générer un), jeton Claude Code, et rythmes des sauvegardes. Les changements s'appliquent sans redémarrage.

- Une valeur saisie dans l'application est enregistrée dans la base de cette machine (jamais synchronisée) et l'emporte sur le fichier `.env` ; la case « Revenir à la valeur du fichier .env » annule la saisie.
- Les secrets ne sont jamais réaffichés. Un jeton de synchronisation généré s'affiche une seule fois : le copier aussitôt pour le saisir dans les applications.
- Au premier accès à un serveur sans mot de passe, l'application demande d'en choisir un avant d'aller plus loin (on peut remettre à plus tard seulement depuis `localhost`).
- Restent dans `.env`, car Docker les lit avant le démarrage : `PORT`, `BIND_ADDR`, `INSTALL_CLAUDE` et la réplication Litestream.

## Claude Code et l'abonnement claude.ai

Les cristallisations d'idées passent par Claude Code (`claude -p`, mode non interactif). Connecté à un compte claude.ai Pro ou Max, son usage est décompté des mêmes limites que claude.ai, sans facturation à part. La mise en place dépend de l'endroit où tourne My Pilot Personal Edition.

### Dans l'application de bureau

Rien à mettre dans un fichier : l'application utilise le Claude Code installé sur la même machine.

1. Installer Claude Code sur la machine (voir la documentation de Claude Code).
2. Dans un terminal, lancer `claude`, puis `/login` et se connecter avec le compte claude.ai. À faire une seule fois.
3. Dans l'application : **Données → Idées et Claude → Connexion à Claude**, mode « Automatique » ou « Claude Code sur le serveur », puis « Tester la connexion ».

### Sur le serveur Docker

Le conteneur n'a pas de navigateur pour se connecter : on lui donne un jeton longue durée, à placer dans le fichier **`.env` du serveur**.

1. **Sur un ordinateur où Claude Code est installé et connecté** (le vôtre, pas le serveur), lancer :
   ```sh
   claude setup-token
   ```
   La commande affiche un jeton (une longue chaîne). Le copier.
2. **Sur le serveur**, dans le dossier du projet (celui qui contient `docker-compose.yml`), ouvrir le fichier `.env`. Il a été créé à l'installation par `cp .env.example .env` ; s'il n'existe pas, le créer de la même façon.
3. Dans `.env`, la ligne existe déjà, vide, dans la section « Claude Code ». La compléter :
   ```sh
   CLAUDE_CODE_OAUTH_TOKEN=le_jeton_copié
   ```
4. Appliquer : `docker compose up -d` (le conteneur redémarre avec le jeton).

   Plus simple : coller le jeton dans **Données → Réglages du serveur → Modifier les réglages**, champ « Jeton Claude Code ». Pas de fichier à éditer ni de redémarrage.
5. Dans l'interface web du serveur : **Données → Idées et Claude → Connexion à Claude**, puis « Tester la connexion ».

Le jeton donne accès à votre abonnement : comme `SYNC_TOKEN` et `APP_PASSWORD`, il reste dans `.env`, qui n'est jamais versionné ni inclus dans les archives du projet.

Autre possibilité, sans jeton : se connecter directement dans le conteneur avec `docker compose exec -it app claude`, puis `/login`. La connexion est gardée dans le volume `claude-config`.

### Dans les deux cas

Le pont retire toujours `ANTHROPIC_API_KEY` de l'environnement de Claude Code, pour ne jamais basculer sur la facturation API par accident. Les demandes passent une par une, sans outils : Claude ne peut ni lire ni modifier de fichiers.

Si Claude Code n'est pas disponible, le mode copier-coller via une conversation claude.ai reste utilisable.

## Accès à distance

Le port est lié à `127.0.0.1` par défaut : rien n'est joignable de l'extérieur tant qu'on ne l'a pas décidé. Deux façons d'ouvrir l'accès :

- **VPN** (Tailscale, WireGuard) : seuls vos appareils y accèdent.
- **Caddy, en HTTPS public** : nécessaire pour qu'une autre personne rejoigne un espace partagé hébergé par votre serveur.

### Avec Caddy

1. Un nom de domaine qui pointe vers le serveur (enregistrement DNS A/AAAA, par exemple `pilot.ellast.eu`), et les ports 80 et 443 ouverts.
2. Dans `.env` : `PILOT_DOMAIN=pilot.ellast.eu`, `TRUST_PROXY=1`, un `APP_PASSWORD` solide et un `SYNC_TOKEN` (`openssl rand -hex 32`).
3. `docker compose --profile caddy up -d`. Caddy obtient et renouvelle seul le certificat ([deploy/Caddyfile](deploy/Caddyfile)).

L'authentification reste celle de l'application ; Caddy ne fait que le HTTPS et les en-têtes de sécurité. **N'ajoutez aucune authentification dans le proxy** (`basic_auth` de Caddy, `auth_basic` de Nginx, portail SSO…) : elle intercepterait le jeton de synchronisation, et l'application de bureau afficherait « une authentification « Basic » est configurée dans le proxy ».

Deux accès distincts :
- **navigateur** : page de connexion (`/connexion/`) avec l'identifiant et le mot de passe de l'interface. Elle ouvre une session de 30 jours (cookie `HttpOnly`, `SameSite=Strict`, `Secure` en HTTPS), qui se ferme partout si le mot de passe change. Aucune fenêtre d'identification du navigateur : cela fonctionne aussi avec un navigateur d'entreprise qui bloque l'authentification « Basic ». Bouton **Se déconnecter** dans Données → Réglages du serveur ;
- **applications de bureau** : le **jeton de synchronisation**, jamais le mot de passe. Il doit être défini sur le serveur (`SYNC_TOKEN` ou Données → Réglages) et saisi à l'identique dans chaque application (Données → Synchronisation). En cas de refus, l'application en donne le motif exact : pas de jeton sur le serveur, jeton différent, authentification d'un proxy, page web à la place de l'API, essais trop nombreux.

Protections de l'application :
- **mot de passe obligatoire** : avec `TRUST_PROXY=1`, le serveur refuse de démarrer sans `APP_PASSWORD`, sinon le premier visiteur pourrait le choisir ;
- **essais en série freinés** : après 5 échecs (mot de passe, jeton, invitation) depuis une même adresse, attente croissante de 1 à 60 s ; au 20ᵉ, adresse bloquée 15 min. Les échecs apparaissent dans `docker compose logs app` ;
- **seules routes sans mot de passe** : `/api/health` (répond `{"ok":true}`, rien d'autre), la page `/connexion/`, la page `/rejoindre/` qui explique les liens d'invitation, et les routes des espaces, protégées par les jetons de membre ;
- les scripts peuvent toujours s'authentifier en « Basic » (`curl -u identifiant:motdepasse`).

## Démarrage automatique (systemd)

Deux unités prêtes dans [deploy/systemd](deploy/systemd), à copier dans `/etc/systemd/system/`. Le dépôt est supposé dans `/opt/my-pilot-personal-edition` (sinon : `sudo systemctl edit <unité>`, puis `WorkingDirectory=…`).

**Avec Podman ou Docker** (installation habituelle) : l'unité lance la pile compose au démarrage de la machine. Le moteur est détecté par `scripts/compose.sh` (`podman compose`, `podman-compose`, puis `docker compose` ; `COMPOSE=…` pour l'imposer).

- **Podman « rootless »** (conteneurs lancés sous votre compte, sans `sudo`) : installer un **service utilisateur**. Les conteneurs et le volume de la base appartiennent à votre compte : un service système, lancé en root, démarrerait une autre pile, avec une base vide.

  ```bash
  mkdir -p ~/.config/systemd/user
  cp deploy/systemd/my-pilot-personal-edition.service ~/.config/systemd/user/
  systemctl --user daemon-reload
  systemctl --user enable --now my-pilot-personal-edition
  sudo loginctl enable-linger "$USER"     # démarrage au boot sans ouvrir de session
  ```

  Avec le Caddy fourni en rootless, autoriser les ports 80 et 443 : `net.ipv4.ip_unprivileged_port_start=80` dans `/etc/sysctl.d/`.
- **Podman en root ou Docker** : **service système**.

  ```bash
  sudo cp deploy/systemd/my-pilot-personal-edition.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable --now my-pilot-personal-edition
  ```

Les profils (Caddy, réplication) se choisissent dans `.env` : `COMPOSE_PROFILES=caddy` ou `COMPOSE_PROFILES=caddy,replication`.

**Mise à jour** : `git pull`, puis `systemctl --user reload my-pilot-personal-edition` (ou `sudo systemctl reload …`). Le rechargement **reconstruit l'image** puis remplace le conteneur ; un simple redémarrage, lui, reprend l'image existante : sans reconstruction, c'est l'ancienne version qui tourne.

**Sans Docker** (Node.js 22 ou plus récent) : service durci, sous un utilisateur dédié `mypilot`, données dans `/var/lib/my-pilot-personal-edition`, configuration dans `/etc/my-pilot-personal-edition.env` (format systemd : pas de commentaire en fin de ligne).

```bash
sudo useradd --system --home /var/lib/my-pilot-personal-edition --shell /usr/sbin/nologin mypilot
sudo install -m 600 deploy/systemd/my-pilot-personal-edition.env.example /etc/my-pilot-personal-edition.env
sudo nano /etc/my-pilot-personal-edition.env
sudo cp deploy/systemd/my-pilot-personal-edition-node.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now my-pilot-personal-edition-node
journalctl -u my-pilot-personal-edition-node -f
```

Un plantage est relancé après 5 s ; une configuration incorrecte (`TRUST_PROXY=1` sans mot de passe) arrête le service avec le code 78 et son motif dans le journal, sans relance en boucle.

## Espaces partagés (0.8)

Partager avec une personne qui a sa propre installation, chiffré de bout en bout. Conception : [docs/PARTAGE.md](docs/PARTAGE.md).

- L'espace est hébergé par **votre serveur** (celui de votre synchronisation privée), qui doit être joignable en HTTPS (Caddy ci-dessus).
- Tout se gère dans l'**application de bureau**, onglet Données, bloc **Partage** :
  - **votre nom affiché** ;
  - **créer un espace** ;
  - **inviter** : un lien à usage unique, valable 7 jours, à transmettre par le canal de votre choix ;
  - **rejoindre un espace** à partir d'un lien reçu ;
  - **membres** : liste avec empreintes, retrait d'un membre.
- Pour vos propres autres appareils : une invitation « mon autre appareil » (rôle propriétaire).
- Le serveur ne voit jamais le contenu : seulement des fiches chiffrées, leur nombre, leur taille et leurs dates.

Dans l'onglet **Idées** (0.8.0) :
- **partager** une idée depuis sa fenêtre, ou la **déposer directement** dans un espace depuis la boîte à idées ;
- **filtrer** : Toutes, Mes idées, ou un espace ;
- **Reçues** : ce que les autres membres ont fait. Une pastille sur l'onglet Idées compte les nouveautés, et une notification du système apparaît si l'application est en arrière-plan.

Dans l'onglet **Activités** (0.9.0) :
- **partager** une activité depuis sa fenêtre : ses notes et tâches suivent ;
- **attribuer** une tâche à un membre (champ « Pour ») ;
- **Reçues — activités partagées** en tête de l'onglet.

En 0.10.0 :
- **fusion champ par champ** : deux personnes, ou deux appareils, qui modifient deux champs différents d'une même fiche gardent chacune leur modification ;
- **nouvelle clé de chiffrement** quand un membre est retiré ;
- **invitation en lecture seule**.

Pour essayer sans toucher à vos données : `node scripts/banc-partage.mjs --pret` lance un serveur hôte et deux appareils (« Stella » et « Paul ») sur votre machine, à ouvrir dans le navigateur.

## Veilles

Onglet **Veilles** :
- chaque veille réunit des flux RSS ou Atom, des filtres (mots-clés, ancienneté) et un rythme (toutes les N heures, chaque jour, chaque semaine) ;
- elle produit une fiche quand elle trouve du nouveau ;
- « Tester » fait un essai à blanc ;
- chaque élément d'une fiche peut devenir une idée ou une activité.

Une veille est exécutée par l'instance choisie dans sa fenêtre :
- **le serveur**, qui tourne même quand vos appareils sont éteints ;
- **un appareil**, seulement quand l'application y est ouverte.

Les flux du réseau local sont refusés par défaut : `VEILLES_RESEAU_LOCAL=1` dans le `.env` (ou dans l'environnement de l'application) pour les autoriser.

Prochaines étapes, détaillées dans [docs/INCUBATION.md](docs/INCUBATION.md) :
- opérations par Claude : notation, résumés, synthèse ;
- sources spécialisées : NVD, CISA KEV, France Travail.

## Sauvegardes

Trois niveaux, détaillés dans [docs/SAUVEGARDES.md](docs/SAUVEGARDES.md) :

| Niveau | Où | Rythme | Restauration |
|---|---|---|---|
| Historique des versions | dans la base | toutes les 5 min pendant la saisie, et à chaque « Enregistrer » | onglet Données, « Historique des versions » |
| Instantanés | volume `pilot-data`, dossier `snapshots` | quotidien, et à la demande | `scripts/restore.sh snapshot FICHIER.db` |
| Réplication distante | S3 compatible ou SFTP, via Litestream | continu (quelques secondes) | `scripts/restore.sh replica [horodatage]` |

## Versions

Le projet suit le [versionnage sémantique](https://semver.org/lang/fr/) ; voir [CHANGELOG.md](CHANGELOG.md) et [docs/VERSIONS.md](docs/VERSIONS.md). Publier une version : `scripts/release.sh 0.2.0`, qui produit aussi l'archive `dist/my-pilot-personal-edition-v0.2.0.zip` (dossier `my-pilot-personal-edition-v0.2.0/` à l'extraction). Après `git push`, le workflow GitHub **Releases** crée la release correspondante, avec les notes du CHANGELOG et l'archive du code.

## Organisation du dépôt

```
server/        API et stockage (Node, node:sqlite, aucune dépendance)
desktop/       application de bureau (Electron) et construction des paquets
web/pilot/     PST·PILOT adapté : index.html généré + perso.js (couche personnelle)
web/cristallisoir/  le Cristallisoir (onglet Idées)
web/rejoindre/ page publique qui explique les liens d’invitation
vendor/        My Pilot Pro d'origine (ex-PST·PILOT), non modifié
scripts/       construction du pilotage, publication, restauration, banc d’essai du partage
deploy/        Caddy (HTTPS public) et modèles Litestream
docs/          architecture, sauvegardes, versions
```

`web/pilot/index.html` est généré : modifier `scripts/build_pilot.py` ou `web/pilot/perso.js`, puis `python3 scripts/build_pilot.py`.
