# Installation Guide

## System Requirements

- **Node.js**: 20.x or higher
- **npm**: 9.x or higher (or yarn/pnpm)
- **Redis**: 7.x or higher (for job queue)
- **FFmpeg**: For video processing (optional, Remotion includes bundled version)

## System Dependencies

### macOS

```bash
# Install Node.js (if not installed)
brew install node@20

# Install Redis
brew install redis
brew services start redis

# Optional: Install FFmpeg (if you want to use system FFmpeg instead of bundled)
brew install ffmpeg
```

### Linux (Ubuntu/Debian)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Redis
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis

# Optional: Install FFmpeg
sudo apt-get install ffmpeg
```

### Linux (CentOS/RHEL)

```bash
# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install Redis
sudo yum install redis
sudo systemctl start redis
sudo systemctl enable redis

# Optional: Install FFmpeg
sudo yum install ffmpeg
```

### Windows

1. **Node.js**: Download from [nodejs.org](https://nodejs.org/)
2. **Redis**: Use WSL2 or install [Redis for Windows](https://github.com/microsoftarchive/redis/releases)
3. **FFmpeg**: Download from [ffmpeg.org](https://ffmpeg.org/download.html)

### Docker (Alternative)

If you prefer Docker, you don't need to install Redis separately:

```bash
# Run Redis in Docker
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

## NPM Dependencies

### Installation

```bash
# Install all dependencies
npm install
```

This will install:

#### Production Dependencies

- **Core Rendering**:
  - `react` (^18.2.0) - React framework
  - `react-dom` (^18.2.0) - React DOM rendering
  - `remotion` (^4.0.0) - Remotion video framework

- **Backend**:
  - `express` (^4.18.2) - Express.js web framework
  - `cors` (^2.8.5) - CORS middleware
  - `dotenv` (^16.3.1) - Environment variable management

- **Job Queue**:
  - `bullmq` (^5.3.0) - Job queue library
  - `ioredis` (^5.3.2) - Redis client

- **Real-time**:
  - `ws` (^8.14.2) - WebSocket server

- **Storage**:
  - `@supabase/supabase-js` (^2.39.0) - Supabase storage client

- **Utilities**:
  - `uuid` (^9.0.1) - UUID generation
  - `multer` (^1.4.5-lts.1) - File upload handling
  - `axios` (^1.6.2) - HTTP client

#### Development Dependencies

- **Remotion Tools**:
  - `@remotion/bundler` (^4.0.0) - Remotion bundler
  - `@remotion/cli` (^4.0.0) - Remotion CLI
  - `@remotion/renderer` (^4.0.0) - Remotion renderer

- **TypeScript**:
  - `typescript` (^5.3.3) - TypeScript compiler
  - `ts-node` (^10.9.2) - TypeScript execution
  - `ts-node-dev` (^2.0.0) - TypeScript dev server

- **Type Definitions**:
  - `@types/node` (^20.10.0)
  - `@types/react` (^18.2.0)
  - `@types/react-dom` (^18.2.0)
  - `@types/express` (^4.17.21)
  - `@types/cors` (^2.8.17)
  - `@types/ws` (^8.5.10)
  - `@types/uuid` (^9.0.7)
  - `@types/multer` (^1.4.11)

- **Code Quality**:
  - `prettier` (^3.1.0) - Code formatter

### Verify Installation

```bash
# Check Node.js version
node --version  # Should be 20.x or higher

# Check npm version
npm --version  # Should be 9.x or higher

# Check Redis
redis-cli ping  # Should return "PONG"

# Verify dependencies
npm list --depth=0
```

## Quick Start Checklist

- [ ] Node.js 20+ installed
- [ ] Redis installed and running
- [ ] All npm dependencies installed (`npm install`)
- [ ] Environment variables configured (`.env` file)
- [ ] Storage provider configured (S3, Supabase, or local)
- [ ] API server can start (`npm run dev:api`)
- [ ] Worker can start (`npm run dev:worker`)

## Troubleshooting

### Redis Connection Issues

```bash
# Check if Redis is running
redis-cli ping

# Check Redis port
redis-cli -p 6379 ping

# Start Redis (macOS)
brew services start redis

# Start Redis (Linux)
sudo systemctl start redis
```

### Node.js Version Issues

```bash
# Use nvm to manage Node.js versions
nvm install 20
nvm use 20
```

### Permission Issues

```bash
# Fix npm permissions (if needed)
sudo chown -R $(whoami) ~/.npm
```

