#!/bin/bash

# Test Script for AI Code Review Assistant Functionality
# Tests file watching, review queue, and LLM integration

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🧪 Testing AI Code Review Assistant Functionality"
echo ""

ERRORS=0

# Test 1: MongoDB Connection
echo -e "${BLUE}Test 1: MongoDB Connection${NC}"
if mongo code-review --eval "db.stats()" --quiet >/dev/null 2>&1 || mongosh code-review --eval "db.stats()" --quiet >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} MongoDB is accessible"
else
    echo -e "${RED}✗${NC} MongoDB connection failed"
    ERRORS=$((ERRORS + 1))
fi

# Test 2: Backend API
echo ""
echo -e "${BLUE}Test 2: Backend API${NC}"
if curl -s http://localhost:5000/api/health | grep -q "ok"; then
    echo -e "${GREEN}✓${NC} Backend API is running"
else
    echo -e "${YELLOW}⚠${NC} Backend API not running (start with: npm run dev:backend)"
fi

# Test 3: Ollama Connection
echo ""
echo -e "${BLUE}Test 3: Ollama LLM Connection${NC}"
if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Ollama is running"
    if curl -s http://localhost:11434/api/tags | grep -q codellama; then
        echo -e "${GREEN}✓${NC} codellama model available"
    else
        echo -e "${YELLOW}⚠${NC} codellama model not found (run: ollama pull codellama)"
    fi
else
    echo -e "${RED}✗${NC} Ollama not running (start with: ollama serve)"
    ERRORS=$((ERRORS + 1))
fi

# Test 4: Ollama Generate Test
echo ""
echo -e "${BLUE}Test 4: Ollama Generate Test${NC}"
TEST_CODE="function hello() { console.log('Hello World'); }"
RESPONSE=$(curl -s -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"codellama\",\"prompt\":\"Review this code: ${TEST_CODE}\",\"stream\":false}" \
  2>/dev/null || echo "")

if echo "$RESPONSE" | grep -q "response"; then
    echo -e "${GREEN}✓${NC} Ollama can generate reviews"
else
    echo -e "${YELLOW}⚠${NC} Ollama generate test failed (check Ollama logs)"
fi

# Test 5: File Watcher Service
echo ""
echo -e "${BLUE}Test 5: File Watcher Service${NC}"
if [ -f "electron/services/fileWatcher.js" ]; then
    echo -e "${GREEN}✓${NC} File watcher service exists"
    if node -c electron/services/fileWatcher.js 2>/dev/null; then
        echo -e "${GREEN}✓${NC} File watcher syntax valid"
    else
        echo -e "${RED}✗${NC} File watcher syntax error"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} File watcher service missing"
    ERRORS=$((ERRORS + 1))
fi

# Test 6: Review Queue Service
echo ""
echo -e "${BLUE}Test 6: Review Queue Service${NC}"
if [ -f "electron/services/reviewQueue.js" ]; then
    echo -e "${GREEN}✓${NC} Review queue service exists"
    if node -c electron/services/reviewQueue.js 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Review queue syntax valid"
    else
        echo -e "${RED}✗${NC} Review queue syntax error"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} Review queue service missing"
    ERRORS=$((ERRORS + 1))
fi

# Test 7: Backend Ollama Service
echo ""
echo -e "${BLUE}Test 7: Backend Ollama Service${NC}"
if [ -f "backend/src/services/ollamaService.js" ]; then
    echo -e "${GREEN}✓${NC} Ollama service exists"
    if node -c backend/src/services/ollamaService.js 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Ollama service syntax valid"
    else
        echo -e "${RED}✗${NC} Ollama service syntax error"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} Ollama service missing"
    ERRORS=$((ERRORS + 1))
fi

# Test 8: Code Parser
echo ""
echo -e "${BLUE}Test 8: Code Parser${NC}"
if [ -f "backend/src/services/codeParser.js" ]; then
    echo -e "${GREEN}✓${NC} Code parser exists"
    if node -c backend/src/services/codeParser.js 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Code parser syntax valid"
    else
        echo -e "${RED}✗${NC} Code parser syntax error"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} Code parser missing"
    ERRORS=$((ERRORS + 1))
fi

# Test 9: Electron Main Process
echo ""
echo -e "${BLUE}Test 9: Electron Main Process${NC}"
if [ -f "electron/main.js" ]; then
    echo -e "${GREEN}✓${NC} Electron main.js exists"
    if node -c electron/main.js 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Electron main.js syntax valid"
    else
        echo -e "${RED}✗${NC} Electron main.js syntax error"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} Electron main.js missing"
    ERRORS=$((ERRORS + 1))
fi

# Summary
echo ""
echo "════════════════════════════════════════"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All functionality tests passed!${NC}"
    echo ""
    echo "To start the application:"
    echo "  npm run dev"
    echo ""
    echo "To test file watching:"
    echo "  1. Start the app"
    echo "  2. Add a workspace"
    echo "  3. Edit and save a code file in that workspace"
    echo "  4. Check the Electron console for review logs"
else
    echo -e "${RED}❌ Found $ERRORS critical error(s)${NC}"
fi
echo "════════════════════════════════════════"

