#!/usr/bin/env bash

# CashFlow — 1-Click ADB Installer
# Installs the generated CashFlow.apk directly onto a USB-connected Android phone or emulator

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
APK_PATH="$INSTALL_DIR/CashFlow.apk"

# Check if adb is installed or in Android SDK
if ! command -v adb >/dev/null 2>&1; then
    if [ -n "$ANDROID_HOME" ] && [ -f "$ANDROID_HOME/platform-tools/adb" ]; then
        export PATH="$ANDROID_HOME/platform-tools:$PATH"
    elif [ -f "$HOME/Android/Sdk/platform-tools/adb" ]; then
        export PATH="$HOME/Android/Sdk/platform-tools:$PATH"
    else
        echo -e "${RED}[ERROR] 'adb' (Android Debug Bridge) is not installed or not in PATH.${NC}"
        echo -e "${YELLOW}Install it via:${NC} sudo apt install adb (or install Android Studio platform-tools)"
        exit 1
    fi
fi

# Check for APK existence
if [ ! -f "$APK_PATH" ]; then
    # Check if app-debug.apk exists in gradle output
    GRADLE_APK="$ROOT_DIR/frontend/android/app/build/outputs/apk/debug/app-debug.apk"
    if [ -f "$GRADLE_APK" ]; then
        cp "$GRADLE_APK" "$APK_PATH"
    else
        echo -e "${YELLOW}ℹ CashFlow.apk not found in install/ folder. Running make_android.sh first...${NC}\n"
        "$INSTALL_DIR/make_android.sh"
        if [ ! -f "$APK_PATH" ]; then
            echo -e "${RED}✖ Please build the APK first before running this installer.${NC}"
            exit 1
        fi
    fi
fi

echo -e "${CYAN}${BOLD}"
echo "============================================================"
echo "    CashFlow — Device Installer (ADB)                       "
echo "============================================================"
echo -e "${NC}"

echo -e "${BLUE}▶ Checking for connected Android devices...${NC}"
DEVICE_COUNT=$(adb devices | grep -v "List of devices" | grep -v "^$" | wc -l || true)

if [ "$DEVICE_COUNT" -eq 0 ]; then
    echo -e "${RED}✖ No Android devices or emulators detected via ADB.${NC}\n"
    echo -e "${YELLOW}${BOLD}Troubleshooting steps:${NC}"
    echo -e " 1. Enable ${BOLD}Developer Options${NC} on your phone:"
    echo -e "    Go to Settings > About Phone > Tap 'Build Number' 7 times."
    echo -e " 2. Enable ${BOLD}USB Debugging${NC}:"
    echo -e "    Go to Settings > Developer Options > Enable 'USB Debugging'."
    echo -e " 3. Plug your phone into your computer via USB."
    echo -e " 4. Look at your phone screen and tap ${BOLD}'Allow USB Debugging'${NC}."
    echo -e " 5. Run this script again: ${CYAN}./install/install_to_phone.sh${NC}\n"
    exit 1
fi

echo -e "${GREEN}✔ Device detected! Installing CashFlow.apk...${NC}"
adb install -r "$APK_PATH"

echo -e "${GREEN}✔ App successfully installed on device!${NC}"
echo -e "${BLUE}▶ Launching CashFlow on phone screen...${NC}"
adb shell monkey -p app.cashflow.incomeexpense 1 >/dev/null 2>&1 || true

echo -e "\n${GREEN}${BOLD}============================================================${NC}"
echo -e "${GREEN}${BOLD} 🎉 Done! CashFlow is now running on your phone!${NC}"
echo -e "${GREEN}${BOLD}============================================================${NC}\n"

