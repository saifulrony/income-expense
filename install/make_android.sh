#!/usr/bin/env bash

# CashFlow — Android APK Build Tool
# Generates a standalone, installable .apk package for your Android phone

set -eo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="$ROOT_DIR/install"
FRONTEND_DIR="$ROOT_DIR/frontend"
ANDROID_DIR="$FRONTEND_DIR/android"
OUTPUT_APK="$INSTALL_DIR/CashFlow.apk"

echo -e "${CYAN}${BOLD}"
echo "============================================================"
echo "    CashFlow — Android Build & Package Generator            "
echo "============================================================"
echo -e "${NC}"

# 1. Compile Next.js Static Web Bundle
echo -e "${BLUE}▶ 1/4 Compiling Next.js static production export...${NC}"
cd "$FRONTEND_DIR"
NEXT_EXPORT=true npm run build

# 2. Sync into Native Android Capacitor Project
echo -e "\n${BLUE}▶ 2/4 Synchronizing assets into Android Native container...${NC}"
npx cap sync android

# 3. Detect Java / Android SDK environment
echo -e "\n${BLUE}▶ 3/4 Verifying build toolchain (JDK & Android SDK)...${NC}"

# Check for common Android SDK locations if not in environment
if [ -z "$ANDROID_HOME" ]; then
    for SDK_CANDIDATE in "$HOME/Android/Sdk" "$HOME/android-sdk" "/opt/android-sdk" "/usr/lib/android-sdk"; do
        if [ -d "$SDK_CANDIDATE" ]; then
            export ANDROID_HOME="$SDK_CANDIDATE"
            export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
            break
        fi
    done
fi

HAS_JAVA=false
if command -v javac >/dev/null 2>&1 || [ -n "$JAVA_HOME" ]; then
    HAS_JAVA=true
fi

HAS_SDK=false
if [ -n "$ANDROID_HOME" ] && [ -d "$ANDROID_HOME" ]; then
    HAS_SDK=true
fi

# 4. Build APK via Gradle
echo -e "\n${BLUE}▶ 4/4 Compiling Android APK...${NC}"

if [ "$HAS_JAVA" = true ] && [ "$HAS_SDK" = true ]; then
    echo -e "${GREEN}✔ Toolchain found (Java + Android SDK). Building APK with Gradle...${NC}"
    cd "$ANDROID_DIR"
    chmod +x gradlew
    ./gradlew assembleDebug

    APK_SOURCE="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
    if [ -f "$APK_SOURCE" ]; then
        mkdir -p "$INSTALL_DIR"
        cp "$APK_SOURCE" "$OUTPUT_APK"
        
        echo -e "\n${GREEN}${BOLD}============================================================${NC}"
        echo -e "${GREEN}${BOLD} 🎉 SUCCESS: Android APK Generated Successfully!${NC}"
        echo -e "${CYAN} Output File : ${BOLD}$OUTPUT_APK${NC}"
        echo -e "${CYAN} File Size   : $(du -h "$OUTPUT_APK" | cut -f1)${NC}"
        echo -e "${GREEN}${BOLD}============================================================${NC}"
        echo -e "\n${YELLOW}${BOLD}How to install on your Android device:${NC}"
        echo -e " 1. ${BOLD}USB Cable (Instant):${NC} Plug in your phone with USB debugging enabled, then run:"
        echo -e "    ${CYAN}./install/install_to_phone.sh${NC}"
        echo -e " 2. ${BOLD}Direct Phone Transfer:${NC} Send ${BOLD}install/CashFlow.apk${NC} to your phone via:"
        echo -e "    • Google Drive / WhatsApp / Telegram / Email"
        echo -e "    • Then tap the file on your phone and select ${BOLD}Install${NC}!"
        exit 0
    else
        echo -e "${RED}✖ Gradle finished but APK was not found at expected location.${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}ℹ Java JDK 17 or Android SDK is not yet configured in this terminal shell.${NC}"
    echo -e "${GREEN}✔ All web assets are 100% compiled & synchronized in:${NC} ${BOLD}frontend/android${NC}\n"
    
    echo -e "${CYAN}${BOLD}You have TWO easy ways to get your installable .apk:${NC}\n"
    
    echo -e "${BOLD}Option A: Android Studio (Recommended & Easiest):${NC}"
    echo -e "  1. Run: ${BOLD}npx cap open android${NC} (from frontend/ folder) or open ${BOLD}frontend/android${NC} in Android Studio"
    echo -e "  2. In the top menu, click: ${BOLD}Build > Build Bundle(s) / APK(s) > Build APK(s)${NC}"
    echo -e "  3. When finished, a notification popup will say 'APK(s) generated successfully' — click ${BOLD}locate${NC} to grab your APK!\n"
    
    echo -e "${BOLD}Option B: Install JDK 17 & Android SDK for automated terminal builds:${NC}"
    echo -e "  Run the automated environment setup script:"
    echo -e "  ${CYAN}./install/setup_environment.sh${NC}\n"
fi

