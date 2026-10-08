# My Pilot Personal Edition

Pilotage des activités personnelles, dérivé de PST·PILOT, avec le Cristallisoir intégré pour faire mûrir les idées jusqu'aux projets.

- **Pilotage** : la journée, le prochain jour, les activités, le journal, les contacts — le moteur de PST·PILOT 3.13.1, réglé pour la vie hors travail (catégories Projet, Maison, Formation, Démarche, Loisir ; modules professionnels désactivés).
- **Idées** : boîte à idées en bulles ou en tableau, regroupement automatique en méta-idées, cristallisation par Claude, puis conversion en activité du pilotage avec ses tâches.
- **Application de bureau** (.deb, .exe) : fonctionne seule, sans navigateur ni réseau, avec sa propre base ; elle se synchronise fiche par fiche avec le serveur.
- **Données** : une base SQLite, avec un historique des versions, des instantanés quotidiens et une réplication continue vers un stockage distant.
- **Claude** : via Claude Code connecté à votre compte claude.ai, donc décompté de l'abonnement Pro, sans compte API.

## Démarrer

Prérequis : Docker avec Compose.

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

## Claude Code et l'abonnement claude.ai

Le serveur appelle `claude -p` (Claude Code en mode non interactif). Connecté à un compte claude.ai Pro ou Max, l'usage est décompté des mêmes limites que claude.ai, sans facturation à part.

1. Sur votre poste, avec Claude Code installé et connecté à votre compte : `claude setup-token`.
2. Copier le jeton obtenu dans `.env` : `CLAUDE_CODE_OAUTH_TOKEN=…`, puis `docker compose up -d`.
3. Dans **Idées → Réglages → Connexion à Claude**, choisir « Claude Code sur le serveur » (ou « Automatique ») et cliquer « Tester la connexion ».

Autre possibilité : se connecter directement dans le conteneur avec `docker compose exec -it app claude`, puis `/login`. La connexion est gardée dans le volume `claude-config`.

Le pont retire toujours `ANTHROPIC_API_KEY` de l'environnement de Claude Code, pour ne jamais basculer sur la facturation API par accident. Les demandes passent une par une, sans outils (Claude ne peut ni lire ni modifier de fichiers sur le serveur).

Dans l'application de bureau, c'est le Claude Code de la machine qui est utilisé : l'installer et s'y connecter une fois (`claude`, puis `/login`) suffit.

Si Claude Code n'est pas disponible, le mode copier-coller via une conversation claude.ai reste utilisable.

## Accès à distance

Le port est lié à `127.0.0.1` par défaut. Pour y accéder depuis d'autres appareils, passer par un VPN (Tailscale, WireGuard) ou un proxy HTTPS (Caddy, Traefik) devant le conteneur, et définir `APP_PASSWORD`. L'authentification Basic ne doit jamais circuler en HTTP clair sur Internet.

## Sauvegardes

Trois niveaux, détaillés dans [docs/SAUVEGARDES.md](docs/SAUVEGARDES.md) :

| Niveau | Où | Rythme | Restauration |
|---|---|---|---|
| Historique des versions | dans la base | toutes les 5 min pendant la saisie, et à chaque « Enregistrer » | onglet Données, « Historique des versions » |
| Instantanés | volume `pilot-data`, dossier `snapshots` | quotidien, et à la demande | `scripts/restore.sh snapshot FICHIER.db` |
| Réplication distante | S3 compatible ou SFTP, via Litestream | continu (quelques secondes) | `scripts/restore.sh replica [horodatage]` |

## Versions

Le projet suit le [versionnage sémantique](https://semver.org/lang/fr/) ; voir [CHANGELOG.md](CHANGELOG.md) et [docs/VERSIONS.md](docs/VERSIONS.md). Publier une version : `scripts/release.sh 0.2.0`, qui produit aussi l'archive `dist/my-pilot-personal-edition-v0.2.0.zip` (dossier `my-pilot-personal-edition-v0.2.0/` à l'extraction).

## Organisation du dépôt

```
server/        API et stockage (Node, node:sqlite, aucune dépendance)
desktop/       application de bureau (Electron) et construction des paquets
web/pilot/     PST·PILOT adapté : index.html généré + perso.js (couche personnelle)
web/cristallisoir/  le Cristallisoir (onglet Idées)
vendor/        PST·PILOT d'origine, non modifié
scripts/       construction du pilotage, publication, restauration
deploy/        modèles de configuration Litestream
docs/          architecture, sauvegardes, versions
```

`web/pilot/index.html` est généré : modifier `scripts/build_pilot.py` ou `web/pilot/perso.js`, puis `python3 scripts/build_pilot.py`.
