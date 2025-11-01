#!/bin/bash

# Dependency Verification Script
# Checks if all required dependencies are installed and running

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 Verifying dependencies..."
echo ""

ERRORS=0

# Check Node.js
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js: $NODE_VERSION"
else
    echo -e "${RED}✗${NC} Node.js: Not installed"
    ERRORS=$((ERRORS + 1))
fi

# Check npm
if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} npm: $NPM_VERSION"
else
    echo -e "${RED}✗${NC} npm: Not installed"
    ERRORS=$((ERRORS + 1))
fi

# Check MongoDB
if command -v mongod >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} MongoDB: Installed"
    
    # Check if MongoDB is running
    if systemctl is-active --quiet mongodb.service 2>/dev/null || pgrep mongod >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} MongoDB: Running"
    else
        echo -e "${YELLOW}⚠${NC} MongoDB: Installed but not running"
        echo "   Start with: sudo systemctl start mongodb.service"
    fi
else
    echo -e "${RED}✗${NC} MongoDB: Not installed"
    ERRORS=$((ERRORS + 1))
fi

# Check Ollama
if command -v ollama >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Ollama: Installed"
    
    # Check if Ollama is running
    if systemctl --user is-active --quiet ollama.service 2>/dev/null || pgrep ollama >/dev/null 2>&1 || curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Ollama: Running"
        
        # Check for models
        MODELS=$(ollama list 2>/dev/null | wc -l)
        if [ "$MODELS" -gt 1 ]; then
            echo -e "${GREEN}✓${NC} Ollama models: Available"
            echo "   Installed models:"
            ollama list 2>/dev/null | tail -n +2 | sed 's/^/     /'
        else
            echo -e "${YELLOW}⚠${NC} Ollama: No models found"
            echo "   Pull a model with: ollama pull codellama"
        fi
    else
        echo -e "${YELLOW}⚠${NC} Ollama: Installed but not running"
        echo "   Start with: systemctl --user start ollama.service"
    fi
else
    echo -e "${RED}✗${NC} Ollama: Not installed"
    ERRORS=$((ERRORS + 1))
fi

# Check if node_modules exist
if [ -d "node_modules" ] && [ -d "backend/node_modules" ] && [ -d "frontend/node_modules" ]; then
    echo -e "${GREEN}✓${NC} Node.js dependencies: Installed"
else
    echo -e "${YELLOW}⚠${NC} Node.js dependencies: Not installed"
    echo "   Install with: npm run install:all"
fi

echo ""
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All dependencies verified!${NC}"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS missing dependency(ies)${NC}"
    echo "   Run 'npm run setup' to install missing dependencies"
    exit 1
fi

