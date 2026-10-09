# Journal des modifications

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versionnage : [SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Ajouts
- **Onglet Veilles** : des flux RSS ou Atom collectés à votre rythme, filtrés, dédoublonnés et rangés en fiches.
  - **Nouvelle veille** à partir d'un modèle (Point cyber et Point CVE, à partir des flux du CERT-FR) ou vide.
  - **Fenêtre d'une veille** :
    - **sources** : plusieurs flux, chacun avec un bouton « Vérifier » qui affiche son titre et ses derniers articles ;
    - **filtres** : mots-clés à garder ou à écarter, sans tenir compte des accents ni de la casse ; ancienneté maximale ; nombre d'éléments par fiche ;
    - **rythme** : toutes les N heures, chaque jour à une heure donnée, ou chaque semaine ;
    - **exécutant** au choix : le serveur, ou cet appareil quand l'application est ouverte ;
    - **sortie** : notification, fiche même sans nouveauté.
  - **Tester** : essai à blanc qui montre ce qui serait collecté, gardé et nouveau, sans rien enregistrer.
  - **Exécuter maintenant**.
  - **Fiches** : non lues mises en avant, pastille sur l'onglet, notification du système. Sur chaque élément, « → Idée à creuser » et « → Activité à faire ».
  - Ce qui a déjà figuré dans une fiche n'est jamais repris. Les 100 dernières fiches de chaque veille sont gardées.
  - Configuration et fiches synchronisées entre vos appareils comme le reste.
- **Récupération des flux protégée** :
  - adresses du réseau local refusées (`VEILLES_RESEAU_LOCAL=1` pour les autoriser) ;
  - redirections vérifiées ;
  - 3 Mo et 15 s au plus par flux ;
  - contenu lu comme du texte, jamais exécuté.

## [0.10.0] - 2026-10-09

### Ajouts
- **Fusion champ par champ** :
  - quand une même fiche (activité, note, idée, contact…) est modifiée sur deux appareils, ou par deux membres d'un espace, les champs modifiés d'un seul côté sont tous gardés ;
  - pour un même champ modifié des deux côtés, la valeur la plus récente l'emporte et le champ est nommé dans le journal des conflits ; « Remettre l'écartée » ne reprend que ce champ ;
  - chaque modification voyage avec sa version d'origine (chiffrée dans les espaces), ce qui permet de distinguer une simple suite d'une modification concurrente ;
  - vaut aussi pour deux onglets ouverts sur le même appareil.
- **Nouvelle clé au retrait d'un membre** : l'espace passe à une nouvelle clé de chiffrement, remise aux membres restants. Ce que l'espace contiendra ensuite reste illisible pour la personne retirée.
  - Les arrivants reçoivent toutes les clés successives et lisent donc tout l'historique.
  - Une nouvelle clé n'est acceptée que si elle vient d'un membre authentifié par sa carte chiffrée.
  - Le numéro de clé est affiché dans le bloc Partage.
- **Rôle lecteur** : « Inviter en lecture seule ».
  - La personne lit tout (idées, activités, notes) sans rien pouvoir modifier : fenêtres en consultation, modifications annulées, et l'hôte refuse toute écriture sauf sa carte de membre.
  - Les notes et tâches qu'elle ajoute à une activité partagée restent dans son pilotage privé.
  - Les tâches d'un espace en lecture seule n'apparaissent pas dans « En attente ».

### Corrections
- Une invitation créée pendant une synchronisation en cours pouvait être perdue : l'arrivant restait « en attente » sans recevoir la clé.

### Modifications
- Schéma de la base v5 (migration automatique) : versions de référence par fiche, versions d'origine, champs en conflit.

## [0.9.0] - 2026-10-09

### Ajouts
- **Activités partagées** (application de bureau) : depuis la fenêtre d'une activité, « Partager cette activité, avec ses notes et tâches, dans… ».
  - L'activité, ses notes et ses tâches sont communes aux membres de l'espace. Une note ou une tâche ajoutée à une activité partagée est partagée avec elle.
  - **Auteurs** : chaque note et tâche partagée est signée (« par Paul »). La fenêtre de l'activité indique qui l'a proposée et qui l'a modifiée en dernier.
  - **Attribution** : champ « Pour » dans la fenêtre d'une tâche partagée. Une tâche attribuée à un autre membre n'apparaît plus dans vos listes « En attente » ; celles qui vous sont attribuées sont marquées « pour vous ».
  - **Retirer du partage** : une copie, avec ses notes et tâches, revient dans le pilotage privé, et l'activité disparaît de l'espace pour tous.
  - Repère « partagée » à côté du libellé dans la liste des activités.
- **Depuis une idée partagée** : en créant l'activité, proposition de la partager dans le même espace.
- **Reçues — activités partagées**, en tête de l'onglet Activités : activité partagée, modifiée ou retirée, nouvelle note ou tâche, tâche qui vous est attribuée, tâche terminée. Pastille sur l'onglet Activités, notification du système.
- Les notes et tâches arrivées en même temps qu'une activité ne sont pas signalées une par une.

### Modifications
- La pastille de l'onglet Idées ne compte plus que les nouveautés des idées. La boîte « Reçues » de l'onglet Idées n'affiche plus que les idées.
- Garde-fou : si les données du pilotage sont remplacées (import de fichier), les activités partagées connues sont remises en place avant tout envoi, pour ne jamais vider un espace par accident.

## [0.8.0] - 2026-10-09

### Ajouts
- **Partage d'idées** dans l'onglet Idées (application de bureau) :
  - **fiche vivante** : une idée partagée est la même pour tous les membres de l'espace, chacun peut la modifier, la regrouper et la cristalliser ;
  - **partager** depuis la fenêtre d'une idée ou d'une idée unifiée (ses idées d'origine suivent) ; **retirer du partage** ramène une copie dans vos idées privées ;
  - **déposer directement** une idée dans un espace depuis la boîte à idées ;
  - **filtre** Toutes / Mes idées / chaque espace ; pastille à la couleur de la personne qui a proposé l'idée ; auteur et dernière modification dans la fenêtre ;
  - **cristallisation** : des idées de deux espaces différents ne se mélangent pas ; une idée privée cristallisée avec des idées partagées rejoint l'espace, après confirmation ;
  - une idée partagée devenue activité chez un membre est signalée comme telle chez les autres.
- **Boîte « Reçues »** : ce que les autres membres ont partagé, modifié, cristallisé, transformé en activité ou retiré. Ce qui existait déjà au moment de rejoindre n'est pas signalé.
- **Notifications** :
  - pastille avec le nombre de nouveautés sur l'onglet Idées ;
  - notification du système quand l'application est en arrière-plan, désactivable dans Données → Partage.
- **Banc d'essai** `node scripts/banc-partage.mjs [--pret]` : un serveur hôte et deux appareils simulés sur une seule machine, sans toucher à vos données.

### Modifications
- Schéma de la base v4 (migration automatique) : boîte « Reçues ».
- Export des idées : seulement les idées privées.
- Ancien code de partage hérité de la version claude.ai retiré du Cristallisoir.

## [0.8.0-a] - 2026-10-09

### Ajouts
- **Espaces partagés chiffrés de bout en bout** (première étape) : onglet Données, bloc Partage.
  - Nom affiché, empreinte de l'appareil.
  - Créer un espace hébergé par votre serveur, inviter une personne ou un autre de vos appareils par un lien à usage unique, rejoindre un espace, liste des membres, retrait, quitter.
  - Le serveur hôte ne stocke que des fiches chiffrées (AES-256-GCM). Les clés sont remises par échange X25519, après vérification que l'arrivant détient le lien.
  - Le partage d'idées depuis l'onglet Idées vient avec la 0.8.0.
- Page publique `/rejoindre/` qui explique quoi faire d'un lien d'invitation.
- **Exposition sur Internet avec Caddy** : `deploy/Caddyfile`, profil `docker compose --profile caddy`, variables `PILOT_DOMAIN` et `TRUST_PROXY`.

### Sécurité
- Essais d'identifiants en série freinés puis bloqués par adresse (mot de passe, jetons, invitations), avec journalisation.
- Derrière Caddy (`TRUST_PROXY=1`), le serveur refuse de démarrer sans mot de passe.
- `/api/health` sans identifiants ne répond plus que `{"ok":true}`.

### Modifications
- Schéma de la base v3 (migration automatique) : tables des espaces côté hôte et côté appareil.

## [0.7.1] - 2026-10-08

### Corrections
- « ＋ Ajouter à la liste… » ne proposait aucune saisie dans l'application de bureau et enregistrait la valeur `__add__` : la saisie se fait maintenant dans une fenêtre de l'application. Les `__add__` déjà enregistrés sont effacés au chargement.
- Listes déroulantes (rattachement d'une note, etc.) : les libellés longs sont raccourcis, le texte complet reste en info-bulle. La liste ne déborde plus de la fenêtre.

### Documentation
- Conception du partage et du travail à plusieurs (`docs/PARTAGE.md`) : installations séparées, fiches vivantes, chiffrement de bout en bout par défaut.

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
