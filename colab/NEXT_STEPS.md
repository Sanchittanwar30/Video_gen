# Next Steps After Getting ngrok Auth Token

## Step 1: Configure ngrok

Run this command (replace YOUR_AUTH_TOKEN with your actual token):

```powershell
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

Or use the helper script:
```powershell
.\colab\setup-ngrok.ps1 -AuthToken YOUR_AUTH_TOKEN
```

## Step 2: Start Your API Server

**Terminal 1:**
```powershell
npm run start:api
```

Wait until you see:
```
🚀 Video Generation API server running on port 3000
```

## Step 3: Start ngrok Tunnel

**Open a NEW Terminal (Terminal 2):**
```powershell
ngrok http 3000
```

You'll see output like:
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:3000
```

**IMPORTANT:** Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

## Step 4: Test Connection

**Terminal 3 (or use Terminal 2):**
```powershell
python colab/test-ngrok-connection.py https://abc123.ngrok-free.app
```

Replace with your actual ngrok URL.

## Step 5: Set Up Colab

1. Go to https://colab.research.google.com/
2. Upload `colab/Video_Rendering_Colab.ipynb`
3. Find the cell with `API_BASE_URL`
4. Change it to your ngrok URL:
   ```python
   API_BASE_URL = "https://abc123.ngrok-free.app"  # Your ngrok URL
   ```

## Step 6: Run Colab

Run all cells in the Colab notebook. It will:
- Install dependencies
- Set up the environment
- Poll for pending jobs
- Process videos automatically

## Quick Commands Reference

```powershell
# Terminal 1: API Server
npm run start:api

# Terminal 2: ngrok
ngrok http 3000

# Terminal 3: Test
python colab/test-ngrok-connection.py YOUR_NGROK_URL

# Create a test job
curl -X POST http://localhost:3000/api/colab/generate -H "Content-Type: application/json" -d '{"videoPlan":{"frames":[{"id":"test","type":"whiteboard_diagram","duration":5,"text":"Test","animate":false}]}}'
```

