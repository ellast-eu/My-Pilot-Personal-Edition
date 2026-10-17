#!/usr/bin/env bash
# Crée sur GitHub les releases qui manquent, une par version du CHANGELOG.
# Le commit d'une version est « chore(release): vX » (v0.1.0 : commit fixé).
# Chaque release reçoit l'archive du code de cette version.
# Usage : scripts/releases-github.sh [--essai]   (--essai : affiche sans rien créer)
# Lancé par .github/workflows/releases.yml ; demande gh et GH_TOKEN.
set -euo pipefail
cd "$(dirname "$0")/.."
essai=${1:-}

commit_de() {
  case $1 in
    0.1.0) git rev-parse 2814c1f ;;   # première version, sans commit « chore(release) »
    *) git log --format=%H --grep="^chore(release): v$1\$" | head -n1 ;;
  esac
}

notes_de() {  # section du CHANGELOG pour la version $1
  awk -v v="$1" '
    $0 ~ "^## \\[" { dedans = (index($0, "## [" v "]") == 1); next }
    dedans { print }' CHANGELOG.md | sed -e '/./,$!d'
}

existantes=""
[ "$essai" = "--essai" ] || existantes=$(gh release list --limit 200 --json tagName --jq '.[].tagName')

# ordre croissant : la plus récente version stable devient « Latest »
grep -oE '^## \[[0-9][^]]*\]' CHANGELOG.md | sed -E 's/^## \[(.*)\]$/\1/' | sort -V | while read -r v; do
  tag="v$v"
  if grep -qx "$tag" <<<"$existantes"; then continue; fi
  c=$(commit_de "$v")
  [ -n "$c" ] || { echo "::warning::$tag : commit introuvable"; continue; }
  options=(--title "$tag" --target "$c" --notes-file -)
  case $v in *-*) options+=(--prerelease) ;; esac
  if [ "$essai" = "--essai" ]; then
    echo "$tag -> ${c:0:7} $(notes_de "$v" | head -n1)"
    continue
  fi
  archive="my-pilot-personal-edition-$tag"
  git archive --format=zip --prefix="$archive/" -o "$archive.zip" "$c"
  notes_de "$v" | gh release create "$tag" "$archive.zip" "${options[@]}"
  rm -f "$archive.zip"
  echo "$tag créée"
done
