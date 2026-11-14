#!/usr/bin/env bash

# CashFlow — Full Project Development Runner
# Starts both the Go Backend API and Next.js Frontend concurrently

set -eo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color
BOLD='\033[1m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo -e "${CYAN}${BOLD}"
echo "============================================================"
echo "    CashFlow — Income & Expense Mobile App Dev Server       "
echo "============================================================"
echo -e "${NC}"

# Check prerequisites
command -v go >/dev/null 2>&1 || { echo -e "${RED}[ERROR] Go is not installed or not in PATH.${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}[ERROR] npm is not installed or not in PATH.${NC}"; exit 1; }

# PIDs tracking for cleanup
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    echo -e "\n${YELLOW}Shutting down CashFlow services...${NC}"
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo -e "${YELLOW}Stopping Go Backend (PID: $BACKEND_PID)...${NC}"
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo -e "${YELLOW}Stopping Next.js Frontend (PID: $FRONTEND_PID)...${NC}"
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    echo -e "${GREEN}All services stopped cleanly. Goodbye!${NC}"
    exit 0
}

# Trap termination signals
trap cleanup SIGINT SIGTERM EXIT

# Free ports 18080 and 18000 if lingering from a previous run
if command -v fuser >/dev/null 2>&1; then
    fuser -k 18080/tcp 18000/tcp >/dev/null 2>&1 || true
fi

# 1. Start Go Backend
echo -e "${BLUE}▶ Starting Go Backend API on :18080...${NC}"
cd "$BACKEND_DIR"

if [ -f "bin/server" ]; then
    ./bin/server &
    BACKEND_PID=$!
else
    go run cmd/server/main.go &
    BACKEND_PID=$!
fi

# Wait for backend health check
echo -e "${BLUE}⏳ Waiting for backend health check...${NC}"
HEALTHY=false
for i in {1..30}; do
    if curl -s http://localhost:18080/health >/dev/null 2>&1; then
        HEALTHY=true
        break
    fi
    sleep 0.5
done

if [ "$HEALTHY" = true ]; then
    echo -e "${GREEN}✔ Backend API is LIVE at: http://localhost:18080${NC}"
else
    echo -e "${RED}✖ Failed to start Go Backend on :18080.${NC}"
    exit 1
fi

# 2. Start Next.js Frontend
echo -e "${CYAN}▶ Starting Next.js Mobile Frontend on :18000...${NC}"
cd "$FRONTEND_DIR"
rm -rf .next
npm run dev &
FRONTEND_PID=$!

echo -e "\n${GREEN}${BOLD}============================================================${NC}"
echo -e "${GREEN}${BOLD} 🎉 CashFlow is running!${NC}"
echo -e "${CYAN} • Mobile App Frontend : ${BOLD}http://localhost:18000${NC}"
echo -e "${BLUE} • Go REST Backend API  : ${BOLD}http://localhost:18080${NC}"
echo -e "${YELLOW} • Press Ctrl+C anytime to stop both services.${NC}"
echo -e "${GREEN}${BOLD}============================================================${NC}\n"

# Keep script running and wait for background processes
wait "$FRONTEND_PID" "$BACKEND_PID"

