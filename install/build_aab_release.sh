#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
ANDROID_DIR="$FRONTEND_DIR/android"
KEYSTORE_FILE="$ANDROID_DIR/cashflow-release-key.jks"
KEYSTORE_PROPS="$ANDROID_DIR/keystore.properties"

echo "============================================================"
echo "  CashFlow — Google Play Store Signed Release (.AAB) Builder"
echo "============================================================"

# 1. Load local Android/Java toolchain if installed via install/setup_environment.sh
if [ -f "$ROOT_DIR/install/env.sh" ]; then
  # shellcheck disable=SC1091
  source "$ROOT_DIR/install/env.sh"
fi

if ! command -v keytool >/dev/null 2>&1 || ! command -v java >/dev/null 2>&1; then
  echo "JDK / Android SDK not detected yet. Running install/setup_environment.sh first..."
  bash "$ROOT_DIR/install/setup_environment.sh"
  # shellcheck disable=SC1091
  source "$ROOT_DIR/install/env.sh"
fi

# 2. Generate Release Keystore once if not already present
if [ ! -f "$KEYSTORE_FILE" ]; then
  echo ""
  echo "No release keystore found. Creating a new 2048-bit RSA upload key..."
  read -r -s -p "Enter a strong password for your Play Store keystore: " KS_PASS
  echo ""
  if [ -z "$KS_PASS" ] || [ "${#KS_PASS}" -lt 6 ]; then
    echo "Error: Keystore password must be at least 6 characters."
    exit 1
  fi

  keytool -genkey -v \
    -keystore "$KEYSTORE_FILE" \
    -alias cashflow \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -dname "CN=CashFlow, OU=Mobile, O=CashFlow, L=Dhaka, S=Dhaka, C=BD"

  cat > "$KEYSTORE_PROPS" <<EOF
storeFile=../cashflow-release-key.jks
storePassword=$KS_PASS
keyAlias=cashflow
keyPassword=$KS_PASS
EOF
  chmod 600 "$KEYSTORE_FILE" "$KEYSTORE_PROPS"
  echo "✓ Keystore created at: $KEYSTORE_FILE"
  echo "  IMPORTANT: Back up cashflow-release-key.jks & its password safely!"
fi

# 3. Export Next.js static bundle and sync into Capacitor Android
echo ""
echo "[1/3] Building Next.js production export..."
cd "$FRONTEND_DIR"
NEXT_EXPORT=true npm run build

echo "[2/3] Syncing assets & icons into Capacitor Android..."
npx cap sync android

# 4. Build Signed Release Android App Bundle (.aab)
echo "[3/3] Compiling signed Play Store bundle (bundleRelease)..."
cd "$ANDROID_DIR"
./gradlew bundleRelease

AAB_OUT="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"
if [ -f "$AAB_OUT" ]; then
  echo ""
  echo "============================================================"
  echo "  SUCCESS! Signed Play Store Bundle Ready:"
  echo "  $AAB_OUT"
  echo "============================================================"
else
  echo "Error: Expected bundle not found at $AAB_OUT"
  exit 1
fi
