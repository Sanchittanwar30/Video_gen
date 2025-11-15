# Colab Setup - Step by Step Guide

Follow these steps to set up Google Colab with your API server.

## Prerequisites Checklist

Before starting, make sure you have:
- [x] ngrok configured (✅ Done)
- [ ] API server running on port 3000
- [ ] ngrok tunnel running
- [ ] ngrok URL copied

## Step 1: Start Your Services

### Terminal 1: API Server
```powershell
npm run start:api
```
Wait for: `🚀 Video Generation API server running on port 3000`

### Terminal 2: ngrok Tunnel
```powershell
ngrok http 3000
```
**IMPORTANT:** Copy the Forwarding URL (e.g., `https://abc123.ngrok-free.app`)

### Terminal 3: Test Connection
```powershell
python colab/test-ngrok-connection.py YOUR_NGROK_URL
```
Should show: `✅ All tests passed!`

## Step 2: Open Google Colab

1. **Go to:** https://colab.research.google.com/
2. **Sign in** with your Google account
3. **Click:** "File" → "Upload notebook"
4. **Select:** `colab/Video_Rendering_Colab.ipynb` from your project

OR

1. **Go to:** https://colab.research.google.com/
2. **Click:** "New notebook"
3. **Copy cells** from `colab/Video_Rendering_Colab.ipynb`

## Step 3: Configure API URL

In the Colab notebook, find the cell that says:
```python
API_BASE_URL = "http://localhost:3000"
```

**Change it to your ngrok URL:**
```python
API_BASE_URL = "https://abc123.ngrok-free.app"  # Replace with your actual ngrok URL
```

## Step 4: Run Setup Cells

Run the cells in order:

### Cell 1: Install Dependencies
```python
# Install Node.js (v20)
!curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
!apt-get install -y nodejs

# Verify installation
!node --version
!npm --version
```

### Cell 2: Install FFmpeg
```python
# Install FFmpeg (required for Remotion)
!apt-get update
!apt-get install -y ffmpeg

# Verify FFmpeg
!ffmpeg -version | head -n 1
```

### Cell 3: Install Chromium
```python
# Install Chrome/Chromium for Remotion
!apt-get install -y chromium-browser chromium-chromedriver

# Set Chrome path for Remotion
import os
os.environ['REMOTION_BROWSER_EXECUTABLE'] = '/usr/bin/chromium-browser'
```

### Cell 4: Upload Project Files

**Option A: Upload ZIP file**
1. Zip your project: `zip -r project.zip . -x "node_modules/*" ".git/*"`
2. Upload the ZIP in Colab
3. Unzip: `!unzip project.zip -d /content/video-gen`

**Option B: Git Clone (if your project is in a repo)**
```python
!git clone YOUR_REPO_URL /content/video-gen
```

**Option C: Manual Upload**
- Upload individual files as needed

### Cell 5: Install Project Dependencies
```python
import os
os.chdir('/content/video-gen')
!npm install
```

### Cell 6: Configure Environment
```python
# Set environment variables for Colab
import os

# Remotion configuration
os.environ['REMOTION_BROWSER_EXECUTABLE'] = '/usr/bin/chromium-browser'
os.environ['REMOTION_BROWSER_TIMEOUT'] = '120000'  # 2 minutes

# FFmpeg configuration
os.environ['FFMPEG_BINARY'] = '/usr/bin/ffmpeg'
os.environ['FFPROBE_BINARY'] = '/usr/bin/ffprobe'

# Your API URL (set this!)
API_BASE_URL = "https://abc123.ngrok-free.app"  # YOUR NGROK URL HERE

print("Environment configured!")
print(f"API URL: {API_BASE_URL}")
```

### Cell 7: Test API Connection
```python
import requests

# Test connection
try:
    response = requests.get(f"{API_BASE_URL}/health", timeout=5)
    if response.status_code == 200:
        print("✅ API connection successful!")
        print(response.json())
    else:
        print(f"⚠️ API returned status: {response.status_code}")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    print("Check that:")
    print("1. Your API server is running")
    print("2. ngrok tunnel is active")
    print("3. API_BASE_URL is correct")
```

### Cell 8: Render Video (Auto-process jobs)
```python
# This cell will automatically poll for pending jobs and process them
import requests
import json
import time

if API_BASE_URL and API_BASE_URL != "http://localhost:3000":
    print("Using API mode...")
    
    # Poll for pending jobs
    try:
        response = requests.get(f"{API_BASE_URL}/api/colab/jobs/pending")
        if response.status_code == 200:
            pending_jobs = response.json().get('jobs', [])
            print(f"Found {len(pending_jobs)} pending jobs")
            
            for job in pending_jobs:
                job_id = job['jobId']
                plan_url = job['planUrl']
                callback_url = f"{API_BASE_URL}/api/colab/callback/{job_id}"
                
                print(f"\nProcessing job {job_id}...")
                
                # Download plan
                plan_response = requests.get(f"{API_BASE_URL}{plan_url}")
                plan = plan_response.json()
                
                # Update status to processing
                requests.post(callback_url, json={'status': 'processing', 'startedAt': True})
                
                # Save plan to file
                plan_file = f'{job_id}-plan.json'
                with open(plan_file, 'w') as f:
                    json.dump(plan, f)
                
                # Create and run render script
                # (The actual rendering code would go here)
                print(f"Job {job_id} processing started")
        else:
            print("No pending jobs found")
    except Exception as e:
        print(f"Error: {e}")
else:
    print("API_BASE_URL not set correctly")
```

## Step 5: Create a Test Job

**In your local terminal:**
```powershell
curl -X POST http://localhost:3000/api/colab/generate `
  -H "Content-Type: application/json" `
  -d '{\"videoPlan\":{\"frames\":[{\"id\":\"test\",\"type\":\"whiteboard_diagram\",\"duration\":5,\"text\":\"Test\",\"animate\":false}]}}'
```

Copy the `jobId` from the response.

## Step 6: Check Job Status

```powershell
curl http://localhost:3000/api/colab/status/JOB_ID_HERE
```

## Step 7: Download Completed Video

When status is "completed":
```powershell
curl http://localhost:3000/api/colab/download/JOB_ID_HERE -o video.mp4
```

## Troubleshooting

### "Connection refused" in Colab
- Check API server is running
- Check ngrok is running
- Verify API_BASE_URL is correct
- Test connection locally first

### "No pending jobs"
- Create a job via API
- Check job was created: `curl http://localhost:3000/api/colab/jobs/pending`
- Verify Colab can reach your API

### "Module not found" errors
- Run `!npm install` in Colab
- Check you're in the right directory: `!pwd`
- Verify project files were uploaded correctly

### ngrok tunnel closed
- Free tunnels close after 2 hours
- Restart ngrok: `ngrok http 3000`
- Update API_BASE_URL in Colab with new URL

## Quick Reference

**Local Commands:**
```powershell
# Start API
npm run start:api

# Start ngrok
ngrok http 3000

# Create job
curl -X POST http://localhost:3000/api/colab/generate -H "Content-Type: application/json" -d '{"videoPlan":{"frames":[...]}}'

# Check status
curl http://localhost:3000/api/colab/status/{jobId}

# Download video
curl http://localhost:3000/api/colab/download/{jobId} -o video.mp4
```

**Colab Setup:**
1. Upload notebook
2. Set `API_BASE_URL = "YOUR_NGROK_URL"`
3. Run all cells
4. Colab will auto-process jobs

