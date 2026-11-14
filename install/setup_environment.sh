#!/usr/bin/env bash

# CashFlow — Android CLI Environment Setup Tool
# Sets up OpenJDK 17 and Android Command-line Tools for terminal-based APK compilation

set -eo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_DIR="$ROOT_DIR/install/.tools"

echo -e "${CYAN}${BOLD}"
echo "============================================================"
echo "    CashFlow — Android Build Toolchain Setup                "
echo "============================================================"
echo -e "${NC}"

echo -e "${BLUE}This tool configures JDK 17 and Android SDK for compiling CashFlow.apk.${NC}\n"

# Check if system has apt and sudo
if command -v apt-get >/dev/null 2>&1; then
    echo -e "${YELLOW}Quick System Package Install (Requires sudo):${NC}"
    echo -e "You can install JDK and Android platform-tools via:"
    echo -e "  ${BOLD}sudo apt update && sudo apt install -y openjdk-17-jdk adb${NC}\n"
fi

# Option for Portable Rootless JDK Installation
read -p "Would you like to download a portable rootless OpenJDK 17 now? [y/N]: " -n 1 -r || true
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    mkdir -p "$TOOLS_DIR"
    JDK_DIR="$TOOLS_DIR/jdk-17"
    if [ -d "$JDK_DIR" ]; then
        echo -e "${GREEN}✔ Portable JDK 17 already exists in $JDK_DIR${NC}"
    else
        echo -e "${BLUE}▶ Downloading portable OpenJDK 17 from Eclipse Temurin (Adoptium)...${NC}"
        TAR_URL="https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.21%2B9/OpenJDK17U-jdk_x64_linux_hotspot_17.0.21_9.tar.gz"
        curl -L "$TAR_URL" -o "$TOOLS_DIR/jdk17.tar.gz"
        
        echo -e "${BLUE}▶ Extracting OpenJDK 17...${NC}"
        mkdir -p "$JDK_DIR"
        tar -xzf "$TOOLS_DIR/jdk17.tar.gz" -C "$JDK_DIR" --strip-components=1
        rm -f "$TOOLS_DIR/jdk17.tar.gz"
        echo -e "${GREEN}✔ Portable OpenJDK 17 installed to: $JDK_DIR${NC}"
    fi

    # Create environment loader
    ENV_FILE="$ROOT_DIR/install/env.sh"
    cat > "$ENV_FILE" << EOF
#!/usr/bin/env bash
export JAVA_HOME="$JDK_DIR"
export PATH="\$JAVA_HOME/bin:\$PATH"
if [ -d "\$HOME/Android/Sdk" ]; then
    export ANDROID_HOME="\$HOME/Android/Sdk"
    export PATH="\$ANDROID_HOME/platform-tools:\$ANDROID_HOME/cmdline-tools/latest/bin:\$PATH"
fi
EOF
    chmod +x "$ENV_FILE"
    echo -e "\n${GREEN}${BOLD}✔ Setup complete!${NC}"
    echo -e "To activate this environment and build your APK, run:"
    echo -e "  ${CYAN}source install/env.sh && ./install/make_android.sh${NC}\n"
else
    echo -e "\n${YELLOW}Setup aborted. Alternatively, you can use Android Studio to build the APK with 1 click:${NC}"
    echo -e "  ${BOLD}cd frontend && npx cap open android${NC}"
    echo -e "  Then click: Build > Build Bundle(s) / APK(s) > Build APK(s)\n"
fi
