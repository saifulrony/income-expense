#!/usr/bin/env bash

# CashFlow — Android APK Build Script

set -eo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
ANDROID_DIR="$FRONTEND_DIR/android"

echo -e "${CYAN}${BOLD}"
echo "============================================================"
echo "    CashFlow — Android Native Build & Sync Tool             "
echo "============================================================"
echo -e "${NC}"

# 1. Next.js Static Export Build
echo -e "${BLUE}▶ 1/3 Compiling Next.js static production export...${NC}"
cd "$FRONTEND_DIR"
NEXT_EXPORT=true npm run build

# 2. Capacitor Android Sync
echo -e "${BLUE}▶ 2/3 Syncing web bundle into native Android Studio project...${NC}"
npx cap sync android

# 3. Check for JDK / Gradle compiler
echo -e "${BLUE}▶ 3/3 Checking Android build environment...${NC}"
if command -v javac >/dev/null 2>&1 || [ -n "$JAVA_HOME" ]; then
    echo -e "${GREEN}✔ JDK detected. Building Android APK via Gradle...${NC}"
    cd "$ANDROID_DIR"
    chmod +x gradlew
    ./gradlew assembleDebug

    APK_SOURCE="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
    if [ -f "$APK_SOURCE" ]; then
        cp "$APK_SOURCE" "$ROOT_DIR/CashFlow-debug.apk"
        echo -e "\n${GREEN}${BOLD}============================================================${NC}"
        echo -e "${GREEN}${BOLD} ✔ SUCCESS: Installable Android APK generated!${NC}"
        echo -e "${CYAN} File location: ${BOLD}$ROOT_DIR/CashFlow-debug.apk${NC}"
        echo -e "${YELLOW} Transfer this .apk to your phone to install directly.${NC}"
        echo -e "${GREEN}${BOLD}============================================================${NC}\n"
        exit 0
    fi
else
    echo -e "${YELLOW}ℹ JDK/Android SDK not found in current shell environment.${NC}"
    echo -e "${GREEN}✔ Android assets are 100% prepared & synchronized in: frontend/android${NC}"
    echo -e "${CYAN}To generate your APK via Android Studio:${NC}"
    echo -e "  1. Run: ${BOLD}make open-android${NC} (or open 'frontend/android' in Android Studio)"
    echo -e "  2. Go to: ${BOLD}Build > Build Bundle(s) / APK(s) > Build APK(s)${NC}"
    echo -e "  3. Click 'locate' when finished to grab your APK!\n"
fi

