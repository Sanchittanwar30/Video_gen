# Colab Quick Setup (5 Minutes)

## ✅ Current Status
- API server: ✅ Running
- ngrok: ✅ Running
- Next: Set up Colab notebook

## Step 1: Get Your ngrok URL

Look at your **ngrok terminal window**. You should see:
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:3000
```

**Copy the HTTPS URL** (the `https://...` part)

## Step 2: Open Google Colab

1. **Go to:** https://colab.research.google.com/
2. **Sign in** with Google account
3. **Click:** "File" → "Upload notebook"
4. **Select:** `colab/Video_Rendering_Colab.ipynb` from your project folder

## Step 3: Configure API URL

In the Colab notebook, find the cell that says:
```python
API_BASE_URL = "http://localhost:3000"
```

**Change it to your ngrok URL:**
```python
API_BASE_URL = "https://YOUR_NGROK_URL_HERE"  # Paste your ngrok URL here
```

## Step 4: Run All Cells

Click **"Runtime" → "Run all"** or run cells one by one:

1. ✅ Install Dependencies (Node.js, FFmpeg, Chromium)
2. ✅ Upload Project Files (or use git clone)
3. ✅ Install Project Dependencies (`npm install`)
4. ✅ Configure Environment
5. ✅ Test API Connection
6. ✅ Render Video (auto-processes jobs)

## Step 5: Test It Works

**In your local terminal, create a test job:**
```powershell
curl -X POST http://localhost:3000/api/colab/generate `
  -H "Content-Type: application/json" `
  -d '{\"videoPlan\":{\"frames\":[{\"id\":\"test\",\"type\":\"whiteboard_diagram\",\"duration\":5,\"text\":\"Test\",\"animate\":false}]}}'
```

**In Colab:** The notebook should automatically pick up the job and process it!

## Step 6: Check Status

```powershell
# Get jobId from the response above, then:
curl http://localhost:3000/api/colab/status/JOB_ID
```

## Step 7: Download Video

When status is "completed":
```powershell
curl http://localhost:3000/api/colab/download/JOB_ID -o video.mp4
```

## 🎉 Done!

Your Colab setup is complete. The notebook will automatically:
- Poll for pending jobs
- Download video plans
- Render videos
- Call back to your server

## Need Help?

- See `colab/COLAB_SETUP_STEP_BY_STEP.md` for detailed instructions
- Check `colab/API_USAGE.md` for API documentation
- See `colab/ngrok-setup.md` for ngrok troubleshooting

