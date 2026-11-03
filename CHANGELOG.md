# Journal des modifications

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versionnage : [SemVer](https://semver.org/lang/fr/).

## [Non publié]

## [0.19.0] - 2026-11-03

### Modifications
- **Base My Pilot Pro 3.38.0** (au lieu de 3.33.0). Ce que la pro apporte : **suivi de projet** (désactivé par défaut ; onglet **Projets**, jalons choisis parmi les événements et les tâches, avancement calculé, échéance qui ne se reporte pas sans motif, bloc « Projets à surveiller » sur l'écran du jour), événements datés sur les activités avec leurs **types d'événement**, réglage du format des dates, boutons d'ajout dans l'en-tête de chaque section de la fiche.
  - `scripts/build_pilot.py` : 45 patchs, appliqués l'un après l'autre sans échec ni doublon. L'ancre des listes est accrochée par la **fin** du tableau (la 3.35 a ajouté une entrée en tête) et limitée à une suite de paires `["clé","libellé"]`, pour qu'aucun autre code ne puisse être englobé.
  - Listes modifiables : **Types d'événement** ajoutés.
  - Aide : rubrique **Projets** (F1 depuis l'onglet).
- L'onglet **Données s'appelle Options**, comme dans la pro depuis sa 3.36 : l'aide, les messages de l'application et du serveur, le README et la documentation suivent.

## [0.18.0] - 2026-10-30

### Modifications
- **Base My Pilot Pro 3.33.0** (au lieu de 3.21.0). Ce que la pro apporte : onglet **Calendrier** (mois entier, activités et échéances, journée ouverte au clic), bouton **Accompagnement** dans l'en-tête, bouton **Reporter** sur les tâches, modules de pause dans une fenêtre, rapport sur quatre pages avec « Charge à venir », bloc « Passées sans trace ».
  - `scripts/build_pilot.py` : 45 patchs, appliqués l'un après l'autre sans échec ni doublon ; nouveau patch du nom par défaut (« My Pilot Personal Edition » dans l'en-tête, l'onglet du navigateur, À propos et le rapport, au lieu de « My Pilot Professional Edition »).
  - Aide : rubrique **Calendrier** (F1 depuis l'onglet).
- En-tête : la ligne d'état passe sur une deuxième ligne fixe dès que l'en-tête ne tient plus sur une ligne (sous 1500 px, avec les cinq boutons de la pro), au lieu de flotter à droite sous la date.
- Journal des versions de la perso (fenêtre À propos) complété de la 0.15.0 à la 0.18.0.

### Corrections
- Onglet Données : un chemin long (dossier des instantanés…) ne fait plus déborder la page sur un écran étroit.

## [0.17.1] - 2026-10-28

### Ajouts
- **Podman** : `scripts/compose.sh` utilise le moteur présent (`podman compose`, `podman-compose` ou `docker compose`, ou celui imposé par `COMPOSE`). Le service systemd s'appuie dessus et peut s'installer comme **service utilisateur** (Podman « rootless », avec `loginctl enable-linger`) ou comme service système.

### Modifications
- Service systemd : `systemctl reload` **reconstruit l'image** depuis le dépôt avant de remplacer le conteneur ; après un `git pull`, c'est bien la nouvelle version qui tourne. Le démarrage au boot garde l'image existante.

## [0.17.0] - 2026-10-28

### Ajouts
- **Démarrage automatique par systemd** (`deploy/systemd`) : une unité pour la pile Docker Compose (profils choisis par `COMPOSE_PROFILES` dans `.env`), une unité durcie pour lancer le serveur directement avec Node.js (utilisateur dédié, système en lecture seule sauf les données), avec son fichier de configuration d'exemple.

### Modifications
- Serveur exposé sans mot de passe : arrêt avec le code 78 (erreur de configuration) au lieu de 1, pour que systemd ne le relance pas en boucle.

## [0.16.1] - 2026-10-26

### Corrections
- **Synchronisation refusée (401) quand l'adresse du serveur finit par `/pilot`** (adresse copiée depuis le navigateur) : l'appel partait vers `…/pilot/api/sync`, une page de l'interface web. L'adresse est maintenant ramenée à la racine du serveur, y compris celle déjà enregistrée ; le message d'erreur l'explique si une autre adresse mène encore à l'interface web.

## [0.16.0] - 2026-10-26

### Ajouts
- **Page de connexion** pour l'interface web du serveur (`/connexion/`), à la place de la fenêtre d'identification « Basic » du navigateur, que certains navigateurs d'entreprise (Edge géré par stratégie) n'affichent jamais. Session de 30 jours par cookie signé (`HttpOnly`, `SameSite=Strict`, `Secure` derrière Caddy en HTTPS), close partout quand le mot de passe change. Bouton **Se déconnecter** dans Données → Réglages du serveur. Session expirée : retour automatique à la page de connexion, puis à la page en cours.
- Requêtes de modification venues d'un autre site refusées (contrôle de l'origine).

### Corrections
- **Synchronisation refusée sans explication** : l'application affichait seulement « Jeton refusé ». Elle donne maintenant le motif exact : serveur sans jeton de synchronisation (il retombait alors sur le mot de passe, que l'application n'envoie pas), jeton différent, authentification « Basic » imposée par un proxy devant l'application, page web (portail de connexion) au lieu de l'API, adresse sans API, essais trop nombreux.

## [0.15.0] - 2026-10-26

### Modifications
- **Base My Pilot Pro 3.21.0** (au lieu de PST·PILOT 3.13.1). Ce que la pro apporte : fiches Compte rendu, permanence détaillée, champ Affaire, fenêtre **À propos**, modèle de catégories générique ; le bouton Enregistrer redevient visible (contour discret quand tout est enregistré).
  - `scripts/build_pilot.py` : 44 patchs, appliqués l'un après l'autre sans échec ni doublon. Les patchs devenus inutiles sont retirés ; la pro a désormais son propre bouton Aide et son propre onglet Idées, qui affiche toujours le Cristallisoir dans la perso.
  - Fenêtre **À propos** propre à la perso : présentation, fonctionnement (serveur personnel, synchronisation, hors ligne possible), version de la pro dont elle dérive.
  - **Deux journaux séparés** dans À propos : celui de la perso (`web/pilot/versions.js`, chargé avant le script principal) et celui de My Pilot Pro. Le journal n'est plus dans l'onglet Données.
  - Diagnostic : « Base My Pilot Pro v3.21.0 ».

### Ajouts
- **Releases GitHub** : le workflow `.github/workflows/releases.yml` crée sur GitHub une release par version du CHANGELOG, avec ses notes et l'archive du code. Il se lance à chaque publication sur `main` (après `scripts/release.sh`) ou à la main depuis l'onglet Actions. Les versions déjà publiées sont rattrapées au premier passage.

## [0.14.1] - 2026-10-10

### Corrections
- **En-tête sur fenêtre étroite ou en portrait** : la ligne d'état (Enregistré, Pause dans…, Aide, Pause) ne flotte plus à droite sous la date.
  - En dessous de 1180 px de large, elle occupe une deuxième ligne fixe, alignée à gauche, avec les boutons à droite.
  - Les textes qui changent (« Enregistrement… », « Enregistré à… », compte à rebours) ont une largeur réservée : plus rien ne bouge quand ils changent.
  - En dessous de 640 px, l'en-tête devient compact : titre plus petit, numéro de version masqué, date sur sa propre ligne.

## [0.14.0] - 2026-10-10

### Ajouts
- **Aide intégrée** : bouton **Aide** dans l'en-tête, touche **F1** (y compris depuis l'onglet Idées) ou menu Aide → « Guide d'utilisation » de l'application de bureau.
  - 14 rubriques : prise en main, Aujourd'hui et Prochain jour, Activités, Journal, Contacts, Idées, Veilles, Partage à plusieurs, Données et synchronisation, Paramètres, Claude, Pauses, raccourcis clavier, questions fréquentes.
  - F1 ouvre directement la rubrique de l'onglet affiché.
  - Recherche dans toute l'aide, avec surlignage. Navigation rubrique par rubrique.
  - L'aide s'affiche au-dessus d'une fenêtre déjà ouverte, sans la fermer.
  - Liens « Aide » dans l'onglet Veilles et le bloc Partage.
- **Bienvenue** au premier lancement : présentation en quelques lignes et accès à la visite. Elle n'apparaît qu'une fois, pour tous vos appareils.

## [0.13.0] - 2026-10-10

### Ajouts
- **Veilles : sources spécialisées**, au choix pour chaque source d'une veille :
  - **Failles exploitées (CISA KEV)** : ajouts récents au catalogue des failles activement exploitées, avec l'action demandée, l'échéance et l'usage par des rançongiciels ;
  - **CVE récentes (NVD)** : CVE publiées ces N derniers jours, avec leur score CVSS ;
  - **Offres France Travail** (API Offres d'emploi v2) : une recherche par mot-clé, par département, sur les N derniers jours. Il faut les identifiants gratuits de francetravail.io, à saisir dans Données → Réglages (ou `FRANCETRAVAIL_CLIENT_ID` / `FRANCETRAVAIL_CLIENT_SECRET` dans le `.env`).
- **Filtres** : score CVSS minimum, et contrats gardés pour les offres (ex. « professionnalisation, CDI »).
- **Questions de révision** : une fois par semaine, quelques questions et leurs réponses, tirées de ce que la veille a trouvé ces 7 derniers jours. Elles s'affichent dans une fiche à déplier.
- **Nouveaux modèles** :
  - **Offres d'emploi** : vos mots-clés (admin sys, MCO, purple team, red team, pentest, audit, OSINT), contrat de professionnalisation ou CDI, département 69, note de pertinence par Claude selon votre profil ;
  - **Failles exploitées** ;
  - **CVE critiques** (CVSS 9 ou plus).
- **Point CVE** inclut désormais les failles exploitées (CISA).
- **Vérifier** fonctionne pour tous les types de source.

### Corrections
- Un délai de Claude Code non relâché pouvait retarder la fin du processus (et des tests) de 30 s.

## [0.12.0] - 2026-10-10

### Ajouts
- **Veilles : opérations par Claude**, à cocher dans la fenêtre d'une veille :
  - **noter la pertinence** de 0 à 5 selon un critère que vous écrivez, avec un seuil sous lequel l'élément est écarté ; les éléments sont triés par note ;
  - **résumer** chaque élément en 2 phrases ;
  - **proposer** « à creuser » ou « à faire », avec la raison ; le bouton correspondant est mis en avant, et rien n'est créé sans votre clic ;
  - **synthèse de la fiche** : 5 faits marquants au plus, et « ce que ça change pour moi ».
- **Réglages par veille** :
  - consigne (angle, ton) ;
  - modèle : Haiku par défaut, Sonnet ou Opus ;
  - plafond d'appels à Claude par jour, 6 par défaut.
- **Coût** : une seule demande à Claude par exécution, jusqu'à 40 éléments.
- **Essai** : « Tester » peut inclure Claude, sur 10 éléments au plus, sans compter dans le plafond.
- **État de Claude Code** affiché dans la fenêtre quand la veille est exécutée par l'instance courante.
- **Sans Claude** : si Claude Code n'est pas disponible sur l'exécutant, ou que le plafond est atteint, la fiche est produite sans ces opérations, avec l'explication.
- **Sécurité** : les articles sont transmis à Claude comme des données balisées, avec l'interdiction d'obéir à leur contenu. Chaque réponse est contrôlée champ par champ : note bornée, actions limitées à une liste, textes tronqués.

## [0.11.0] - 2026-10-10

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
