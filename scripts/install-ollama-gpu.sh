#!/bin/bash
# Faster Ollama GPU installation - download pre-built binary directly
# This is faster than the installer script

echo "🚀 Fast Ollama GPU Installation"
echo "   Downloading pre-built binary with CUDA support..."
echo ""

# Determine latest version
LATEST_VERSION=$(curl -s https://api.github.com/repos/ollama/ollama/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST_VERSION" ]; then
    LATEST_VERSION="latest"
fi

echo "📦 Version: $LATEST_VERSION"
echo "⬇️  Downloading..."

# Download directly
DOWNLOAD_URL="https://github.com/ollama/ollama/releases/${LATEST_VERSION}/download/ollama-linux-amd64"

# Try wget first (usually faster), fallback to curl
if command -v wget &> /dev/null; then
    wget --progress=bar:force -O /tmp/ollama "${DOWNLOAD_URL}" 2>&1 | grep -E "Downloading|%"
else
    curl -L --progress-bar -o /tmp/ollama "${DOWNLOAD_URL}"
fi

if [ $? -eq 0 ] && [ -f /tmp/ollama ]; then
    echo ""
    echo "✅ Download complete!"
    echo "🔧 Installing..."
    
    chmod +x /tmp/ollama
    sudo mv /tmp/ollama /usr/local/bin/ollama
    
    echo "✅ Ollama installed successfully!"
    echo ""
    echo "🔍 Verifying GPU support..."
    ldd /usr/local/bin/ollama 2>&1 | grep -i cuda && echo "✅ CUDA support detected!" || echo "⚠️  CUDA libraries not linked (may need CUDA toolkit)"
    
    echo ""
    echo "🚀 Starting Ollama with GPU..."
    killall ollama 2>/dev/null
    sleep 2
    npm run start:ollama
else
    echo "❌ Download failed. Trying alternative method..."
    echo "💡 You can continue using CPU mode - it works, just slower"
fi

