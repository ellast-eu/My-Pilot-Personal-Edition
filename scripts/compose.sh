#!/bin/sh
# Lance « compose » avec le moteur de conteneurs présent sur la machine : Docker ou Podman.
#   scripts/compose.sh up -d --build
# Ordre de recherche : $COMPOSE (imposé, ex. COMPOSE="podman-compose"), podman compose, podman-compose, docker compose.
# Podman passe avant Docker : sur une machine qui a les deux, c'est le choix explicite le plus probable.
set -eu
case "$0" in */*) cd "${0%/*}/.." ;; esac      # racine du dépôt, sans dépendre de dirname

if [ -n "${COMPOSE:-}" ]; then
  # shellcheck disable=SC2086  # COMPOSE peut contenir deux mots (« podman compose »)
  exec $COMPOSE "$@"
fi
if command -v podman >/dev/null 2>&1 && podman compose version >/dev/null 2>&1; then
  exec podman compose "$@"
fi
if command -v podman-compose >/dev/null 2>&1; then
  exec podman-compose "$@"
fi
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  exec docker compose "$@"
fi
echo "Aucun outil compose trouvé : installez podman-compose (ou docker compose), ou indiquez-le dans COMPOSE." >&2
exit 127
