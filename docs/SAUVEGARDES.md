# Sauvegardes et synchronisation distante

Les données vivent dans `/data/pilot.db` (volume Docker `pilot-data`), une base SQLite en mode WAL.

## 1. Historique des versions (dans la base)

Chaque document (pilotage, idées) garde ses versions successives : au plus une toutes les 5 minutes pendant la saisie (`REVISION_INTERVAL`), plus une à chaque enregistrement manuel, dans la limite de `KEEP_REVISIONS` (300 par défaut).

Onglet **Données → Historique des versions** : restaurer une version en crée une nouvelle, l'état courant est d'abord figé. Rien n'est effacé.

Cet historique protège des erreurs de saisie, pas d'une panne du serveur : il est dans la même base.

## 2. Instantanés (dans le volume)

Une copie complète et cohérente de la base (`VACUUM INTO`) est faite toutes les `SNAPSHOT_HOURS` heures dans `/data/snapshots`, en gardant les `KEEP_SNAPSHOTS` plus récentes. Bouton « Instantané de la base » dans l'onglet Données pour en faire une à la demande, par exemple avant un import.

Lister : `docker compose exec app ls -l /data/snapshots`
Restaurer : `scripts/restore.sh snapshot pilot-2026-10-08T12-00-00-000Z.db`

## 3. Réplication distante continue (Litestream)

[Litestream](https://litestream.io) suit le journal WAL et envoie chaque modification vers le serveur distant en quelques secondes. Il permet de revenir à n'importe quel instant de la période de rétention (30 jours dans les modèles fournis).

### Vers un stockage S3 compatible

Backblaze B2, Scaleway, OVH, Wasabi, AWS ou un MinIO à vous.

```sh
cp deploy/litestream.s3.yml deploy/litestream.yml
# .env : LITESTREAM_BUCKET, LITESTREAM_ENDPOINT, LITESTREAM_REGION, clés d'accès
docker compose --profile replication up -d
docker compose logs -f litestream     # vérifier les premiers envois
```

### Vers votre propre serveur en SFTP

```sh
cp deploy/litestream.sftp.yml deploy/litestream.yml
ssh-keygen -t ed25519 -N "" -f deploy/keys/id_ed25519      # clé dédiée à la sauvegarde
# ajouter deploy/keys/id_ed25519.pub dans ~/.ssh/authorized_keys du compte de sauvegarde
ssh-keyscan -t ed25519 mon-serveur                           # → SFTP_HOST_KEY dans .env
# .env : SFTP_HOST, SFTP_USER, SFTP_PATH, SFTP_HOST_KEY
docker compose --profile replication up -d
```

Renseigner `SFTP_HOST_KEY` : sans elle, Litestream ne vérifie pas l'identité du serveur distant.

Litestream 0.5 n'accepte qu'une destination par base. Pour deux destinations, lancer un second service Litestream avec une autre configuration, ou s'appuyer sur la réplication du fournisseur.

### Restaurer depuis la réplique

```sh
scripts/restore.sh replica                          # dernier état connu
scripts/restore.sh replica 2026-10-08T09:30:00Z     # état à cet instant
```

L'application est arrêtée pendant l'opération ; l'ancienne base est gardée à côté sous le nom `pilot.db.avant-restauration-<date>`.

## Tester la restauration

Une sauvegarde jamais restaurée n'est pas une sauvegarde. Une fois par trimestre :

```sh
docker compose --profile replication run --rm litestream restore -o /tmp/essai.db /data/pilot.db \
  && echo "Restauration possible"
```
