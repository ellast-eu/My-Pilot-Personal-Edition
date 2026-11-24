#!/usr/bin/env bash
# Construit l'APK Android de My Pilot Personal Edition, sans Android Studio ni Gradle :
# uniquement les outils Android empaquetés par Debian / Ubuntu.
#
#   sudo apt install aapt apksigner zipalign android-sdk-platform-23 dalvik-exchange openjdk-17-jdk-headless
#   ANDROID_KEYSTORE=~/cles/mypilot.p12 ANDROID_KEYSTORE_PASS=… android/build.sh
#
# Produit dist/my-pilot-personal-edition-v<VERSION>.apk (versionName = VERSION du dépôt).
# La clé de signature reste HORS du dépôt : une mise à jour de l'application doit être signée
# avec la même clé, sinon Android refuse de l'installer par-dessus.
# Créer la clé une fois :
#   keytool -genkeypair -keystore ~/cles/mypilot.p12 -storetype PKCS12 -alias mypilot \
#           -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=My Pilot Personal Edition"
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/.." && pwd)"
VERSION="$(tr -d '[:space:]' < "$RACINE/VERSION")"
JAR="${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}"
DX="$(command -v dalvik-exchange || command -v dx)"
MIN_SDK=23        # Android 6
CIBLE_SDK=34      # Android 14 : Android 15+ refuse d'installer une application qui vise moins de 24
: "${ANDROID_KEYSTORE:?Indiquez la clé de signature : ANDROID_KEYSTORE=chemin/vers/cle.p12}"
: "${ANDROID_KEYSTORE_PASS:?Indiquez son mot de passe : ANDROID_KEYSTORE_PASS=…}"
ALIAS="${ANDROID_KEY_ALIAS:-mypilot}"

# versionCode : 0.20.0 → 2000, 1.2.3 → 10203 (toujours croissant d'une version à l'autre)
IFS=. read -r MA MI PA <<<"${VERSION%%-*}"
CODE=$(( MA * 10000 + MI * 100 + ${PA:-0} ))

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
mkdir -p "$T/gen" "$T/obj" "$RACINE/dist"

echo "1/5 ressources"
aapt package -f -m -J "$T/gen" -M "$ICI/AndroidManifest.xml" -S "$ICI/res" -I "$JAR" \
  --min-sdk-version "$MIN_SDK" --target-sdk-version "$CIBLE_SDK" \
  --version-code "$CODE" --version-name "$VERSION"

echo "2/5 compilation Java"
javac -nowarn -Xlint:-options --release 8 -encoding UTF-8 -cp "$JAR" -d "$T/obj" \
  $(find "$ICI/src" "$T/gen" -name '*.java')

echo "3/5 bytecode Dalvik"
"$DX" --dex --min-sdk-version="$MIN_SDK" --output="$T/classes.dex" "$T/obj"

echo "4/5 paquet"
aapt package -f -M "$ICI/AndroidManifest.xml" -S "$ICI/res" -I "$JAR" -F "$T/brut.apk" \
  --min-sdk-version "$MIN_SDK" --target-sdk-version "$CIBLE_SDK" \
  --version-code "$CODE" --version-name "$VERSION"
(cd "$T" && aapt add brut.apk classes.dex >/dev/null)
zipalign -f -p 4 "$T/brut.apk" "$T/aligne.apk"

echo "5/5 signature"
SORTIE="$RACINE/dist/my-pilot-personal-edition-v$VERSION.apk"
apksigner sign --ks "$ANDROID_KEYSTORE" --ks-key-alias "$ALIAS" \
  --ks-pass env:ANDROID_KEYSTORE_PASS --key-pass env:ANDROID_KEYSTORE_PASS --out "$SORTIE" "$T/aligne.apk"
apksigner verify "$SORTIE"
echo "APK : $SORTIE (version $VERSION, code $CODE)"
