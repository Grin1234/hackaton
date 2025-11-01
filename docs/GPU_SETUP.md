# GPU Acceleration Setup Guide

## Status
✅ **NVIDIA GPU Detected**: RTX 4050 Laptop GPU (6GB VRAM, 5.4GB free)
✅ **CUDA Libraries**: Installed (`/usr/lib/libcuda.so`)
✅ **NVIDIA Drivers**: Installed (580.95.05)

## Current Issue
⚠️ **Ollama is using CPU mode** despite GPU being available

## Why GPU is Faster
- **CPU**: ~8-10 seconds per review
- **GPU**: ~0.5-2 seconds per review
- **Speedup**: 5-10x faster!

## Solution: Install Ollama with CUDA Support

The Arch Linux package `ollama` may not include CUDA support. You have two options:

### Option 1: Install Ollama from Official Source (Recommended)
```bash
# Download and install official Ollama binary with CUDA support
curl -fsSL https://ollama.com/install.sh | sh

# Or use the AppImage with GPU support
wget https://github.com/ollama/ollama/releases/latest/download/ollama-linux-amd64
chmod +x ollama-linux-amd64
sudo mv ollama-linux-amd64 /usr/local/bin/ollama
```

### Option 2: Use Pre-built Binary with CUDA
```bash
# Check if your Ollama binary supports CUDA
ldd $(which ollama) | grep cuda

# If no CUDA libraries, download official build
curl -L https://github.com/ollama/ollama/releases/latest/download/ollama-linux-amd64 -o /tmp/ollama
chmod +x /tmp/ollama
sudo mv /tmp/ollama /usr/local/bin/ollama
```

## Verify GPU Usage

After installing GPU-enabled Ollama:
```bash
# Restart Ollama with GPU
killall ollama
npm run start:ollama

# Check logs
tail -f /tmp/ollama.log | grep -i "gpu\|cuda"

# Should see something like:
# "inference compute id=gpu library=cuda"
```

## Expected Performance

With GPU acceleration:
- **Small files** (< 100 lines): 0.5-1 second
- **Medium files** (100-500 lines): 1-3 seconds  
- **Large files** (> 500 lines): 3-10 seconds

Much faster than CPU mode (1-3 minutes)!

## Next Steps

1. Install GPU-enabled Ollama (see above)
2. Restart Ollama: `npm run start:ollama`
3. Test review speed - should be much faster!
4. Check GPU usage: `nvidia-smi` while reviewing

