#!/usr/bin/env bash

# CashFlow — Automated Android APK Builder (CLI)
# Sets up portable JDK 17 & Android SDK in install/.tools and compiles CashFlow.apk

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
TOOLS_DIR="$INSTALL_DIR/.tools"
JDK_DIR="$TOOLS_DIR/jdk-17"
ANDROID_DIR="$TOOLS_DIR/android-sdk"
OUTPUT_APK="$INSTALL_DIR/CashFlow.apk"

echo -e "${CYAN}${BOLD}"
echo "============================================================"
echo "    CashFlow — Automated Android APK Builder                "
echo "============================================================"
echo -e "${NC}"

mkdir -p "$TOOLS_DIR"

# 1. Check or Download OpenJDK 17
if [ -x "$JDK_DIR/bin/javac" ]; then
    echo -e "${GREEN}✔ OpenJDK 17 found in: $JDK_DIR${NC}"
else
    echo -e "${BLUE}▶ Downloading portable OpenJDK 17 (Temurin)...${NC}"
    curl -L "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.11%2B9/OpenJDK17U-jdk_x64_linux_hotspot_17.0.11_9.tar.gz" -o "$TOOLS_DIR/jdk17.tar.gz"
    echo -e "${BLUE}▶ Extracting OpenJDK 17...${NC}"
    mkdir -p "$JDK_DIR"
    tar -xzf "$TOOLS_DIR/jdk17.tar.gz" -C "$JDK_DIR" --strip-components=1
    rm -f "$TOOLS_DIR/jdk17.tar.gz"
    echo -e "${GREEN}✔ OpenJDK 17 extracted successfully.${NC}"
fi

export JAVA_HOME="$JDK_DIR"
export PATH="$JAVA_HOME/bin:$PATH"

# 2. Check or Download Android Command-line Tools
if [ -x "$ANDROID_DIR/cmdline-tools/latest/bin/sdkmanager" ]; then
    echo -e "${GREEN}✔ Android cmdline-tools found in: $ANDROID_DIR${NC}"
else
    echo -e "${BLUE}▶ Downloading Android command-line tools...${NC}"
    curl -L "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" -o "$TOOLS_DIR/cmdline-tools.zip"
    echo -e "${BLUE}▶ Extracting Android command-line tools...${NC}"
    mkdir -p "$TOOLS_DIR/cmdline-tools-tmp"
    unzip -q -o "$TOOLS_DIR/cmdline-tools.zip" -d "$TOOLS_DIR/cmdline-tools-tmp"
    mkdir -p "$ANDROID_DIR/cmdline-tools/latest"
    cp -r "$TOOLS_DIR/cmdline-tools-tmp/cmdline-tools/"* "$ANDROID_DIR/cmdline-tools/latest/"
    rm -rf "$TOOLS_DIR/cmdline-tools-tmp" "$TOOLS_DIR/cmdline-tools.zip"
    echo -e "${GREEN}✔ Android cmdline-tools installed.${NC}"
fi

export ANDROID_HOME="$ANDROID_DIR"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

# 3. Accept Licenses & Install Android 35 SDK
echo -e "${BLUE}▶ Accepting Android SDK licenses...${NC}"
mkdir -p "$ANDROID_DIR/licenses"
# Accept standard Android SDK licenses directly
echo -e "24333f8a63b6825ea9c5514f83c2829b004d1fee\nd56f5187479451eabf01fb78af6dfcb131a6481e\n84831b9409646a918e30573bab4c9c91346d8abd" > "$ANDROID_DIR/licenses/android-sdk-license"
echo -e "89388a2a79496738166a086996333f00ec8076d5\n33b6a2b64920400829152f320ec44417f6500b9d" > "$ANDROID_DIR/licenses/android-sdk-preview-license"
yes | sdkmanager --licenses >/dev/null 2>&1 || true

if [ ! -d "$ANDROID_DIR/platforms/android-35" ]; then
    echo -e "${BLUE}▶ Installing Android Platform 35 & Build-Tools 35.0.0...${NC}"
    sdkmanager "platforms;android-35" "build-tools;35.0.0" "platform-tools"
    echo -e "${GREEN}✔ Android SDK components installed.${NC}"
fi

# 4. Generate persistent environment helper
ENV_FILE="$INSTALL_DIR/env.sh"
cat > "$ENV_FILE" << EOF
#!/usr/bin/env bash
export JAVA_HOME="$JDK_DIR"
export ANDROID_HOME="$ANDROID_DIR"
export PATH="\$JAVA_HOME/bin:\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$PATH"
EOF
chmod +x "$ENV_FILE"

# 5. Compile static export and sync
echo -e "\n${BLUE}▶ Synchronizing Next.js assets into Android project...${NC}"
cd "$ROOT_DIR/frontend"
NEXT_EXPORT=true npm run build
npx cap sync android

# 6. Assemble APK using Gradle
echo -e "\n${BLUE}▶ Compiling Android APK with Gradle (assembleDebug)...${NC}"
cd "$ROOT_DIR/frontend/android"
chmod +x gradlew
./gradlew assembleDebug

# 7. Locate output
APK_SOURCE="$ROOT_DIR/frontend/android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_SOURCE" ]; then
    cp "$APK_SOURCE" "$OUTPUT_APK"
    echo -e "\n${GREEN}${BOLD}============================================================${NC}"
    echo -e "${GREEN}${BOLD} 🎉 SUCCESS: Android APK Compiled Successfully!${NC}"
    echo -e "${CYAN} APK File   : ${BOLD}$OUTPUT_APK${NC}"
    echo -e "${CYAN} APK Size   : $(du -h "$OUTPUT_APK" | cut -f1)${NC}"
    echo -e "${GREEN}${BOLD}============================================================${NC}\n"
    echo -e "${YELLOW}${BOLD}Ready for installation on your Android phone:${NC}"
    echo -e " 1. ${BOLD}Via USB Cable (ADB):${NC}"
    echo -e "    ${CYAN}./install/install_to_phone.sh${NC}"
    echo -e " 2. ${BOLD}Direct File Transfer:${NC}"
    echo -e "    Send ${BOLD}install/CashFlow.apk${NC} to your phone via Google Drive, WhatsApp, Telegram, or USB file transfer and tap to install!\n"
else
    echo -e "${RED}✖ Build failed: APK output file not found at $APK_SOURCE${NC}"
    exit 1
fi

