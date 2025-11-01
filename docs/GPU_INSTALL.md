# GPU Mode Setup - Quick Guide

## What You Need to Install

### Step 1: Install CUDA Toolkit
```bash
sudo pacman -S cuda
```

This installs the CUDA runtime libraries that Ollama needs to use your GPU.

### Step 2: Restart Ollama
```bash
npm run start:ollama
```

### Step 3: Verify GPU Mode
```bash
tail -f /tmp/ollama.log | grep -i "gpu\|cuda"
```

Should see: `inference compute id=gpu library=cuda`

## Expected Performance

After GPU setup:
- **CPU mode**: 1-3 minutes per review 🐌
- **GPU mode**: 0.5-3 seconds per review ⚡

**Speedup: 5-10x faster!**

## What Gets Installed

The `cuda` package provides:
- `libcudart.so` - CUDA runtime library
- `libcublas.so` - CUDA BLAS library  
- `libcurand.so` - CUDA random number generation
- Other CUDA libraries needed by Ollama

## Package Size

CUDA toolkit is ~500MB-1GB. It's worth it for the speed boost!

## After Installation

Once CUDA is installed, Ollama will automatically detect and use your GPU.
You'll see GPU usage in `nvidia-smi` when reviews are running.

