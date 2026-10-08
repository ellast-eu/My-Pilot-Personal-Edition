#!/usr/bin/env bash
# Publie une version : met à jour VERSION, date l'entrée « Non publié » du CHANGELOG, commit et tag.
# Usage : scripts/release.sh 0.2.0
set -euo pipefail
cd "$(dirname "$0")/.."
v="${1:?Usage : scripts/release.sh X.Y.Z}"
[[ "$v" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Version attendue au format X.Y.Z" >&2; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo "Des modifications ne sont pas commitées." >&2; exit 1; }
grep -q "^## \[Non publié\]" CHANGELOG.md || { echo "Aucune section « [Non publié] » dans CHANGELOG.md." >&2; exit 1; }
( cd server && npm test --silent )
echo "$v" > VERSION
sed -i "0,/\"version\": \"[^\"]*\"/s//\"version\": \"$v\"/" desktop/package.json
sed -i "s/^## \[Non publié\]/## [Non publié]\n\n## [$v] - $(date +%Y-%m-%d)/" CHANGELOG.md
git add VERSION CHANGELOG.md desktop/package.json
git commit -m "chore(release): v$v"
git tag -a "v$v" -m "My Pilot Personal Edition v$v"
scripts/package.sh
echo "Version v$v prête. Pousser avec : git push && git push --tags"
