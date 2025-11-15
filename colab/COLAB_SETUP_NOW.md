# Colab Setup - Ready to Go! 🚀

## Your Setup Status
- ✅ ngrok configured
- ✅ API server running
- ✅ ngrok tunnel active
- ✅ Your ngrok URL: ``

## Quick Setup (3 Steps)

### Step 1: Open Google Colab

1. Go to: **https://colab.research.google.com/**
2. Sign in with your Google account
3. Click: **"File" → "Upload notebook"**
4. Select: `colab/Video_Rendering_Colab.ipynb` from your project

### Step 2: Set Your API URL

In the Colab notebook, find the cell with:
```python
API_BASE_URL = "http://localhost:3000"
```

**Change it to:**
```python
API_BASE_URL = "https://iesha-ordainable-cullen.ngrok-free.dev"
```

### Step 3: Run All Cells

Click **"Runtime" → "Run all"** or press `Ctrl+F9`

The notebook will:
1. Install Node.js, FFmpeg, Chromium
2. Set up your project
3. Connect to your API
4. Auto-process video jobs

## Important: ngrok Warning Page

When you first access the ngrok URL, you'll see a warning page. This is normal for free ngrok.

**To bypass it:**
1. Click "Visit Site" button on the warning page
2. Or add this header to requests (Colab will handle this automatically)

## Test Your Setup

**Create a test job (in your local terminal):**
```powershell
curl -X POST http://localhost:3000/api/colab/generate `
  -H "Content-Type: application/json" `
  -d '{\"videoPlan\":{\"frames\":[{\"id\":\"test\",\"type\":\"whiteboard_diagram\",\"duration\":5,\"text\":\"Test\",\"animate\":false}]}}'
```

**In Colab:** The notebook should automatically pick up and process the job!

## What Happens Next

1. **You create jobs** via API → `POST /api/colab/generate`
2. **Colab polls** for pending jobs → `GET /api/colab/jobs/pending`
3. **Colab processes** the video
4. **Colab calls back** → `POST /api/colab/callback/{jobId}`
5. **You download** the video → `GET /api/colab/download/{jobId}`

## Troubleshooting

### "Connection refused" in Colab
- Make sure API server is running: `npm run start:api`
- Make sure ngrok is running: `ngrok http 3000`
- Check the URL is correct in Colab

### ngrok warning page
- This is normal for free tier
- Click "Visit Site" to continue
- Colab will handle this automatically

### "No pending jobs"
- Create a job first via API
- Check: `curl http://localhost:3000/api/colab/jobs/pending`

## Your Colab API URL

```
https://iesha-ordainable-cullen.ngrok-free.dev
```

**Use this exact URL in your Colab notebook!**

## Need More Help?

- See `colab/COLAB_SETUP_STEP_BY_STEP.md` for detailed instructions
- See `colab/API_USAGE.md` for API examples
- See `colab/ngrok-setup.md` for ngrok troubleshooting

