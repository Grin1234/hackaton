#!/bin/bash

# Complete Setup Script for AI Code Review Assistant
# This script sets up everything needed to run the application

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Complete Setup for AI Code Review Assistant${NC}"
echo ""

# Step 1: System Dependencies
echo -e "${BLUE}Step 1/5: Checking system dependencies...${NC}"
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Node.js $(node --version) and npm $(npm --version)"
else
    echo -e "${YELLOW}⚠${NC} Node.js/npm not found. Run: npm run setup"
fi

if command -v mongod >/dev/null 2>&1; then
    if systemctl is-active --quiet mongodb 2>/dev/null || pgrep mongod >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} MongoDB is running"
    else
        echo -e "${YELLOW}⚠${NC} MongoDB installed but not running. Starting..."
        sudo systemctl start mongodb || echo -e "${RED}✗${NC} Failed to start MongoDB"
    fi
else
    echo -e "${YELLOW}⚠${NC} MongoDB not found. Run: npm run setup"
fi

if command -v ollama >/dev/null 2>&1; then
    if curl -s http://localhost:11434/api/tags >/dev/null 2>&1 || pgrep ollama >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Ollama is running"
        if ollama list 2>/dev/null | grep -q codellama; then
            echo -e "${GREEN}✓${NC} codellama model found"
        else
            echo -e "${YELLOW}⚠${NC} codellama model not found. Run: ollama pull codellama"
        fi
    else
        echo -e "${YELLOW}⚠${NC} Ollama not running. Start with: ollama serve"
    fi
else
    echo -e "${YELLOW}⚠${NC} Ollama not found. Run: npm run setup"
fi

echo ""

# Step 2: Install Node.js dependencies
echo -e "${BLUE}Step 2/5: Installing Node.js dependencies...${NC}"
if [ ! -d "node_modules" ] || [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
    echo "Running: npm run install:all"
    npm run install:all
else
    echo -e "${GREEN}✓${NC} Node.js dependencies already installed"
fi

echo ""

# Step 3: Setup environment variables
echo -e "${BLUE}Step 3/5: Setting up environment variables...${NC}"

if [ ! -f "backend/.env" ]; then
    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example backend/.env
        echo -e "${GREEN}✓${NC} Created backend/.env from example"
    else
        cat > backend/.env << EOF
PORT=5000
MONGODB_URI=mongodb://localhost:27017/code-review
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=codellama
CORS_ORIGIN=http://localhost:5173
EOF
        echo -e "${GREEN}✓${NC} Created backend/.env with defaults"
    fi
else
    echo -e "${GREEN}✓${NC} backend/.env already exists"
fi

if [ ! -f "frontend/.env" ]; then
    if [ -f "frontend/.env.example" ]; then
        cp frontend/.env.example frontend/.env
        echo -e "${GREEN}✓${NC} Created frontend/.env from example"
    else
        cat > frontend/.env << EOF
VITE_API_URL=http://localhost:5000
EOF
        echo -e "${GREEN}✓${NC} Created frontend/.env with defaults"
    fi
else
    echo -e "${GREEN}✓${NC} frontend/.env already exists"
fi

echo ""

# Step 4: Verify Electron setup
echo -e "${BLUE}Step 4/5: Verifying Electron setup...${NC}"
if [ -d "electron" ] && [ -f "electron/main.js" ] && [ -f "electron/preload.cjs" ]; then
    echo -e "${GREEN}✓${NC} Electron files present"
else
    echo -e "${RED}✗${NC} Electron files missing"
fi

echo ""

# Step 5: Final verification
echo -e "${BLUE}Step 5/5: Final verification...${NC}"
echo ""
echo "Checking critical files:"
CRITICAL_FILES=(
    "package.json"
    "backend/package.json"
    "frontend/package.json"
    "backend/src/server.js"
    "frontend/src/main.jsx"
    "electron/main.js"
    "electron/preload.cjs"
)

ALL_GOOD=true
for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file MISSING"
        ALL_GOOD=false
    fi
done

echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
if [ "$ALL_GOOD" = true ]; then
    echo -e "${GREEN}✅ Setup Complete!${NC}"
    echo ""
    echo "To start the application, run:"
    echo -e "  ${YELLOW}npm run dev${NC}"
    echo ""
    echo "Or start services separately:"
    echo "  Terminal 1: ${YELLOW}npm run dev:backend${NC}"
    echo "  Terminal 2: ${YELLOW}npm run dev:frontend${NC}"
    echo "  Terminal 3: ${YELLOW}npm run dev:electron${NC}"
else
    echo -e "${RED}❌ Setup incomplete. Please fix missing files.${NC}"
fi
echo -e "${BLUE}════════════════════════════════════════${NC}"

