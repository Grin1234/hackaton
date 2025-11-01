#!/bin/bash

# Test Script for AI Code Review Assistant
# Tests various functionality of the application

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🧪 Testing AI Code Review Assistant"
echo ""

ERRORS=0

# Test 1: MongoDB Connection
echo "Test 1: MongoDB Connection"
if mongo code-review --eval "db.stats()" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} MongoDB is accessible"
else
    echo -e "${RED}✗${NC} MongoDB connection failed"
    ERRORS=$((ERRORS + 1))
fi

# Test 2: Backend API
echo ""
echo "Test 2: Backend API"
if curl -s http://localhost:5000/api/health | grep -q "ok"; then
    echo -e "${GREEN}✓${NC} Backend API is running"
else
    echo -e "${YELLOW}⚠${NC} Backend API not running (expected if not started)"
fi

# Test 3: Ollama Connection
echo ""
echo "Test 3: Ollama Connection"
if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Ollama is running"
    if ollama list 2>/dev/null | grep -q codellama; then
        echo -e "${GREEN}✓${NC} codellama model available"
    else
        echo -e "${YELLOW}⚠${NC} codellama model not found"
    fi
else
    echo -e "${YELLOW}⚠${NC} Ollama not running (expected if not started)"
fi

# Test 4: Workspace Database
echo ""
echo "Test 4: Workspace Database"
WORKSPACE_COUNT=$(mongo code-review --quiet --eval "db.workspaces.countDocuments({})" 2>/dev/null || echo "0")
if [ "$WORKSPACE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Found $WORKSPACE_COUNT workspace(s) in database"
    echo "   Workspaces:"
    mongo code-review --quiet --eval "db.workspaces.find({}, {path: 1, name: 1}).forEach(function(w) { print('     - ' + w.path + ' (' + w.name + ')'); })" 2>/dev/null || echo "     (could not list)"
else
    echo -e "${YELLOW}⚠${NC} No workspaces found in database"
fi

# Test 5: Review Database
echo ""
echo "Test 5: Review Database"
REVIEW_COUNT=$(mongo code-review --quiet --eval "db.reviews.countDocuments({})" 2>/dev/null || echo "0")
if [ "$REVIEW_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Found $REVIEW_COUNT review(s) in database"
else
    echo -e "${YELLOW}⚠${NC} No reviews found in database (expected if no files reviewed yet)"
fi

# Test 6: File Watcher Setup
echo ""
echo "Test 6: File Watcher Setup"
if [ -f "electron/services/fileWatcher.js" ]; then
    echo -e "${GREEN}✓${NC} File watcher service exists"
else
    echo -e "${RED}✗${NC} File watcher service missing"
    ERRORS=$((ERRORS + 1))
fi

# Test 7: Review Queue Setup
echo ""
echo "Test 7: Review Queue Setup"
if [ -f "electron/services/reviewQueue.js" ]; then
    echo -e "${GREEN}✓${NC} Review queue service exists"
else
    echo -e "${RED}✗${NC} Review queue service missing"
    ERRORS=$((ERRORS + 1))
fi

# Test 8: Frontend Files
echo ""
echo "Test 8: Frontend Files"
if [ -f "frontend/src/main.jsx" ] && [ -f "frontend/src/App.jsx" ]; then
    echo -e "${GREEN}✓${NC} Frontend files exist"
else
    echo -e "${RED}✗${NC} Frontend files missing"
    ERRORS=$((ERRORS + 1))
fi

# Test 9: Electron Files
echo ""
echo "Test 9: Electron Files"
if [ -f "electron/main.js" ] && [ -f "electron/preload.cjs" ]; then
    echo -e "${GREEN}✓${NC} Electron files exist"
else
    echo -e "${RED}✗${NC} Electron files missing"
    ERRORS=$((ERRORS + 1))
fi

# Summary
echo ""
echo "════════════════════════════════════════"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "To start the application:"
    echo "  npm run dev"
else
    echo -e "${RED}❌ Found $ERRORS critical error(s)${NC}"
fi
echo "════════════════════════════════════════"

