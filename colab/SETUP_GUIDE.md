# Complete Colab Setup Guide

This guide will walk you through setting up Google Colab to process your video rendering jobs.

## Prerequisites

- Your API server running locally
- ngrok installed (for exposing local API to Colab)
- Google account (for Colab)

## Step-by-Step Setup

### Step 1: Install ngrok

**Windows:**
```powershell
# Option 1: Using Chocolatey
choco install ngrok

# Option 2: Manual download
# 1. Go to https://ngrok.com/download
# 2. Download Windows version
# 3. Extract to a folder (e.g., C:\ngrok)
# 4. Add to PATH or use full path
```

**Mac:**
```bash
brew install ngrok
```

**Linux:**
```bash
# Download and install
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar -xzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/
```

### Step 2: Get ngrok Auth Token

1. **Sign up for free ngrok account:**
   - Go to https://dashboard.ngrok.com/signup
   - Create a free account

2. **Get your auth token:**
   - Go to https://dashboard.ngrok.com/get-started/your-authtoken
   - Copy your authtoken

3. **Configure ngrok:**
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
   ```

### Step 3: Start Your API Server

In your project directory:

```bash
# Make sure dependencies are installed
npm install

# Start the API server
npm run start:api
```

You should see:
```
🚀 Video Generation API server running on port 3000
📡 Health check: http://localhost:3000/health
```

**Keep this terminal running!**

### Step 4: Start ngrok Tunnel

**Open a NEW terminal** (keep the API server running in the first one):

**Windows (PowerShell):**
```powershell
# Option 1: Use helper script
.\colab\start-ngrok.ps1

# Option 2: Manual
ngrok http 3000
```

**Mac/Linux:**
```bash
# Option 1: Use helper script
./colab/start-ngrok.sh

# Option 2: Manual
ngrok http 3000
```

You'll see output like:
```
ngrok                                                                               

Session Status                online
Account                       Your Name (Plan: Free)
Version                       3.x.x
Region                        United States (us)
Latency                      45ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**IMPORTANT:** Copy the `Forwarding` URL (e.g., `https://abc123.ngrok-free.app`)

**Keep this terminal running too!**

### Step 5: Test Your Connection

**Open a THIRD terminal** (or use the same one):

```bash
# Test the connection
python colab/test-ngrok-connection.py https://abc123.ngrok-free.app
```

Replace `https://abc123.ngrok-free.app` with your actual ngrok URL.

You should see:
```
✅ All tests passed! Your ngrok tunnel is working.
```

### Step 6: Set Up Google Colab

1. **Open Google Colab:**
   - Go to https://colab.research.google.com/
   - Sign in with your Google account

2. **Upload the notebook:**
   - Click "File" → "Upload notebook"
   - Select `colab/Video_Rendering_Colab.ipynb` from your project
   - Or create a new notebook and copy the cells

3. **Set your API URL:**
   - Find the cell that says `API_BASE_URL = "http://localhost:3000"`
   - Change it to your ngrok URL:
     ```python
     API_BASE_URL = "https://abc123.ngrok-free.app"  # Your ngrok URL
     ```

### Step 7: Run Colab Setup Cells

Run the cells in order:

1. **Install Dependencies** - Installs Node.js, FFmpeg, Chromium
2. **Upload Project Files** - Upload your project or use git clone
3. **Install Project Dependencies** - Runs `npm install`
4. **Configure Environment** - Sets up environment variables
5. **Render Video** - Processes jobs from your API

### Step 8: Test the Complete Flow

**In your local terminal (or using the example script):**

```bash
# Create a test job
curl -X POST http://localhost:3000/api/colab/generate \
  -H "Content-Type: application/json" \
  -d '{
    "videoPlan": {
      "frames": [
        {
          "id": "test-frame",
          "type": "whiteboard_diagram",
          "duration": 5,
          "text": "Test Frame",
          "animate": false
        }
      ]
    }
  }'
```

**In Colab:**
- Run the rendering cell
- It should automatically pick up the pending job
- Process it and call back to your server

**Check job status:**
```bash
curl http://localhost:3000/api/colab/status/{jobId}
```

## Quick Reference

### Terminal 1: API Server
```bash
npm run start:api
```

### Terminal 2: ngrok Tunnel
```bash
ngrok http 3000
```

### Terminal 3: Create Jobs / Check Status
```bash
# Create job
curl -X POST http://localhost:3000/api/colab/generate \
  -H "Content-Type: application/json" \
  -d @your-video-plan.json

# Check status
curl http://localhost:3000/api/colab/status/{jobId}

# Download video
curl http://localhost:3000/api/colab/download/{jobId} -o video.mp4
```

### Colab Notebook
- Set `API_BASE_URL` to your ngrok URL
- Run all cells
- Colab will automatically process pending jobs

## Troubleshooting

### "ngrok: command not found"
- Make sure ngrok is installed and in your PATH
- Try using full path: `C:\ngrok\ngrok.exe http 3000` (Windows)

### "Connection refused" in Colab
- Make sure your API server is running
- Make sure ngrok is running
- Check that you're using the HTTPS URL (not HTTP)
- Verify the URL in Colab matches the ngrok forwarding URL

### "Tunnel closed" or "Session expired"
- Free ngrok tunnels close after 2 hours
- Restart ngrok: `ngrok http 3000`
- Update `API_BASE_URL` in Colab with the new URL

### "Too many requests" from ngrok
- You've hit the free tier limit (40 requests/minute)
- Wait a minute and try again
- Or upgrade to ngrok paid plan

### Colab can't find pending jobs
- Make sure your API server is accessible via ngrok
- Test with: `python colab/test-ngrok-connection.py YOUR_NGROK_URL`
- Check Colab notebook is using the correct `API_BASE_URL`

### Jobs stuck in "pending"
- Make sure Colab notebook is running
- Check Colab can reach your API (test connection)
- Verify Colab is polling: `GET /api/colab/jobs/pending`

## Next Steps

Once everything is working:

1. **Create real video jobs** using your video plans
2. **Monitor progress** via status endpoint or Colab logs
3. **Download videos** when jobs complete
4. **Set up webhooks** for automatic notifications (optional)

## Alternative: Deploy to Cloud

Instead of ngrok, you can deploy your API to:
- **Heroku** (free tier)
- **Railway** (free tier)
- **Render** (free tier)

Then use your deployed URL directly in Colab (no ngrok needed).

## Need Help?

- Check [ngrok-setup.md](./ngrok-setup.md) for detailed ngrok info
- Check [API_USAGE.md](./API_USAGE.md) for API documentation
- Check [README.md](./README.md) for general Colab info

