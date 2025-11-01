#!/bin/bash
# Start Ollama with GPU mode (or CPU fallback)
# This script tries GPU first, falls back to CPU if GPU unavailable

echo "🔄 Stopping existing Ollama processes..."
killall ollama 2>/dev/null || echo "No existing Ollama processes found"
sleep 2

# Check which Ollama binary to use (prefer system ollama from ollama-cuda package)
OLLAMA_BIN="ollama"

# Check if ollama-cuda package is installed
if pacman -Q ollama-cuda &> /dev/null; then
    # Use system ollama (from ollama-cuda package)
    # Make sure /usr/bin is in PATH before /usr/local/bin
    export PATH="/usr/bin:${PATH}"
    OLLAMA_BIN="/usr/bin/ollama"
    echo "✅ Using system Ollama from ollama-cuda package"
    
    # Check if it has CUDA support
    if ldd $OLLAMA_BIN 2>&1 | grep -q cuda; then
        echo "✅ CUDA libraries detected in binary"
    else
        echo "⚠️  System ollama may not have CUDA support linked"
        echo "   Checking if CUDA libraries are available..."
    fi
elif [ -f "/usr/local/bin/ollama" ]; then
    OLLAMA_BIN="/usr/local/bin/ollama"
    echo "⚠️  Using /usr/local/bin/ollama (may not have GPU support)"
    echo "   Install ollama-cuda: sudo pacman -S ollama-cuda"
elif command -v ollama &> /dev/null; then
    OLLAMA_BIN="ollama"
    echo "⚠️  Using system ollama (unknown GPU support)"
fi

# Check if GPU is available
GPU_AVAILABLE=false
if command -v nvidia-smi &> /dev/null; then
    if nvidia-smi &> /dev/null; then
        GPU_AVAILABLE=true
        echo "✅ NVIDIA GPU detected"
    fi
fi

if [ "$GPU_AVAILABLE" = true ]; then
    echo "🚀 Starting Ollama with GPU acceleration..."
    echo "   This will be MUCH faster (5-10x) than CPU mode"
    export OLLAMA_NUM_GPU=1
else
    echo "🚀 Starting Ollama in CPU mode (no GPU detected)..."
    echo "   GPU mode is 5-10x faster if available"
    export OLLAMA_NUM_GPU=0
fi

export OLLAMA_HOST=127.0.0.1:11434

# Set CUDA library path if CUDA is installed
if [ -d "/opt/cuda/lib64" ]; then
    export LD_LIBRARY_PATH="/opt/cuda/lib64:${LD_LIBRARY_PATH}"
    echo "📚 CUDA library path set: /opt/cuda/lib64"
fi

# Start Ollama
echo "📝 Using: $OLLAMA_BIN"
nohup $OLLAMA_BIN serve > /tmp/ollama.log 2>&1 &
OLLAMA_PID=$!

# Wait for it to start
echo "⏳ Waiting for Ollama to start..."
sleep 5

# Check if it's running
if ps -p $OLLAMA_PID > /dev/null 2>&1; then
    if curl -s http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
        MODE=$([ "$GPU_AVAILABLE" = true ] && echo "GPU" || echo "CPU")
        echo "✅ Ollama is running in $MODE mode (PID: $OLLAMA_PID)"
        echo "   API: http://127.0.0.1:11434"
        echo "   Logs: /tmp/ollama.log"
        echo ""
        
        # Check if actually using GPU
        sleep 2
        if tail -20 /tmp/ollama.log | grep -qi "cuda\|gpu.*compute\|id=gpu"; then
            echo "⚡ GPU acceleration ACTIVE - reviews will be 5-10x faster!"
        elif [ "$GPU_AVAILABLE" = true ]; then
            echo "⚠️  GPU detected but Ollama may not have CUDA support"
            echo "   Using CPU mode (still works, just slower)"
            echo "   Install GPU-enabled Ollama: bash scripts/install-ollama-gpu.sh"
        else
            echo "💡 Running in CPU mode"
        fi
        echo ""
        echo "To stop Ollama: killall ollama"
    else
        echo "⚠️  Ollama process started but API not responding yet"
        echo "   Check /tmp/ollama.log for details"
    fi
else
    echo "❌ Ollama failed to start. Check /tmp/ollama.log for errors"
    exit 1
fi

