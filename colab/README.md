# Google Colab Integration

This directory contains files and scripts for running heavy video rendering tasks on Google Colab.

## 🚀 Quick Start

**Pen Sketch Animation (New):**
1. **[COMPLETE_SETUP_GUIDE.md](./COMPLETE_SETUP_GUIDE.md)** - ⭐ **START HERE** - Full step-by-step setup
2. **[QUICK_START_PEN_SKETCH.md](./QUICK_START_PEN_SKETCH.md)** - Quick reference (5 minutes)
3. **[PEN_SKETCH_SETUP.md](./PEN_SKETCH_SETUP.md)** - Detailed setup guide
4. **[PEN_SKETCH_FEATURES.md](./PEN_SKETCH_FEATURES.md)** - Features and API docs

**General Video Rendering:**
1. **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Complete step-by-step setup
2. **[SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)** - Setup checklist

**Common:**
- **[API_USAGE.md](./API_USAGE.md)** - API endpoint documentation
- **[ngrok-setup.md](./ngrok-setup.md)** - ngrok configuration guide
- **[TROUBLESHOOTING_COLAB.md](./TROUBLESHOOTING_COLAB.md)** - Fix file upload issues
- **[TEST_NGROK_CONNECTION.md](./TEST_NGROK_CONNECTION.md)** - Fix SSL/connection issues

## Overview

Google Colab provides free GPU/CPU resources that can be used to offload computationally intensive video rendering tasks. This is especially useful when:

- Your local machine doesn't have enough resources
- You want to render multiple videos in parallel
- You need GPU acceleration for faster rendering
- You want to avoid blocking your local machine

## Files

### Pen Sketch Animation (New)
- **`colab_pen_sketch_notebook.ipynb`** - Colab notebook for pen-sketch animation
- **`pen_sketch_animation.py`** - Python animation engine
- **`fastapi_pen_sketch.py`** - FastAPI server for pen-sketch animation
- **`requirements-pen-sketch.txt`** - Python dependencies
- **`PEN_SKETCH_SETUP.md`** - Setup guide for pen-sketch animation
- **`QUICK_START_PEN_SKETCH.md`** - Quick start guide
- **`PEN_SKETCH_FEATURES.md`** - Feature documentation

### General Video Rendering
- **`Video_Rendering_Colab.ipynb`** - Colab notebook for general video rendering
- **`upload_to_colab.py`** - Python script to prepare project files for Colab
- **`colab-service.ts`** - TypeScript service for Colab integration
- **`SETUP_GUIDE.md`** - General setup guide
- **`SETUP_CHECKLIST.md`** - Setup checklist

## Quick Start

### Using API Endpoints (Recommended)

The easiest way to use Colab is through the API endpoints:

```bash
# 1. Start your API server
npm run start:api

# 2. Create a job via API
curl -X POST http://localhost:3000/api/colab/generate \
  -H "Content-Type: application/json" \
  -d '{
    "videoPlan": {
      "frames": [...]
    }
  }'

# 3. Poll for status
curl http://localhost:3000/api/colab/status/{jobId}

# 4. Download when complete
curl http://localhost:3000/api/colab/download/{jobId} -o video.mp4
```

See [API_USAGE.md](./API_USAGE.md) for detailed API documentation.

### Using ngrok (Recommended for Local Development)

ngrok is perfect for exposing your local API to Colab:

```bash
# 1. Install ngrok (if not already installed)
# Windows: choco install ngrok
# Mac: brew install ngrok
# Or download from https://ngrok.com/download

# 2. Start your API server
npm run start:api

# 3. In a new terminal, start ngrok
ngrok http 3000

# 4. Copy the Forwarding URL (e.g., https://abc123.ngrok-free.app)

# 5. In Colab notebook, set:
API_BASE_URL = "https://abc123.ngrok-free.app"
```

**Helper scripts:**
- `colab/start-ngrok.sh` (Linux/Mac)
- `colab/start-ngrok.ps1` (Windows PowerShell)

**Test your connection:**
```bash
python colab/test-ngrok-connection.py https://abc123.ngrok-free.app
```

See [ngrok-setup.md](./ngrok-setup.md) for detailed ngrok setup instructions.

### Manual Upload

### Option 1: Manual Upload (Recommended for first-time use)

1. **Prepare your project**:
   ```bash
   python colab/upload_to_colab.py
   # This creates a colab-package/ directory
   zip -r colab-package.zip colab-package/
   ```

2. **Open Google Colab**:
   - Go to https://colab.research.google.com/
   - Upload `colab/Video_Rendering_Colab.ipynb`
   - Or create a new notebook and copy the cells

3. **Upload files**:
   - Upload `colab-package.zip` (or use git clone)
   - Upload your video plan JSON file

4. **Run the notebook**:
   - Execute cells in order
   - The notebook will install dependencies, render the video, and download the output

### Option 2: Git Clone (If your project is in a repository)

1. **Open Colab notebook**
2. **Clone your repository**:
   ```python
   !git clone <your-repo-url> /content/video-gen
   ```
3. **Follow the notebook steps**

## Configuration

### Environment Variables

Set these in the Colab notebook or in your `.env` file:

```bash
# Remotion Configuration
REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium-browser
REMOTION_BROWSER_TIMEOUT=120000

# FFmpeg Configuration
FFMPEG_BINARY=/usr/bin/ffmpeg
FFPROBE_BINARY=/usr/bin/ffprobe

# Optional: API Keys
GEMINI_API_KEY=your-api-key
DEEPGRAM_API_KEY=your-api-key
```

### Colab Service (Optional)

If you want to automate Colab rendering via API, you can set up:

```typescript
import { renderVideoOnColab, checkColabJobStatus } from './colab/colab-service';

const config = {
  enabled: true,
  apiToken: process.env.COLAB_API_TOKEN,
  uploadEndpoint: process.env.COLAB_UPLOAD_ENDPOINT,
  downloadEndpoint: process.env.COLAB_DOWNLOAD_ENDPOINT,
};

// Start render job
const job = await renderVideoOnColab(videoPlan, config);

// Check status
const status = await checkColabJobStatus(job.jobId, config);
```

## What Gets Rendered

The Colab notebook renders videos using the same Remotion pipeline as your local setup:

- **Whiteboard animations** - SVG sketch animations
- **Text overlays** - Subtitles and captions
- **Voiceovers** - Audio tracks synced with video
- **Camera motion** - Zoom and pan effects
- **All Remotion compositions** - Any custom compositions you've created

## Limitations

1. **Colab Session Timeout**: Free Colab sessions timeout after ~90 minutes of inactivity
2. **File Size Limits**: Large video files may need to be downloaded in chunks
3. **GPU Availability**: Free GPU access is limited (T4 GPU when available)
4. **Storage**: Colab provides ~80GB temporary storage (files are deleted when session ends)

## Tips

1. **Save frequently**: Download output videos immediately after rendering
2. **Use GPU**: Enable GPU in Colab (Runtime → Change runtime type → GPU)
3. **Monitor progress**: Watch the render logs in the notebook
4. **Batch processing**: Render multiple videos in sequence
5. **Clean up**: Delete temporary files to save space

## Troubleshooting

### Chromium not found
```python
# Install Chromium
!apt-get install -y chromium-browser
os.environ['REMOTION_BROWSER_EXECUTABLE'] = '/usr/bin/chromium-browser'
```

### FFmpeg errors
```python
# Verify FFmpeg installation
!ffmpeg -version
!which ffmpeg
```

### Out of memory
- Reduce video resolution in render options
- Render shorter videos
- Clear Colab storage: `!rm -rf /content/tmp/*`

### Slow rendering
- Enable GPU in Colab settings
- Use lower quality settings (CRF 28 instead of 23)
- Reduce frame rate (24fps instead of 30fps)

## Next Steps

1. **Test locally first**: Make sure your video plan works locally before using Colab
2. **Optimize assets**: Compress images and audio files before uploading
3. **Monitor costs**: If using Colab Pro, monitor usage
4. **Automate**: Set up API endpoints for automated Colab rendering (advanced)

## Support

For issues or questions:
- Check the main project README.md
- Review Remotion documentation: https://www.remotion.dev/docs
- Google Colab docs: https://colab.research.google.com/notebooks/intro.ipynb

