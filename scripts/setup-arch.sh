#!/bin/bash

# Arch Linux Setup Script for AI Code Review Assistant
# This script installs all required dependencies on Arch Linux

set -e

echo "🚀 Starting Arch Linux setup for AI Code Review Assistant..."
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

# Function to install Node.js if not present
install_nodejs() {
    if command_exists node && command_exists npm; then
        echo -e "${GREEN}✓${NC} Node.js $(node --version) and npm $(npm --version) are already installed"
        return 0
    fi
    
    echo -e "${YELLOW}📦 Installing Node.js and npm...${NC}"
    sudo pacman -S --noconfirm nodejs npm
    echo -e "${GREEN}✓${NC} Node.js and npm installed successfully"
}

# Function to install MongoDB
install_mongodb() {
    if command_exists mongod; then
        echo -e "${GREEN}✓${NC} MongoDB is already installed"
        return 0
    fi
    
    echo -e "${YELLOW}📦 Installing MongoDB...${NC}"
    sudo pacman -S --noconfirm mongodb
    
    # Enable and start MongoDB service
    echo -e "${YELLOW}🔄 Starting MongoDB service...${NC}"
    sudo systemctl enable mongodb.service
    sudo systemctl start mongodb.service
    echo -e "${GREEN}✓${NC} MongoDB installed and started"
}

# Function to install Ollama
install_ollama() {
    if command_exists ollama; then
        echo -e "${GREEN}✓${NC} Ollama is already installed"
        return 0
    fi
    
    echo -e "${YELLOW}📦 Installing Ollama...${NC}"
    
    # Check for AUR helper
    if command_exists yay; then
        echo "   Using yay to install from AUR..."
        yay -S --noconfirm ollama
    elif command_exists paru; then
        echo "   Using paru to install from AUR..."
        paru -S --noconfirm ollama
    else
        echo -e "${YELLOW}   No AUR helper found (yay/paru). Installing Ollama manually...${NC}"
        echo "   Downloading Ollama..."
        curl -fsSL https://ollama.ai/install.sh | sh
    fi
    
    # Start Ollama service
    echo -e "${YELLOW}🔄 Starting Ollama service...${NC}"
    systemctl --user enable ollama.service 2>/dev/null || true
    systemctl --user start ollama.service 2>/dev/null || true
    
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
    
    if ollama pull codellama 2>/dev/null; then
        echo -e "${GREEN}✓${NC} codellama model downloaded successfully"
    else
        echo -e "${YELLOW}⚠️  Could not pull codellama model automatically.${NC}"
        echo "   You can manually pull it later with: ollama pull codellama"
        echo "   Or try: ollama pull llama2"
    fi
}

# Main installation flow
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

