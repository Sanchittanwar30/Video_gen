# Complete Colab Setup - Copy & Paste Ready

## Step-by-Step Colab Setup

### Step 1: Open Colab & Upload Notebook

1. Go to: https://colab.research.google.com/
2. Click: "File" → "Upload notebook"
3. Upload: `colab/Video_Rendering_Colab.ipynb`

### Step 2: Set Your API URL

Find the cell with:
```python
API_BASE_URL = "http://localhost:3000"
```

**Change to:**
```python
API_BASE_URL = "https://iesha-ordainable-cullen.ngrok-free.dev"
```

### Step 3: Run Setup Cells

#### Cell 1: Install Dependencies
```python
# Install Node.js (v20)
!curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
!apt-get install -y nodejs

# Verify installation
!node --version
!npm --version
```

#### Cell 2: Install FFmpeg
```python
# Install FFmpeg (required for Remotion)
!apt-get update
!apt-get install -y ffmpeg

# Verify FFmpeg
!ffmpeg -version | head -n 1
```

#### Cell 3: Install Chromium
```python
# Install Chrome/Chromium for Remotion
!apt-get install -y chromium-browser chromium-chromedriver

# Set Chrome path for Remotion
import os
os.environ['REMOTION_BROWSER_EXECUTABLE'] = '/usr/bin/chromium-browser'
```

#### Cell 4: Upload Project Files
```python
from google.colab import files
import zipfile
import os

# Create project directory
!mkdir -p /content/video-gen

print("📦 Upload your project ZIP file (colab-project.zip):")
uploaded = files.upload()

# Extract it
for filename in uploaded.keys():
    if filename.endswith('.zip'):
        print(f"📂 Extracting {filename}...")
        with zipfile.ZipFile(filename, 'r') as zip_ref:
            zip_ref.extractall('/content/video-gen')
        print(f"✅ Extracted {filename} to /content/video-gen")
        os.remove(filename)  # Clean up

# Change to project directory
os.chdir('/content/video-gen')
print(f"✅ Current directory: {os.getcwd()}")
print(f"📁 Project files: {', '.join(os.listdir('.'))}")
```

**When this cell runs:**
1. Click "Choose Files" button
2. Select `colab-project.zip` from your computer
3. Wait for upload and extraction

#### Cell 5: Install Project Dependencies
```python
# Install npm dependencies
!npm install

print("✅ Dependencies installed!")
```

#### Cell 6: Configure Environment
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
API_BASE_URL = "https://iesha-ordainable-cullen.ngrok-free.dev"

print("✅ Environment configured!")
print(f"📡 API URL: {API_BASE_URL}")
```

#### Cell 7: Test API Connection
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

#### Cell 8: Auto-Process Jobs
```python
import requests
import json
import time
import subprocess

if API_BASE_URL and API_BASE_URL != "http://localhost:3000":
    print("🔄 Polling for pending jobs...")
    
    # Poll for pending jobs
    try:
        response = requests.get(f"{API_BASE_URL}/api/colab/jobs/pending")
        if response.status_code == 200:
            pending_jobs = response.json().get('jobs', [])
            print(f"📋 Found {len(pending_jobs)} pending jobs")
            
            for job in pending_jobs:
                job_id = job['jobId']
                plan_url = job['planUrl']
                callback_url = f"{API_BASE_URL}/api/colab/callback/{job_id}"
                
                print(f"\n🎬 Processing job {job_id}...")
                
                # Download plan
                plan_response = requests.get(f"{API_BASE_URL}{plan_url}")
                plan = plan_response.json()
                
                # Update status to processing
                requests.post(callback_url, json={'status': 'processing', 'startedAt': True})
                
                # Save plan to file
                plan_file = f'{job_id}-plan.json'
                with open(plan_file, 'w') as f:
                    json.dump(plan, f)
                
                # Create render script
                render_script = f'''import {{ renderStoryboardVideo }} from './server/services/remotion-ai-renderer';
import {{ readFileSync }} from 'fs';
import axios from 'axios';

async function render() {{
  try {{
    const plan = JSON.parse(readFileSync('{plan_file}', 'utf-8'));
    console.log('Starting video render for job {job_id}...');
    const outputPath = await renderStoryboardVideo(plan);
    console.log('Render complete! Output:', outputPath);
    
    await axios.post('{callback_url}', {{
      status: 'completed',
      outputPath: outputPath
    }});
    
    console.log('Job completed and callback sent!');
  }} catch (error) {{
    console.error('Render failed:', error);
    await axios.post('{callback_url}', {{
      status: 'failed',
      error: error.message
    }});
    process.exit(1);
  }}
}}

render();'''
                
                script_file = f'colab-render-{job_id}.ts'
                with open(script_file, 'w') as f:
                    f.write(render_script)
                
                # Run render
                print(f"🎥 Rendering video...")
                result = subprocess.run(['npx', 'ts-node', script_file], 
                                      capture_output=True, text=True, cwd='/content/video-gen')
                print(result.stdout)
                if result.stderr:
                    print("Errors:", result.stderr)
        else:
            print("✅ No pending jobs found")
    except Exception as e:
        print(f"❌ Error: {e}")
else:
    print("⚠️ API_BASE_URL not set correctly")
```

### Step 4: Test It!

**In your local terminal, create a test job:**
```powershell
curl -X POST http://localhost:3000/api/colab/generate `
  -H "Content-Type: application/json" `
  -d '{\"videoPlan\":{\"frames\":[{\"id\":\"test\",\"type\":\"whiteboard_diagram\",\"duration\":5,\"text\":\"Test\",\"animate\":false}]}}'
```

**In Colab:** Run Cell 8 again - it should pick up and process the job!

### Step 5: Check Status & Download

```powershell
# Get jobId from response, then:
curl http://localhost:3000/api/colab/status/{jobId}

# When completed:
curl http://localhost:3000/api/colab/download/{jobId} -o video.mp4
```

## Quick Checklist

- [ ] Colab notebook uploaded
- [ ] API_BASE_URL set to ngrok URL
- [ ] Dependencies installed (Node.js, FFmpeg, Chromium)
- [ ] Project ZIP uploaded and extracted
- [ ] npm install completed
- [ ] API connection tested
- [ ] Test job created
- [ ] Job processed in Colab
- [ ] Video downloaded

## Troubleshooting

**"Module not found" errors:**
- Make sure you ran `npm install`
- Check you're in `/content/video-gen` directory

**"Connection refused":**
- Verify API server is running
- Check ngrok is active
- Test API URL in browser

**"No pending jobs":**
- Create a job first via API
- Check job was created: `curl http://localhost:3000/api/colab/jobs/pending`

## Your Files

- **ZIP file:** `colab-project.zip` (ready to upload)
- **ngrok URL:** `https://iesha-ordainable-cullen.ngrok-free.dev`
- **Notebook:** `colab/Video_Rendering_Colab.ipynb`

Everything is ready! Just follow the steps above. 🚀

