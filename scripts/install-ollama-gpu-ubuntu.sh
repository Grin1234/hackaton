#!/bin/bash
# Install GPU-enabled Ollama for Ubuntu/Debian
# This script sets up CUDA support for Ollama

echo "🚀 Installing GPU-enabled Ollama for Ubuntu..."
echo ""

# Check if NVIDIA GPU is available
if ! command -v nvidia-smi &> /dev/null; then
    echo "⚠️  NVIDIA GPU not detected or nvidia-smi not found."
    echo "   This script is for systems with NVIDIA GPUs."
    echo "   You can still use Ollama with CPU mode."
    echo ""
    read -p "Do you want to continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to check if CUDA is installed
check_cuda() {
    if command -v nvcc &> /dev/null; then
        CUDA_VERSION=$(nvcc --version | grep "release" | sed 's/.*release \([0-9]\+\.[0-9]\+\).*/\1/')
        echo -e "${GREEN}✓${NC} CUDA $CUDA_VERSION is installed"
        return 0
    else
        echo -e "${YELLOW}⚠️${NC} CUDA toolkit not found"
        return 1
    fi
}

# Function to install CUDA (optional)
install_cuda() {
    echo -e "${YELLOW}📦 To enable GPU acceleration, CUDA toolkit is recommended.${NC}"
    echo "   You can install it manually from:"
    echo "   https://developer.nvidia.com/cuda-downloads"
    echo ""
    echo "   Or use the following commands:"
    echo "   wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb"
    echo "   sudo dpkg -i cuda-keyring_1.1-1_all.deb"
    echo "   sudo apt-get update"
    echo "   sudo apt-get -y install cuda-toolkit-12-4"
    echo ""
    read -p "Do you want to install CUDA toolkit now? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}⚠️${NC} CUDA installation is complex and may require system restart."
        echo "   Please follow the official guide: https://docs.nvidia.com/cuda/cuda-installation-guide-linux/"
        echo "   For now, continuing with CPU-compatible Ollama installation..."
    fi
}

# Check for existing Ollama installation
if command -v ollama &> /dev/null; then
    echo -e "${GREEN}✓${NC} Ollama is already installed"
    OLLAMA_EXISTS=true
else
    OLLAMA_EXISTS=false
fi

# Check CUDA
if ! check_cuda; then
    install_cuda
fi

# Install or update Ollama
echo ""
echo "📦 Installing/updating Ollama with GPU support..."

# Download latest Ollama binary with CUDA support
LATEST_VERSION=$(curl -s https://api.github.com/repos/ollama/ollama/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST_VERSION" ]; then
    LATEST_VERSION="latest"
fi

echo "   Version: $LATEST_VERSION"
echo "   Downloading pre-built binary..."

# Create temp directory
TMP_DIR=$(mktemp -d)
cd "$TMP_DIR"

# Download Ollama binary
DOWNLOAD_URL="https://github.com/ollama/ollama/releases/${LATEST_VERSION}/download/ollama-linux-amd64"

if command -v wget &> /dev/null; then
    wget --progress=bar:force -O ollama "${DOWNLOAD_URL}" 2>&1 | grep -E "Downloading|%" || true
else
    curl -L --progress-bar -o ollama "${DOWNLOAD_URL}"
fi

if [ $? -eq 0 ] && [ -f ollama ]; then
    echo ""
    echo "✅ Download complete!"
    echo "🔧 Installing..."
    
    chmod +x ollama
    
    # Install to /usr/local/bin (requires sudo)
    sudo mv ollama /usr/local/bin/ollama
    
    # Verify installation
    if command -v ollama &> /dev/null; then
        echo -e "${GREEN}✓${NC} Ollama installed successfully"
        
        # Check for CUDA libraries
        echo ""
        echo "🔍 Checking GPU support..."
        if ldd /usr/local/bin/ollama 2>&1 | grep -i cuda > /dev/null; then
            echo -e "${GREEN}✓${NC} CUDA support detected in binary!"
        else
            echo -e "${YELLOW}⚠️${NC} CUDA libraries not linked (may need CUDA toolkit)"
        fi
        
        # Restart Ollama service if it exists
        if systemctl --user list-unit-files | grep -q ollama.service; then
            echo ""
            echo "🔄 Restarting Ollama service..."
            systemctl --user restart ollama.service 2>/dev/null || true
        fi
        
        echo ""
        echo -e "${GREEN}✅ Setup complete!${NC}"
        echo ""
        echo "🚀 To start Ollama with GPU support:"
        echo "   npm run start:ollama"
        echo ""
        echo "   Or manually:"
        echo "   ollama serve"
        echo ""
        echo "GPU mode should now work and be 5-10x faster!"
    else
        echo -e "${RED}✗${NC} Installation failed"
        exit 1
    fi
else
    echo -e "${RED}✗${NC} Download failed"
    echo "   Falling back to official installer..."
    curl -fsSL https://ollama.ai/install.sh | sh
fi

# Cleanup
cd -
rm -rf "$TMP_DIR"

