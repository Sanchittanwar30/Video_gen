# 🎬 Video Generation Studio

**Transform your ideas into professional videos with AI-powered visuals and animations**

An advanced AI-powered platform that generates educational videos with automated storyboarding, image generation, voiceovers, whiteboard animations, and subtitle generation.

---

## 📋 Table of Contents

- [Features](#-features)
- [Demo](#-demo)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [Configuration](#-configuration)
- [Usage Guide](#-usage-guide)
- [API Documentation](#-api-documentation)
- [Components](#-components)
- [WebSocket Progress](#-websocket-progress)
- [Pen Sketch Animation](#-pen-sketch-animation)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### 🤖 AI Storyboard Generator
- **Automated Video Planning**: Generate complete video storyboards from simple topic descriptions
- **AI Image Generation**: Create custom visuals using Google Gemini AI
- **Voice Synthesis**: Generate natural-sounding voiceovers with Deepgram TTS
- **Subtitle Generation**: Automatic YouTube-style subtitle overlays
- **Real-time Progress**: WebSocket-powered live updates during generation
- **Voice Input**: Speech-to-text for hands-free description input

### 🎨 Showcase Gallery
- **Video Previews**: 2x2 responsive grid with play/pause controls
- **Fullscreen Mode**: Large video player with native controls
- **Skeleton Loading**: Smooth loading states with shimmer effects
- **Auto-pause**: Automatically pauses other videos when one plays
- **Download Support**: Direct download links for all videos

### 🖊️ Pen Sketch Animation (Beta)
- **Whiteboard Style**: Convert images to hand-drawn animations
- **Stroke-by-Stroke**: Progressive drawing effect with animated cursor
- **Two-Pass System**: Outlines first, then color fills
- **Top-to-Bottom**: Natural drawing progression
- **Noise Filtering**: Advanced edge detection with denoising

### 🎉 User Experience
- **Confetti Celebration**: Rewarding animation on video completion
- **Smooth Animations**: Fade-in, slide, scale effects throughout
- **Mobile Responsive**: Optimized for all screen sizes
- **Dark Mode Ready**: Modern, professional UI design
- **Real-time Feedback**: Progress indicators and status updates

---

## 🎥 Demo

### AI Storyboard Generation
```
Topic: "Quantum Entanglement Explained Simply"
Description: "Introduce the concept, walk through an example with two particles, 
             and conclude with why observation collapses the state."

Output: Professional educational video with:
├── AI-generated visuals
├── Natural voiceovers
├── Animated subtitles
└── Background music
```

### Showcase Gallery
- 4 example videos in a responsive grid
- Click-to-play with controls
- Fullscreen viewing mode
- Download functionality

---

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Axios** for API requests
- **WebSocket** for real-time updates
- **CSS Variables** for theming

### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **WebSocket Server** for progress updates
- **Remotion** for video rendering
- **FFmpeg** for video processing

### AI & Media Services
- **Google Gemini AI** - Text & image generation
- **Deepgram** - Text-to-speech synthesis
- **OpenCV (Python)** - Image processing for pen sketch
- **Potrace** - Vector tracing for animations

### Video Processing
- **Remotion** - React-based video rendering
- **FFmpeg** - Video encoding and manipulation
- **CairoSVG** - SVG to image conversion (optional)

---

## 🏗️ Architecture

```
video-generation-studio/
├── frontend/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── GenerateVideoDemo.tsx
│   │   │   ├── ShowcaseGallery.tsx
│   │   │   ├── VideoGenerationProgress.tsx
│   │   │   ├── Confetti.tsx
│   │   │   └── SkeletonLoader.tsx
│   │   ├── api/            # API client functions
│   │   ├── services/       # Service integrations
│   │   └── App.tsx         # Main app component
│   └── vite.config.ts      # Vite configuration
│
├── server/                  # Express backend
│   ├── routes/             # API endpoints
│   │   ├── generateVideo.ts  # Main video generation
│   │   ├── penSketch.ts      # Pen sketch animation
│   │   ├── vectorize.ts      # Image vectorization
│   │   └── colab.ts          # Colab integration
│   ├── services/           # Business logic
│   │   ├── gemini-structured.ts  # AI plan generation
│   │   ├── gemini.ts             # Gemini API wrapper
│   │   ├── deepgram.ts           # TTS synthesis
│   │   └── remotion-ai-renderer.ts  # Video rendering
│   ├── websocket.ts        # WebSocket server
│   └── index.ts            # Server entry point
│
├── remotion/                # Remotion video templates
│   ├── src/
│   │   ├── Root.tsx        # Remotion root
│   │   ├── AiStoryboard.tsx  # Main video template
│   │   └── SubtitleOverlay.tsx  # Subtitle component
│   └── remotion.config.ts  # Remotion configuration
│
├── scripts/                 # Utility scripts
│   ├── sketch_animate_whiteboard.py  # Pen sketch animation
│   └── auto-generate-showcase.js     # Showcase GIF generator
│
├── output/                  # Generated videos
├── public/                  # Static assets
│   └── assets/
│       ├── showcase/       # Showcase media files
│       └── showcase-videos/  # Showcase MP4s
│
└── docs/                    # Documentation
    ├── WEBSOCKET-PROGRESS.md
    ├── SHOWCASE-GUIDE.md
    └── README-PEN-SKETCH-SETUP.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **npm** or **yarn**
- **Python** 3.9+ (for pen sketch animation)
- **FFmpeg** installed globally
- **API Keys**:
  - Google Gemini API key
  - Deepgram API key

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/video-generation-studio.git
cd video-generation-studio
```

2. **Install Node dependencies**
```bash
npm install
```

3. **Install Python dependencies** (for pen sketch)
```bash
pip install -r requirements-pen-sketch.txt
# or use the setup script
./scripts/setup-pen-sketch.sh  # Linux/Mac
./scripts/setup-pen-sketch.bat  # Windows
```

4. **Install Remotion dependencies**
```bash
cd remotion
npm install
cd ..
```

5. **Install frontend dependencies**
```bash
cd frontend
npm install
cd ..
```

6. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your API keys:
```env
# AI Services
GEMINI_API_KEY=your_gemini_api_key_here
DEEPGRAM_API_KEY=your_deepgram_api_key_here

# Server Configuration
PORT=3000
WEBSOCKET_PORT=3001

# Paths
ASSETS_DIR=public/assets
OUTPUT_DIR=output

# Optional
DEFAULT_BACKGROUND_MUSIC=/assets/music/default-background.mp3
```

7. **Start the development servers**

**Terminal 1: Backend**
```bash
npm run dev
```

**Terminal 2: Frontend**
```bash
cd frontend
npm run dev
```

**Access the app**: `http://localhost:5173`

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | - | ✅ Yes |
| `DEEPGRAM_API_KEY` | Deepgram TTS API key | - | ✅ Yes |
| `PORT` | Backend server port | 3000 | No |
| `WEBSOCKET_PORT` | WebSocket server port | 3001 | No |
| `ASSETS_DIR` | Static assets directory | public/assets | No |
| `OUTPUT_DIR` | Video output directory | output | No |
| `DEFAULT_BACKGROUND_MUSIC` | Background music file | - | No |
| `FIXED_TEST_IMAGES` | Test images (dev only) | - | No |

### Vite Proxy Configuration

The frontend proxies API requests to the backend:

```typescript
// frontend/vite.config.ts
proxy: {
  '/api': { target: 'http://localhost:3000' },
  '/output': { target: 'http://localhost:3000' },
  '/assets': { target: 'http://localhost:3000' },
  '/ws': { target: 'ws://localhost:3001', ws: true }
}
```

---

## 📖 Usage Guide

### 1. Generate an AI Storyboard Video

#### Via UI:
1. Navigate to the AI Storyboard Generator section
2. Enter a **Topic** (e.g., "Photosynthesis Explained")
3. Add a **Description** (or use voice input 🎤)
4. Click **"Generate Storyboard"**
5. Watch real-time progress updates
6. 🎉 Confetti celebration when complete!
7. Video auto-plays and can be downloaded

#### Via API:
```bash
curl -X POST http://localhost:3000/api/generate-video \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Photosynthesis Explained",
    "description": "Start with sunlight, show energy conversion, and explain oxygen production."
  }'
```

**Response:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Photosynthesis Explained",
  "videoUrl": "/output/ai-storyboard-1234567890.mp4",
  "frames": [
    {
      "id": "frame_1",
      "type": "whiteboard_diagram",
      "heading": "Introduction to Photosynthesis",
      "duration": 5,
      "imageUrl": "/assets/gemini-images/...",
      "voiceoverUrl": "/assets/voiceovers/..."
    }
  ]
}
```

### 2. Create a Pen Sketch Animation

#### Via API:
```bash
curl -X POST http://localhost:3000/api/pen-sketch/animate \
  -F "images=@my-image.png" \
  -F "duration=8" \
  -F "frameRate=25" \
  -F "videoWidth=1920" \
  -F "videoHeight=1080"
```

**Response:**
```json
{
  "jobId": "pen-sketch-1234567890",
  "status": "completed",
  "videoUrl": "/output/pen-sketch/pen-sketch-1234567890.mp4"
}
```

### 3. Use the Showcase Gallery

The showcase gallery automatically displays videos from `public/assets/showcase-videos/`:

1. Add MP4 files to `public/assets/showcase-videos/`
2. Run the auto-generate script:
```bash
node scripts/auto-generate-showcase.js
```
3. Refresh the frontend - videos appear automatically!

**Generated assets:**
- GIFs for preview thumbnails
- JPG thumbnails
- `showcase-metadata.json` with video info

---

## 📡 API Documentation

### Video Generation

#### `POST /api/generate-video`

Generate a complete AI storyboard video.

**Request Body:**
```json
{
  "topic": "string (required)",
  "description": "string (optional)"
}
```

**Response:**
```json
{
  "jobId": "string",
  "title": "string",
  "videoUrl": "string",
  "frames": [
    {
      "id": "string",
      "type": "whiteboard_diagram|motion_scene",
      "heading": "string",
      "duration": "number",
      "imageUrl": "string",
      "voiceoverUrl": "string",
      "voiceoverScript": "string"
    }
  ]
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid request (missing topic)
- `500` - Server error

### Pen Sketch Animation

#### `POST /api/pen-sketch/animate`

Create a whiteboard-style animation from an image.

**Request (Multipart Form):**
```
images: File (required)
duration: number (default: 5)
frameRate: number (default: 25)
videoWidth: number (default: 1920)
videoHeight: number (default: 1080)
voiceover: File (optional)
```

**Response:**
```json
{
  "jobId": "string",
  "status": "completed|processing|failed",
  "videoUrl": "string",
  "message": "string"
}
```

### Health Check

#### `GET /health`

Check server status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-21T12:00:00.000Z",
  "service": "video-generation-api"
}
```

---

## 🧩 Components

### Frontend Components

#### `GenerateVideoDemo.tsx`
Main video generation interface with form inputs, voice recording, and progress display.

**Key Features:**
- Voice input with speech recognition
- Real-time form validation
- WebSocket progress integration
- Confetti celebration on completion
- Auto-scroll to video player

#### `ShowcaseGallery.tsx`
Responsive video gallery with playback controls.

**Key Features:**
- 2x2 grid (1 column on mobile)
- Skeleton loading states
- Play/pause/volume controls
- Fullscreen modal player
- Download functionality
- Auto-pause other videos

#### `VideoGenerationProgress.tsx`
Real-time progress indicator with WebSocket updates.

**Phases:**
- 🧠 **Planning** (0-20%) - AI creates video structure
- 🎨 **Generating Images** (20-70%) - Creating visuals
- 🎙️ **Creating Voiceover** (70-75%) - Generating audio
- 🎬 **Rendering Video** (75-100%) - Final compilation

#### `Confetti.tsx`
Celebration animation component.

**Features:**
- 50 animated particles
- Random colors and delays
- Falls from top to bottom with rotation
- Auto-disappears after duration

#### `SkeletonLoader.tsx`
Loading placeholder with shimmer effect.

**Features:**
- Matches gallery layout
- Smooth shimmer animation
- Responsive grid

### Backend Services

#### `gemini-structured.ts`
Generates structured JSON video plans using Gemini AI.

**Key Functions:**
- `generateStructuredJSON()` - Creates video storyboard
- Schema validation for frame types
- Spelling enhancement
- Error handling

#### `remotion-ai-renderer.ts`
Renders videos using Remotion.

**Key Functions:**
- `renderStoryboardVideo()` - Main rendering function
- Frame composition
- Audio merging
- Subtitle overlay

#### `websocket.ts`
WebSocket server for real-time updates.

**Key Functions:**
- `broadcast()` - Send to all clients
- Connection management
- Job subscription

---

## 📊 WebSocket Progress

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    jobId: 'your-job-id'
  }));
};
```

### Message Types

#### Progress Update
```json
{
  "type": "progress",
  "jobId": "string",
  "phase": "planning|images|voiceover|rendering",
  "percentage": 45,
  "message": "Processing frame 2 of 5...",
  "step": 2,
  "totalSteps": 5
}
```

#### Completion
```json
{
  "type": "complete",
  "jobId": "string",
  "videoUrl": "/output/video.mp4"
}
```

#### Error
```json
{
  "type": "error",
  "jobId": "string",
  "message": "Error description"
}
```

See [WEBSOCKET-PROGRESS.md](docs/WEBSOCKET-PROGRESS.md) for detailed documentation.

---

## 🖊️ Pen Sketch Animation

### How It Works

1. **Preprocessing**:
   - Non-local means denoising
   - Bilateral filtering
   - CLAHE contrast enhancement

2. **Outline Extraction**:
   - Canny edge detection (70/180 thresholds)
   - Morphological closing
   - Contour approximation

3. **Color Region Detection**:
   - Otsu thresholding
   - Contour detection
   - Area filtering (>100px²)

4. **Two-Pass Animation**:
   - **Pass 1**: Draw black outlines (top-to-bottom)
   - **Pass 2**: Fill color regions (top-to-bottom)
   - **Pass 3**: Hold complete image

5. **FFmpeg Encoding**:
   - H.264 codec
   - CRF 23 (good quality)
   - Fast preset

### Python Script

```bash
python sketch_animate_whiteboard.py \
  --input image.png \
  --output animation.mp4 \
  --duration 8 \
  --fps 25 \
  --width 1920 \
  --height 1080
```

See [README-PEN-SKETCH-SETUP.md](docs/README-PEN-SKETCH-SETUP.md) for setup instructions.

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Video not playing in UI

**Problem**: Video URL is relative, causing CORS issues.

**Solution**: 
- Ensure Vite proxy is configured for `/output`
- Restart frontend dev server after config changes
```bash
cd frontend
npm run dev
```

#### 2. WebSocket not connecting

**Problem**: WebSocket server not running on port 3001.

**Solution**:
- Check if backend server is running
- Verify `WEBSOCKET_PORT` in `.env`
- Check firewall/antivirus blocking port 3001

#### 3. Pen sketch animation fails

**Problem**: Python dependencies not installed.

**Solution**:
```bash
pip install opencv-python numpy pillow
# Windows users: ensure numpy>=2.0.0 for Python 3.14+
```

#### 4. FFmpeg not found

**Problem**: FFmpeg not in PATH or `node_modules`.

**Solution**:
- Install `ffmpeg-static`: `npm install ffmpeg-static`
- Or install FFmpeg globally:
  - **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html)
  - **Mac**: `brew install ffmpeg`
  - **Linux**: `sudo apt install ffmpeg`

#### 5. Gemini API quota exceeded

**Problem**: Too many API calls.

**Solution**:
- Use `FIXED_TEST_IMAGES` mode for development
- Implement caching for generated images
- Upgrade Gemini API plan

#### 6. Remotion rendering timeout

**Problem**: Video rendering takes too long.

**Solution**:
- Reduce video duration
- Decrease frame count
- Use faster Remotion codec settings
- Increase timeout in `remotion-ai-renderer.ts`

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**
```bash
git checkout -b feature/amazing-feature
```

3. **Make your changes**
4. **Test thoroughly**
```bash
npm run test  # Run tests
npm run lint  # Check code quality
```

5. **Commit with clear messages**
```bash
git commit -m "feat: Add amazing feature"
```

6. **Push and create a Pull Request**
```bash
git push origin feature/amazing-feature
```

### Code Style

- **TypeScript** for all new code
- **ESLint** for linting
- **Prettier** for formatting
- **Conventional Commits** for commit messages

### Areas to Contribute

- 🎨 **UI/UX improvements**
- 🐛 **Bug fixes**
- 📚 **Documentation**
- ✨ **New features**:
  - More animation styles
  - Additional AI models
  - Video templates
  - Export formats
- 🧪 **Tests**
- 🌐 **Internationalization**

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Google Gemini AI** for text and image generation
- **Deepgram** for text-to-speech synthesis
- **Remotion** for React-based video rendering
- **FFmpeg** for video processing
- **OpenCV** for image processing

---

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/yourusername/video-generation-studio/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/video-generation-studio/discussions)

---

## 🗺️ Roadmap

### v1.0 (Current)
- ✅ AI storyboard generation
- ✅ Pen sketch animation
- ✅ WebSocket progress updates
- ✅ Showcase gallery
- ✅ Mobile responsive UI

### v1.1 (Planned)
- [ ] Multiple video templates
- [ ] User accounts and video history
- [ ] Advanced editing interface
- [ ] Batch video generation
- [ ] Custom voiceover uploads

### v2.0 (Future)
- [ ] Real-time collaborative editing
- [ ] AI video translation
- [ ] Advanced animation presets
- [ ] Video effects library
- [ ] Cloud rendering support

---

## 🌟 Star History

If you find this project useful, please consider giving it a star! ⭐

---

**Built with ❤️ using React, Node.js, and AI**
