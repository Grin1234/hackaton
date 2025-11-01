#!/bin/bash
# Install GPU-enabled Ollama for Arch Linux
# This replaces the non-CUDA Ollama with the GPU-enabled version

echo "🚀 Installing GPU-enabled Ollama..."
echo ""

# Check if already installed
if pacman -Q ollama-cuda &> /dev/null; then
    echo "✅ ollama-cuda is already installed!"
    echo ""
    echo "To use it:"
    echo "  1. Remove /usr/local/bin/ollama if it exists"
    echo "  2. Run: npm run start:ollama"
    exit 0
fi

echo "📦 Installing ollama-cuda package..."
echo "   This package includes CUDA support for GPU acceleration"
echo ""

# Install ollama-cuda
sudo pacman -S ollama-cuda

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ollama-cuda installed successfully!"
    echo ""
    echo "🔄 Removing non-CUDA Ollama binary..."
    if [ -f "/usr/local/bin/ollama" ]; then
        sudo rm /usr/local/bin/ollama
        echo "✅ Removed /usr/local/bin/ollama"
    fi
    
    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "🚀 Now restart Ollama:"
    echo "   npm run start:ollama"
    echo ""
    echo "GPU mode should now work and be 5-10x faster!"
else
    echo "❌ Installation failed"
    exit 1
fi

