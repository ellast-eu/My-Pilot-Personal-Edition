# Partage et travail à plusieurs — conception

Statut : **0.8.0 implémentée** (identités, espaces, invitations, chiffrement, synchro, sécurisation Caddy, partage d'idées, boîte « Reçues », notifications). Suite : 0.9 (activités).

## Décisions

| Question | Choix |
|---|---|
| Où vit l'autre personne | **Sa propre installation** : ses données privées restent chez elle. |
| Nature d'une idée partagée | **Fiche vivante** : une seule fiche, modifiable par tous les membres. |
| Chiffrement | **De bout en bout par défaut** : le serveur qui héberge un espace ne voit que des fiches chiffrées. |

## Vue d'ensemble

```
Installation de Stella                                  Installation de Paul
  appareils ──synchro privée──▶ serveur de Stella         serveur de Paul ◀──synchro privée── appareils
                                 │  (privé, en clair)       (privé, en clair)
                                 │
                                 └─ héberge l'espace « Nous » (chiffré)
  appareils ──synchro espace──▶      ▲
                                     └──────── synchro espace (jeton de membre) ──── appareils de Paul
```

- Un **espace** est hébergé par le serveur de la personne qui l'a créé.
- Chaque appareil membre se synchronise **directement** avec ce serveur, avec un jeton de membre limité à cet espace.
- Le privé ne change pas : chacun garde sa synchronisation vers son propre serveur, rien du privé ne transite vers l'autre.

## Identité

- Chaque **appareil** a son identité : paire X25519 générée localement avec `node:crypto` (aucune dépendance), jamais synchronisée. Nom affiché et couleur sont propres à la personne, saisis sur chaque appareil.
- Choix fait en 0.8.0-a : un membre = un appareil. Les autres appareils d'une même personne rejoignent l'espace avec une invitation « mon autre appareil » (rôle propriétaire). Ainsi aucune clé privée ne transite, même vers son propre serveur.
- L'authenticité de la remise de clé repose sur un Diffie-Hellman statique entre l'appareil qui invite et l'arrivant : pas besoin de signature séparée.
- **Empreinte** : 4 groupes de 4 caractères dérivés de la clé publique, que les deux personnes peuvent comparer (téléphone, de vive voix) pour s'assurer qu'aucun intermédiaire ne s'est glissé.

## Espaces

- Document `space:<uuid>` découpé en fiches comme `pilot` et `ideas`. Collections : `ideas`, `unified`, `projects` (Cristallisoir), puis `chantiers`, `notes`, `comments` (activités), et `members` (nom, couleur et clé publique de chaque membre, chiffrés).
- Fusion fiche par fiche, horodatage HLC et journal des conflits : inchangés.
- Rôles : **propriétaire** (invite, retire, supprime l'espace) et **membre** (lit, crée, modifie). Un rôle lecteur pourra venir plus tard.

### Chiffrement

- Clé d'espace AES-256-GCM, avec un numéro d'**époque** qui change à chaque retrait de membre.
- Chaque fiche part chiffrée : `{e: époque, iv, ct}`. Données associées authentifiées : `doc|coll|id|hlc`, si bien que le serveur hôte ne peut pas échanger une fiche contre une autre ni rejouer une ancienne version.
- Le chiffrement se fait **sur l'appareil**, au moment de la synchronisation avec l'hôte. La base locale de l'appareil garde du clair, ce qui laisse l'interface, la recherche et Claude fonctionner comme aujourd'hui.
- La clé d'espace est remise à chaque membre **enveloppée pour sa clé publique** (X25519 + HKDF + AES-GCM). Elle ne circule jamais en clair, pas même dans le lien d'invitation.
- Ce que l'hôte voit quand même :
  - identifiants des fiches et collections ;
  - nombre et taille des fiches ;
  - horodatages ;
  - quel membre envoie quoi.
  Il ne voit ni titres, ni textes, ni noms.

### Invitation (poignée de main)

1. Stella : « Inviter une personne ». L'application crée une invitation à usage unique (7 jours) et un lien `https://hôte/rejoindre/#v1.<espace>.<invitation>.<secret>.<empreinte de Stella>.<nom>`. Le lien ne contient aucune clé. Tout ce qui suit `#` n'est jamais envoyé à un serveur.
2. Paul colle le lien dans son application. Elle envoie à l'hôte l'invitation, sa clé publique et une **preuve** (HMAC du secret), et reçoit son **jeton de membre** personnel.
3. À sa prochaine synchronisation, l'application de Stella vérifie la preuve. Si l'hôte avait substitué une autre clé publique, la preuve ne correspond pas et la clé n'est pas remise. Sinon, elle enveloppe la clé d'espace pour Paul, et Paul reçoit le contenu.
4. Paul n'accepte qu'une clé enveloppée par l'appareil dont le lien donnait l'empreinte.
- Les empreintes de chacun restent affichées dans la liste des membres, pour une comparaison de vive voix si on le souhaite.

### Retrait d'un membre

- L'hôte révoque son jeton immédiatement (dès 0.8).
- Puis (0.10) l'application du propriétaire crée une **nouvelle époque**, re-chiffre les fiches et enveloppe la nouvelle clé pour les membres restants. La personne retirée garde ce qu'elle avait déjà reçu (impossible à empêcher), mais rien de nouveau.

## Côté serveur hôte

- Nouvelles tables :
  - `spaces(id, owner, created_at)` ;
  - `space_members(space, member, pubkey, role, token_hash, status, joined_at, revoked_at)` ;
  - `space_keys(space, epoch, member, wrapped)` ;
  - `invites(code_hash, space, expires_at, used_by)`.
- `/api/sync` accepte deux sortes de jetons :
  - le jeton privé actuel (`SYNC_TOKEN`), réservé aux appareils de la propriétaire du serveur ;
  - les **jetons de membre**, qui ne peuvent lire et écrire que les documents `space:<id>` de leurs espaces. Le serveur refuse toute autre fiche.
- Les fiches d'espace ne sont jamais renvoyées par la synchro privée vers un autre serveur. Le serveur ne peut pas les déchiffrer : il les stocke et les relaie.
- Exposition réseau : Paul doit joindre le serveur de Stella. Deux options :
  - Caddy en public (HTTPS) ;
  - Tailscale avec partage de la machine vers le compte de Paul (*node sharing*).

## Côté appareil

- `SyncEngine` gère plusieurs destinations : le serveur privé, plus un hôte par espace rejoint. L'état de synchro est déjà indexé par destination.
- Table locale `inbox(id, space, kind, rid, author, at, seen)`, alimentée à la réception de fiches venues d'un autre membre :
  - nouvelle idée ;
  - idée modifiée ;
  - regroupement ou cristallisation ;
  - plus tard : tâche attribuée, commentaire, échéance.

## Interface — Idées (étape 0.8)

- Fenêtre d'une idée → **« Partager… »** → choix de l'espace (ou « Nouvel espace avec… »). L'idée **déménage** dans l'espace (même contenu, nouvel identifiant) et porte le badge « partagée · Nous ».
- Une méta-idée partagée ne peut contenir que des idées du même espace. Y glisser une idée privée propose de la partager aussi.
- Bulles et tableau : filtre **Mes idées / Partagées / Tout**. Les idées partagées ont un contour distinct et la pastille de couleur de leur auteur.
- **« Retirer du partage »** recopie l'idée dans le privé de celle ou celui qui la retire et la supprime de l'espace pour tous, après confirmation.
- Notifications :
  - pastille avec compteur sur l'onglet Idées ;
  - boîte **« Reçues »** (« Paul a partagé une idée : … ») ;
  - notification du système dans l'application de bureau (API `Notification` du moteur, sans changement de sécurité) ;
  - réglage pour couper les notifications du système.
- Cristallisation par Claude : elle passe par l'abonnement de **celle ou celui qui clique**. Le contenu est alors envoyé à Claude, comme pour une idée privée : le chiffrement protège contre l'hôte, pas contre le service qu'on appelle soi-même.

## Activités partagées (étape 0.9)

- Une activité partagée, ses tâches et ses notes sont des fiches de l'espace. Les ajouts simultanés ne se gênent jamais : ce sont des fiches différentes.
- Champs ajoutés :
  - `auteur` et `modifiéPar` sur chaque fiche ;
  - `attribuéeÀ` sur les tâches ;
  - collection `comments` pour le fil de discussion.
- Vues Aujourd'hui / Prochain jour : filtre « mes tâches ». Notifications pour une tâche attribuée, un commentaire, une échéance proche.
- **Fusion champ par champ** sur l'appareil, qui déchiffre et garde la dernière version reçue comme base. Deux changements sur des champs différents de la même fiche sont tous les deux conservés. Le conflit, journalisé, ne reste que pour un même champ.
- « Partager une activité » emmène avec elle ses tâches et notes, avec une confirmation qui les liste.

## Limites assumées

- L'interface web du serveur n'affiche pas les espaces, puisqu'il ne peut pas les déchiffrer. Ils sont visibles dans l'application de bureau. Le serveur pourra devenir « membre » plus tard, si on le souhaite.
- Perte de toutes les identités de tous les membres : le contenu chiffré sur l'hôte devient illisible. Les copies locales et les instantanés de chaque appareil restent.
- Si l'hôte est hors ligne, les membres continuent à travailler hors ligne et se resynchronisent au retour.

## Découpage

1. **0.8.0-a** : identité, espaces, jetons de membre, invitation, chiffrement, synchro multi-destinations. Tests à 2 hôtes + 3 appareils.
2. **0.8.0** : partage d'idées dans le Cristallisoir, boîte « Reçues », notifications.
3. **0.9.0** : activités partagées, auteurs, attribution, commentaires.
4. **0.10.0** : fusion champ par champ, retrait de membre avec nouvelle époque, rôle lecteur.
