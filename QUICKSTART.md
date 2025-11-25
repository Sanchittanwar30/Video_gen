# ⚡ Quick Start Guide

Get up and running with Video Generation Studio in 5 minutes!

---

## 🎯 Prerequisites

Before you begin, make sure you have:

- ✅ **Node.js 18+** installed ([Download](https://nodejs.org/))
- ✅ **Python 3.9+** installed ([Download](https://www.python.org/))
- ✅ **Git** installed ([Download](https://git-scm.com/))
- ✅ **API Keys**:
  - [Google Gemini API](https://makersuite.google.com/app/apikey)
  - [Deepgram API](https://console.deepgram.com/)

---

## 🚀 Installation (5 Minutes)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/video-generation-studio.git
cd video-generation-studio
```

### 2. Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..

# Install Remotion dependencies
cd remotion
npm install
cd ..

# Install Python dependencies (for pen sketch)
pip install opencv-python numpy pillow
```

### 3. Configure Environment

Create `.env` file in the root directory:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
GEMINI_API_KEY=your_gemini_api_key_here
DEEPGRAM_API_KEY=your_deepgram_api_key_here
PORT=3000
WEBSOCKET_PORT=3001
```

**Get API Keys:**
- **Gemini**: Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
- **Deepgram**: Visit [Deepgram Console](https://console.deepgram.com/)

### 4. Start the Servers

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 5. Open the App

Navigate to: **http://localhost:5173** 🎉

---

## 🎬 Generate Your First Video

### Using the UI

1. **Enter a Topic**
   ```
   Topic: "How Does WiFi Work?"
   ```

2. **Add a Description** (or use voice input 🎤)
   ```
   Description: "Explain radio waves, routers, and how data 
   is transmitted wirelessly. Include a simple diagram."
   ```

3. **Click "Generate Storyboard"**
   
4. **Watch the Progress**
   - 🧠 Planning (0-20%)
   - 🎨 Generating Images (20-70%)
   - 🎙️ Creating Voiceover (70-75%)
   - 🎬 Rendering Video (75-100%)

5. **Celebrate!** 🎉
   - Confetti animation appears
   - Video auto-plays
   - Download or share

**⏱️ Time**: ~2-3 minutes

---

## 🎨 Try the Showcase Gallery

The showcase gallery displays example videos automatically!

### View Examples

1. Scroll to the top of the page
2. Click any video thumbnail
3. Use play/pause controls
4. Click the fullscreen icon for large view
5. Download videos directly

### Add Your Own Videos

1. Add MP4 files to: `public/assets/showcase-videos/`

2. Generate showcase assets:
```bash
node scripts/auto-generate-showcase.js
```

3. Refresh the page - your videos appear! ✨

---

## 🖊️ Create a Pen Sketch Animation

### Using the API

```bash
curl -X POST http://localhost:3000/api/pen-sketch/animate \
  -F "images=@your-image.png" \
  -F "duration=8"
```

**Result**: Hand-drawn whiteboard animation! 🎨

---

## 🎤 Voice Input

1. Click the microphone icon 🎤
2. Speak your video description
3. The text appears automatically
4. Click again to stop recording

**Supported Browsers**: Chrome, Edge, Safari

---

## 📊 Real-Time Progress

The progress UI shows:

- **Current phase** with animated icon
- **Percentage complete**
- **Step counter** (e.g., "Step 2 of 5")
- **Connection status** (green dot = live)
- **Phase timeline** with checkmarks

No need to refresh - updates happen automatically via WebSocket! ⚡

---

## 🎉 Features at a Glance

### ✨ What You Can Do:

| Feature | Description | Time |
|---------|-------------|------|
| **Generate Videos** | AI creates complete educational videos | 2-3 min |
| **Voice Input** | Speak your description instead of typing | Instant |
| **Real-time Progress** | Watch generation happen live | Real-time |
| **Pen Sketch** | Convert images to hand-drawn animations | 30-60 sec |
| **Showcase Gallery** | View and download example videos | Instant |
| **Download Videos** | Save videos locally | Instant |

---

## 🔧 Troubleshooting

### Video Not Playing?

**Solution**: Restart the frontend server
```bash
cd frontend
npm run dev
```

The Vite proxy needs to be active for video playback.

### WebSocket Not Connecting?

**Check**:
1. Backend server is running on port 3000
2. WebSocket server is running on port 3001
3. Check browser console for errors

**Restart servers**:
```bash
# Kill all Node processes
pkill -f node  # Linux/Mac
taskkill /F /IM node.exe  # Windows

# Restart
npm run dev
```

### Python Dependencies Error?

**Install again**:
```bash
pip install opencv-python numpy pillow --upgrade
```

**Windows Python 3.14+**: Requires NumPy 2.0+
```bash
pip install "numpy>=2.0.0"
```

### FFmpeg Not Found?

**Install FFmpeg**:
- **Mac**: `brew install ffmpeg`
- **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html)
- **Linux**: `sudo apt install ffmpeg`

Or install via npm:
```bash
npm install ffmpeg-static
```

### API Key Errors?

**Verify**:
1. API keys are in `.env` file
2. No spaces or quotes around keys
3. Keys are valid (test in API console)

**Example `.env`**:
```env
GEMINI_API_KEY=AIzaSyAbc123def456...
DEEPGRAM_API_KEY=abc123def456...
```

---

## 📚 Next Steps

### Learn More

- **Full Documentation**: [README.md](README.md)
- **API Reference**: [API.md](API.md)
- **WebSocket Guide**: [docs/WEBSOCKET-PROGRESS.md](docs/WEBSOCKET-PROGRESS.md)
- **Contributing**: [CONTRIBUTING.md](CONTRIBUTING.md)

### Explore Features

1. **Try voice input** for hands-free operation
2. **Generate multiple videos** on different topics
3. **Add your videos** to the showcase gallery
4. **Experiment with pen sketch** animations
5. **Check WebSocket events** in browser console

### Customize

- Change video resolution
- Adjust animation duration  
- Add background music
- Customize UI theme
- Add your own video templates

---

## 🎓 Example Topics to Try

### Educational
- "How Does Photosynthesis Work?"
- "Explain the Water Cycle Simply"
- "What is Machine Learning?"
- "The Solar System for Kids"

### Technical
- "How Does Git Version Control Work?"
- "Explain REST APIs in 2 Minutes"
- "What is Blockchain Technology?"
- "Introduction to Quantum Computing"

### Science
- "What Causes Earthquakes?"
- "How Do Vaccines Work?"
- "The Greenhouse Effect Explained"
- "What is DNA?"

---

## 💡 Pro Tips

### 1. Better Descriptions = Better Videos

```
❌ Bad: "Explain WiFi"

✅ Good: "Explain WiFi starting with radio waves, show how 
routers work, and demonstrate data transmission with a simple 
diagram. End with common WiFi standards like 2.4GHz vs 5GHz."
```

### 2. Use Voice Input for Long Descriptions

Click 🎤 and speak naturally - it's faster than typing!

### 3. Keep Videos Focused

Best results: **1-2 minutes** (3-5 frames)  
Each frame: **5-8 seconds**

### 4. Download Your Favorites

Videos are stored in `output/` but may be cleaned up.  
**Download important videos** to keep them permanently.

### 5. Check Console for Debugging

Press **F12** → Console tab to see detailed logs:
- API responses
- WebSocket events
- Progress updates
- Error messages

---

## 🆘 Need Help?

- **Issues**: [GitHub Issues](https://github.com/yourusername/video-generation-studio/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/video-generation-studio/discussions)
- **Documentation**: [README.md](README.md)

---

## ✅ Quick Checklist

Before asking for help, verify:

- [ ] Node.js 18+ installed (`node --version`)
- [ ] Python 3.9+ installed (`python --version`)
- [ ] API keys in `.env` file
- [ ] Backend server running (port 3000)
- [ ] Frontend server running (port 5173)
- [ ] No console errors (F12)
- [ ] FFmpeg installed (`ffmpeg -version`)
- [ ] Python dependencies installed (`pip list`)

---

**Ready to create amazing videos!** 🚀🎬✨

Got your first video generated? Share it and tag us! 🎉

