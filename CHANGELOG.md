# Journal des modifications

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versionnage : [SemVer](https://semver.org/lang/fr/).

## [Non publié]

## [0.7.0] - 2026-10-08

### Ajouts
- Réglages modifiables depuis l'application (Données → Réglages) : mot de passe et identifiant, jeton de synchronisation (avec génération), jeton Claude Code, rythmes des sauvegardes. Appliqués sans redémarrage, prioritaires sur le `.env`, secrets jamais réaffichés.
- Premier accès à un serveur sans mot de passe : choix d'un mot de passe demandé avant toute chose.
- Onglet Données : emplacement des instantanés affiché, et bouton « Ouvrir le dossier des instantanés » dans l'application de bureau.

### Modifications
- Documentation : mise en place de Claude Code détaillée séparément pour l'application de bureau et pour le serveur (emplacement de `CLAUDE_CODE_OAUTH_TOKEN` dans le `.env` du serveur).
- Paquets de bureau : description, résumé et page d'accueil (https://ellast.eu) mis à jour.

## [0.6.0] - 2026-10-08

### Ajouts
- Application de bureau autonome (Electron) : serveur et base SQLite embarqués, fonctionne sans navigateur ni réseau. Paquets .deb (Linux) et installateur .exe (Windows).
- Synchronisation fiche par fiche entre les applications et le serveur Docker (jeton `SYNC_TOKEN`) : fusion automatique des modifications de fiches différentes, « la plus récente gagne » sur une même fiche, journal des conflits avec remise en place de la version écartée.
- Fusion à trois voies côté serveur quand une page envoie des données construites sur une version dépassée (deux onglets, fiches arrivées par synchronisation).
- Onglet Données : bloc Synchronisation (adresse, jeton, état, fiches en attente, conflits).

### Modifications
- Base de données au schéma v2 (fiches) ; les bases existantes sont migrées automatiquement au démarrage.
- L'état de sauvegarde affiche « Enregistré » ; l'onglet Idées n'a plus de barre de défilement parasite.

## [0.5.2] - 2026-10-08

### Modifications
- Menu Pause sans référence professionnelle : proposition à la fin de n'importe quelle activité, rappel « tant que l'application est ouverte », desserts « jamais proposés d'office », carte enregistrée sur le serveur.
- Derniers libellés « PST Pilot » visibles remplacés (nom par défaut dans les paramètres, imports de fichier et de configuration).

## [0.5.1] - 2026-10-08

### Modifications
- Préfixe technique `my-pilot-personal-edition` : projet Compose, image Docker, chemin de réplication par défaut, noms des fichiers exportés et tampons du navigateur (repris automatiquement depuis l'ancien préfixe).
- `scripts/package.sh` : archive versionnée qui s'extrait dans `my-pilot-personal-edition-vX.Y.Z/`, historique Git compris ; appelée par `scripts/release.sh`.

### À noter
- Si une réplication Litestream tournait déjà avec le chemin par défaut `pilot-perso`, fixer `LITESTREAM_PATH=pilot-perso` dans `.env` pour continuer sur la même réplique.

## [0.5.0] - 2026-10-08

### Modifications
- L'application s'appelle désormais **My Pilot Personal Edition** par défaut. Un jeu de données qui portait un ancien nom par défaut (Pilot Perso, My Pilot, PST Pilot) prend le nouveau ; un nom choisi dans les paramètres est conservé.

### Retraits
- Onglet Données : rapport de période (texte et PDF), nom, fonction et entité du rapport, faits marquants, objectifs et besoins, compte-rendu du jour.

## [0.4.0] - 2026-10-08

### Modifications
- Onglet Idées : les fiches (idée, méta-idée, idée unifiée) s'ouvrent en fenêtres centrées, comme celles du pilotage, au lieu d'un volet latéral. Le reste du pilotage s'assombrit ; un clic à côté ou Échap ferme la fenêtre.
- Idée unifiée : objectifs, premières étapes et points de vigilance sont modifiables avant de créer l'activité (une valeur par ligne).

## [0.3.0] - 2026-10-08

### Retraits
- Restes du cadre professionnel : filtre gestionnaire de l'import Excel, colonne Excel des champs, modèle de catégories Enedis, listes métier (états d'affaire, statuts de déshérence, segments, motifs de convocation…), tuiles compteur et permanence du rapport.

### Modifications
- Bloc Diagnostic propre à Pilot Perso : serveur, version des données, tampon hors ligne, Claude, versions de l'application, du schéma et de la base PST·PILOT.
- Journal des versions lu dans le CHANGELOG du projet (route `/api/changelog`).
- Listes modifiables limitées à celles des catégories actives et aux listes communes (types de note, organisations, civilités, relations).
- « Rétablir les catégories personnelles » remplace le chargement du modèle Enedis.
- Export CSV des activités : colonnes communes puis champs propres de chaque catégorie.
- Vocabulaire générique dans les fiches et le rapport (référence, activités suivies, nature des activités).

## [0.2.0] - 2026-10-08

### Retraits
- Modules assistance téléphonique et compteur de traitement supprimés de la version personnelle : écran du jour, paramètres, exports CSV, journal et rapports.
- Planning de la semaine retiré de l'onglet Idées : il n'était pas relié aux dates du pilotage.

### Modifications
- Onglet Idées présenté en fenêtres, comme les autres vues du pilotage.
- Les catégories des idées sont celles des activités, gérées à un seul endroit.
- Une idée unifiée porte une date prévue, reprise par l'activité créée (vide : à planifier).
- Connexion à Claude, export et import des idées déplacés dans l'onglet Données ; seule la sensibilité du regroupement reste dans Idées.

## [0.1.0] - 2026-10-08

Première version : PST·PILOT 3.13.1 décliné en pilotage personnel, avec le Cristallisoir.

### Ajouts
- Serveur Node sans dépendance : API de documents JSON sur SQLite (node:sqlite), verrou optimiste, historique des versions et restauration non destructive.
- Instantanés quotidiens de la base et à la demande ; réplication continue vers S3 ou SFTP avec Litestream (profil `replication`).
- Pilotage personnel : catégories Projet, Maison, Formation, Démarche, Loisir ; listes et rubriques personnelles ; modules permanence téléphonique et compteur de traitement désactivés.
- Données enregistrées sur le serveur, tampon hors ligne dans le navigateur, gestion des conflits entre appareils.
- Onglet Idées : le Cristallisoir intégré (bulles ou tableau, méta-idées, cristallisation), conversion d'une idée unifiée en activité avec ses tâches.
- Pont Claude Code : cristallisation automatique sur l'abonnement claude.ai, sans compte API ; modes copier-coller et clé API conservés.
- Image Docker, docker-compose, scripts de publication et de restauration.
