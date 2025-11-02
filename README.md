# AI-Powered Code Review Assistant

An AI-powered code review assistant that uses locally hosted Ollama LLM to analyze source code and provide automated code reviews.

## Features

- 🤖 **AI-Powered Reviews**: Uses locally hosted Ollama LLM for privacy and performance
- ⚡ **Fast Analysis**: Get comprehensive code reviews in seconds
- 🔒 **Privacy-First**: Your code stays on your machine - no cloud uploads
- 📝 **Multiple Languages**: Supports JavaScript, TypeScript, Python, Java, C++, Go, Rust, and more
- 💬 **Comment System**: Add comments and replies to review findings
- 🔍 **Incremental Review**: Review only changed code segments (stretch goal)
- 🎯 **Pre-commit Hooks**: Integrate with git hooks for automatic reviews

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: MongoDB
- **LLM**: Ollama (local)
- **Deployment**: AWS (optional)

## Prerequisites

- Linux distribution (Arch Linux or Ubuntu/Debian)
- Node.js 18+ and npm 9+
- MongoDB
- Ollama with a code model (codellama recommended)

## Installation

### Automated Setup

#### Arch Linux

Run the setup script to automatically install all dependencies:

```bash
npm run setup
```

#### Ubuntu/Debian

Run the Ubuntu setup script to automatically install all dependencies:

```bash
npm run setup:ubuntu
```

Both scripts will install:
- Node.js and npm
- MongoDB
- Ollama
- Pull the default codellama model

### Manual Setup

#### Arch Linux

1. **Install Node.js and npm**:
   ```bash
   sudo pacman -S nodejs npm
   ```

2. **Install MongoDB**:
   ```bash
   sudo pacman -S mongodb
   sudo systemctl start mongodb.service
   sudo systemctl enable mongodb.service
   ```

3. **Install Ollama**:
   ```bash
   # Using yay (AUR helper)
   yay -S ollama
   
   # Or download from https://ollama.ai
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

#### Ubuntu/Debian

1. **Install Node.js and npm**:
   ```bash
   # Using NodeSource repository (recommended for Node.js 18+)
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Or use apt (may have older version)
   sudo apt-get update
   sudo apt-get install -y nodejs npm
   ```

2. **Install MongoDB**:
   ```bash
   # Install dependencies
   sudo apt-get install -y wget curl gnupg
   
   # Add MongoDB GPG key
   wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
   
   # Add MongoDB repository
   echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
   
   # Install MongoDB
   sudo apt-get update
   sudo apt-get install -y mongodb-org
   
   # Start MongoDB service
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```

3. **Install Ollama**:
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

#### Common Steps (All Distributions)

4. **Pull a code model**:
   ```bash
   ollama pull codellama
   # or
   ollama pull llama2
   ```

5. **Install project dependencies**:
   ```bash
   npm run install:all
   ```

6. **Configure environment variables**:
   ```bash
   cp .env.example backend/.env
   cp .env.example frontend/.env
   ```

   Edit `backend/.env` and `frontend/.env` with your configuration.

### GPU Support (Optional)

For NVIDIA GPU acceleration on Ubuntu/Debian:

```bash
bash scripts/install-ollama-gpu-ubuntu.sh
```

For Arch Linux with GPU support:

```bash
bash scripts/install-ollama-gpu-arch.sh
```

Note: GPU acceleration requires NVIDIA GPU with CUDA toolkit installed.

## Usage

### Development Mode

Start both frontend and backend in development mode:

```bash
npm run dev
```

Or start them separately:

```bash
# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend
```

### Verify Installation

Check if all dependencies are installed and running:

```bash
npm run verify
```

## API Endpoints

- `POST /api/reviews` - Upload code file and create review
- `GET /api/reviews/:id` - Get a specific review
- `GET /api/reviews` - Get all reviews
- `PUT /api/reviews/:id` - Update a review
- `GET /api/health` - Health check

## Project Structure

```
hackaton/
├── frontend/          # React application
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   └── package.json
├── backend/           # Node.js API
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   └── middleware/
│   └── package.json
├── scripts/           # Setup and utility scripts
└── README.md
```

## Development

### Backend Development

The backend uses Express.js with MongoDB. Key files:
- `backend/src/server.js` - Express server entry point
- `backend/src/routes/reviewRoutes.js` - API routes
- `backend/src/services/ollamaService.js` - Ollama integration
- `backend/src/models/Review.js` - MongoDB schema

### Frontend Development

The frontend uses React with Vite. Key files:
- `frontend/src/pages/UploadPage.jsx` - File upload interface
- `frontend/src/pages/ReviewPage.jsx` - Review results display
- `frontend/src/components/CodeViewer.jsx` - Code display component

## Stretch Goals

- [x] Incremental review (git diff parsing)
- [x] Comment/Reply handling
- [x] Pre-commit evaluation
- [x] Guideline awareness (PEP8, Google Style)
- [x] Automatic fixes
- [x] Modular evaluation (linting, security, architecture)
- [x] Effort estimation for fixes
- [x] Review history per file

## License

ISC
