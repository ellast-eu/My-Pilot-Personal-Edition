#!/usr/bin/env bash
# Restauration de la base.
#   scripts/restore.sh replica [horodatage]   depuis la réplique distante Litestream (optionnellement à une date)
#   scripts/restore.sh snapshot FICHIER.db   depuis un instantané local (dossier snapshots du volume)
# La base actuelle est conservée à côté (pilot.db.avant-restauration-<date>).
set -euo pipefail
cd "$(dirname "$0")/.."
mode="${1:?Usage : scripts/restore.sh replica [AAAA-MM-JJTHH:MM:SSZ] | snapshot FICHIER.db}"
stamp=$(date +%Y%m%d-%H%M%S)
echo "Arrêt de l'application…"
docker compose stop app litestream 2>/dev/null || docker compose stop app
case "$mode" in
  replica)
    ts="${2:-}"
    docker compose --profile replication run --rm --entrypoint sh litestream -c "
      set -e
      litestream restore ${ts:+-timestamp $ts} -o /data/pilot.db.restaure /data/pilot.db
      [ -f /data/pilot.db ] && mv /data/pilot.db /data/pilot.db.avant-restauration-$stamp
      rm -f /data/pilot.db-wal /data/pilot.db-shm
      mv /data/pilot.db.restaure /data/pilot.db
      chown 1000:1000 /data/pilot.db"
    ;;
  snapshot)
    f="${2:?Nom du fichier instantané, ex. pilot-2026-10-08T12-00-00-000Z.db}"
    docker compose run --rm --no-deps --entrypoint sh app -c "
      set -e
      test -f /data/snapshots/$f
      [ -f /data/pilot.db ] && mv /data/pilot.db /data/pilot.db.avant-restauration-$stamp
      rm -f /data/pilot.db-wal /data/pilot.db-shm
      cp /data/snapshots/$f /data/pilot.db"
    ;;
  *) echo "Mode inconnu : $mode" >&2; exit 1 ;;
esac
echo "Redémarrage…"
docker compose up -d app
echo "Restauration terminée. L'ancienne base est gardée : pilot.db.avant-restauration-$stamp"
