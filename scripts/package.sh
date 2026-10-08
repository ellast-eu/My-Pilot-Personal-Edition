#!/usr/bin/env bash
# Archive du projet, avec son historique Git, dans un dossier qui porte la version :
#   dist/my-pilot-personal-edition-vX.Y.Z.zip  →  my-pilot-personal-edition-vX.Y.Z/
# Usage : scripts/package.sh   (version lue dans VERSION ; l'arbre de travail doit être propre)
set -euo pipefail
cd "$(dirname "$0")/.."
NOM=my-pilot-personal-edition
v=$(tr -d '[:space:]' < VERSION)
git diff --quiet && git diff --cached --quiet || { echo "Des modifications ne sont pas commitées." >&2; exit 1; }
dossier="$NOM-v$v"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git clone --quiet . "$tmp/$dossier"          # copie propre : ni données, ni .env, ni fichiers non suivis
git -C "$tmp/$dossier" remote remove origin
mkdir -p dist
out="$PWD/dist/$dossier"
rm -f "$out.zip" "$out.tar.gz"
if command -v zip >/dev/null; then
  ( cd "$tmp" && zip -qr "$out.zip" "$dossier" ); echo "dist/$dossier.zip"
else
  tar -C "$tmp" -czf "$out.tar.gz" "$dossier"; echo "dist/$dossier.tar.gz"
fi
