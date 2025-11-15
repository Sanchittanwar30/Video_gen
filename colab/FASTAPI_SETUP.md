# FastAPI Server Setup

This guide shows how to use FastAPI instead of the Node.js/Express server.

## Why FastAPI?

- **Python-native**: If you prefer Python over Node.js
- **Fast**: High performance async framework
- **Easy**: Simple API definitions
- **Auto docs**: Built-in Swagger UI at `/docs`

## Installation

### 1. Install Python Dependencies

```bash
# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r colab/requirements-fastapi.txt
```

### 2. Start FastAPI Server

```bash
# Option 1: Using uvicorn directly
uvicorn colab.fastapi_server:app --host 0.0.0.0 --port 3000 --reload

# Option 2: Run as Python script
python colab/fastapi_server.py
```

The server will start on `http://localhost:3000`

### 3. Access API Documentation

Open in browser:
- **Swagger UI**: http://localhost:3000/docs
- **ReDoc**: http://localhost:3000/redoc

## Using with ngrok

**ngrok installation is required** - it must be installed on your system to create the tunnel.

### Install ngrok

**Windows:**
```powershell
# Using Chocolatey
choco install ngrok

# Or download from https://ngrok.com/download
```

**Mac:**
```bash
brew install ngrok
```

**Linux:**
```bash
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar -xzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/
```

### Configure ngrok

1. Sign up: https://dashboard.ngrok.com/signup
2. Get token: https://dashboard.ngrok.com/get-started/your-authtoken
3. Configure: `ngrok config add-authtoken YOUR_TOKEN`

### Start ngrok Tunnel

```bash
# In a new terminal (keep FastAPI server running)
ngrok http 3000
```

Copy the ngrok URL (e.g., `https://abc123.ngrok-free.app`)

## Complete Workflow

### Terminal 1: FastAPI Server
```bash
# Activate venv (if using)
source venv/bin/activate  # Mac/Linux
# or
venv\Scripts\activate     # Windows

# Start server
uvicorn colab.fastapi_server:app --host 0.0.0.0 --port 3000 --reload
```

### Terminal 2: ngrok Tunnel
```bash
ngrok http 3000
```

### Terminal 3: Test
```bash
# Test health endpoint
curl http://localhost:3000/health

# Test with ngrok URL
python colab/test-ngrok-connection.py https://abc123.ngrok-free.app
```

### Colab Notebook
```python
API_BASE_URL = "https://abc123.ngrok-free.app"  # Your ngrok URL
```

## API Endpoints

All endpoints are the same as the Node.js version:

- `POST /api/colab/generate` - Create job
- `GET /api/colab/status/{jobId}` - Get status
- `GET /api/colab/download/{jobId}` - Download video
- `GET /api/colab/jobs/pending` - Get pending jobs
- `POST /api/colab/callback/{jobId}` - Job callback
- `POST /api/colab/process/{jobId}` - Process locally

## Differences from Node.js Version

1. **Language**: Python instead of TypeScript/Node.js
2. **Framework**: FastAPI instead of Express
3. **Auto docs**: Swagger UI at `/docs`
4. **Async**: Native async/await support
5. **Rendering**: Currently doesn't include video rendering (you'd need to integrate with your Node.js renderer or create a Python renderer)

## Integrating Video Rendering

The FastAPI server currently handles job management but doesn't render videos. To add rendering:

### Option 1: Call Node.js Renderer
```python
import subprocess
import json

async def render_video(video_plan: dict):
    # Call your Node.js renderer
    result = subprocess.run(
        ["node", "render-video.js", json.dumps(video_plan)],
        capture_output=True,
        text=True
    )
    return result.stdout
```

### Option 2: Use Python Renderer
You'd need to port your Remotion rendering logic to Python or use a Python video library.

## Why ngrok is Required

**ngrok must be installed on your system** because:

1. **Local server**: Your FastAPI server runs on `localhost:3000` (only accessible locally)
2. **Colab needs public URL**: Colab notebooks run in Google's cloud and can't access `localhost`
3. **ngrok creates tunnel**: It creates a public HTTPS URL that forwards to your local server
4. **No alternative**: Without ngrok (or similar tool), Colab can't reach your local API

### Alternatives to ngrok

If you don't want to install ngrok, you can:

1. **Deploy to cloud**: Deploy FastAPI to Heroku, Railway, Render, etc.
2. **Use cloudflare tunnel**: Similar to ngrok but from Cloudflare
3. **Use localtunnel**: `npm install -g localtunnel && lt --port 3000`
4. **Use serveo**: `ssh -R 80:localhost:3000 serveo.net`

But ngrok is the most popular and reliable option.

## Quick Start Script

Create `start-fastapi.sh` (Mac/Linux) or `start-fastapi.ps1` (Windows):

```bash
#!/bin/bash
# start-fastapi.sh

# Activate venv
source venv/bin/activate

# Start FastAPI
uvicorn colab.fastapi_server:app --host 0.0.0.0 --port 3000 --reload
```

```powershell
# start-fastapi.ps1
venv\Scripts\activate
uvicorn colab.fastapi_server:app --host 0.0.0.0 --port 3000 --reload
```

## Testing

```bash
# Health check
curl http://localhost:3000/health

# Create job
curl -X POST http://localhost:3000/api/colab/generate \
  -H "Content-Type: application/json" \
  -d '{"videoPlan":{"frames":[{"id":"test","type":"whiteboard_diagram","duration":5,"text":"Test","animate":false}]}}'

# Check status
curl http://localhost:3000/api/colab/status/{jobId}
```

## Summary

✅ **FastAPI**: Python alternative to Express.js  
✅ **ngrok required**: Must be installed to create tunnel  
✅ **Same API**: All endpoints work the same  
✅ **Auto docs**: Swagger UI at `/docs`  
⚠️ **Rendering**: Need to integrate with your renderer

