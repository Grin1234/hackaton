#!/bin/bash

# Ubuntu Setup Script for AI Code Review Assistant
# This script installs all required dependencies on Ubuntu/Debian

set -e

echo "🚀 Starting Ubuntu setup for AI Code Review Assistant..."
echo ""

# Check if running as root for system packages
if [ "$EUID" -eq 0 ]; then 
    echo "⚠️  Please run this script as a regular user (not root)"
    echo "   The script will prompt for sudo when needed."
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect Ubuntu/Debian version
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO=$ID
        VERSION=$VERSION_ID
    else
        echo -e "${RED}✗${NC} Cannot detect distribution. This script is for Ubuntu/Debian."
        exit 1
    fi
}

# Function to update package list
update_package_list() {
    echo -e "${YELLOW}📦 Updating package list...${NC}"
    sudo apt-get update -qq
}

# Function to install Node.js if not present
install_nodejs() {
    if command_exists node && command_exists npm; then
        NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 18 ]; then
            echo -e "${GREEN}✓${NC} Node.js $(node --version) and npm $(npm --version) are already installed"
            return 0
        else
            echo -e "${YELLOW}⚠${NC} Node.js version is less than 18. Updating..."
        fi
    fi
    
    echo -e "${YELLOW}📦 Installing Node.js and npm...${NC}"
    
    # Install Node.js 18+ using NodeSource repository
    if ! command_exists node || [ "$NODE_VERSION" -lt 18 ]; then
        echo "   Adding NodeSource repository..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        sudo apt-get install -y nodejs npm
    fi
    
    echo -e "${GREEN}✓${NC} Node.js $(node --version) and npm $(npm --version) installed successfully"
}

# Function to install MongoDB
install_mongodb() {
    if command_exists mongod; then
        echo -e "${GREEN}✓${NC} MongoDB is already installed"
        return 0
    fi
    
    echo -e "${YELLOW}📦 Installing MongoDB...${NC}"
    
    # Install MongoDB using official repository
    echo "   Adding MongoDB repository..."
    
    # Install dependencies
    sudo apt-get install -y wget curl gnupg
    
    # Add MongoDB GPG key
    wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
    
    # Add MongoDB repository
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    
    # Update package list
    sudo apt-get update -qq
    
    # Install MongoDB
    sudo apt-get install -y mongodb-org
    
    # Enable and start MongoDB service
    echo -e "${YELLOW}🔄 Starting MongoDB service...${NC}"
    sudo systemctl enable mongod
    sudo systemctl start mongod
    echo -e "${GREEN}✓${NC} MongoDB installed and started"
}

# Function to install Ollama
install_ollama() {
    if command_exists ollama; then
        echo -e "${GREEN}✓${NC} Ollama is already installed"
        return 0
    fi
    
    echo -e "${YELLOW}📦 Installing Ollama...${NC}"
    
    # Install using official installer
    echo "   Downloading and installing Ollama..."
    curl -fsSL https://ollama.ai/install.sh | sh
    
    # Start Ollama service (if systemd service is available)
    if systemctl --user list-unit-files | grep -q ollama.service; then
        echo -e "${YELLOW}🔄 Starting Ollama service...${NC}"
        systemctl --user enable ollama.service 2>/dev/null || true
        systemctl --user start ollama.service 2>/dev/null || true
    else
        echo -e "${YELLOW}ℹ️${NC} Ollama installed. You may need to start it manually with: ollama serve"
    fi
    
    # Wait a moment for Ollama to start
    sleep 2
    
    echo -e "${GREEN}✓${NC} Ollama installed"
}

# Function to pull default code model
pull_default_model() {
    echo -e "${YELLOW}📥 Pulling default code model (codellama)...${NC}"
    echo "   This may take a few minutes depending on your internet connection..."
    
    # Wait for Ollama to be ready
    sleep 3
    
    # Check if Ollama is running
    if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️${NC} Ollama doesn't appear to be running."
        echo "   Starting Ollama in background..."
        ollama serve > /dev/null 2>&1 &
        sleep 5
    fi
    
    if ollama pull codellama 2>/dev/null; then
        echo -e "${GREEN}✓${NC} codellama model downloaded successfully"
    else
        echo -e "${YELLOW}⚠️  Could not pull codellama model automatically.${NC}"
        echo "   You can manually pull it later with: ollama pull codellama"
        echo "   Or try: ollama pull llama2"
    fi
}

# Main installation flow
detect_distro
echo "Detected: $DISTRO $VERSION"
echo ""

update_package_list

echo ""
echo "Step 1/4: Checking Node.js..."
install_nodejs

echo ""
echo "Step 2/4: Installing MongoDB..."
install_mongodb

echo ""
echo "Step 3/4: Installing Ollama..."
install_ollama

echo ""
echo "Step 4/4: Setting up default model..."
pull_default_model

echo ""
echo -e "${GREEN}✅ Setup completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Run 'npm run install:all' to install Node.js dependencies"
echo "2. Copy .env.example to .env and configure your environment variables"
echo "3. Run 'npm run dev' to start the development servers"
echo ""
echo "To verify your setup, run: npm run verify"

