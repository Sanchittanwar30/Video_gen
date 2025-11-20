# AI Video Generation System

An AI-powered video generation system that creates educational whiteboard-style videos from a simple topic and description. Built with Google Gemini for content generation, Deepgram for text-to-speech, and Remotion for video rendering with pen-sketch animations.

## 🏗️ System Architecture

```
User Input (Topic + Description)
    ↓
Frontend (React/Vite) → Backend API (Express)
    ↓
AI Pipeline:
    ├─ Gemini Text API (Plan Generation)
    ├─ Gemini Image API (Diagram Generation)
    ├─ Deepgram TTS (Voiceover)
    ├─ Image Vectorization (PNG → SVG)
    └─ Remotion (Video Rendering)
    ↓
Final MP4 Video
```

- **AI-Powered**: Uses Google Gemini for content and image generation
- **Text-to-Speech**: Deepgram TTS with female upbeat voice
- **Pen-Sketch Animation**: SVG path animation for whiteboard diagrams
- **YouTube-Style Subtitles**: Word-by-word appearance with two-line rolling
- **Real-Time Updates**: WebSocket for progress tracking
- **Rendering**: Remotion-based video composition

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system documentation.

## Features

- **AI Content Generation**: Automatically generates video plans from topic
- **Whiteboard Diagrams**: AI-generated educational diagrams optimized for animation
- **Pen-Sketch Animation**: SVG paths animated stroke-by-stroke
- **Voiceover**: AI-generated voiceover with upbeat female voice
- **Subtitles**: YouTube-style subtitles with word-by-word appearance
- **Image Vectorization**: Converts PNG diagrams to SVG for smooth animation
- **Real-Time Progress**: WebSocket updates during generation
- **Simple API**: Just provide topic and description, get a complete video

## Project Structure

```
.
├── frontend/                        # React frontend application
│   ├── src/
│   │   ├── components/
│   │   │   ├── GenerateVideoDemo.tsx
│   │   │   └── VideoForm.tsx
│   │   ├── api/
│   │   │   └── generateVideoClient.ts
│   │   └── services/
│   │       └── api.ts
│   └── vite.config.ts
│
├── server/                          # Express backend API
│   ├── index.ts                     # Main server
│   ├── routes/
│   │   ├── generateVideo.ts         # AI video generation endpoint
│   │   └── video.ts                 # Alternative endpoint
│   ├── services/
│   │   ├── gemini-structured.ts     # Plan generation
│   │   ├── gemini.ts                # Gemini API integration
│   │   ├── deepgram.ts              # Text-to-speech
│   │   ├── imageVectorizer.ts       # PNG → SVG conversion
│   │   └── remotion-ai-renderer.ts # Video rendering
│   └── websocket.ts                 # WebSocket server
│
├── remotion/                        # Remotion video components
│   └── src/
│       ├── VideoFromAI.tsx          # Main composition
│       ├── WhiteboardAnimatorPrecise.tsx # SVG animation
│       └── SubtitleOverlay.tsx      # Subtitles
│
├── public/
│   └── assets/
│       ├── gemini-images/           # Generated images
│       ├── vectorized/               # SVG files
│       └── voiceovers/               # Audio files
│
├── output/                          # Final video output
│   └── ai-storyboard-*.mp4
│
├── package.json
├── tsconfig.json
└── remotion.config.ts
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- Google Cloud service account (for Gemini API)
- Deepgram API key (for TTS)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp env.example .env
# Edit .env with your configuration (Redis, Supabase, Gemini API key)
```

   See [ENV_SETUP.md](./ENV_SETUP.md) for detailed environment variable configuration guide.

3. Start Redis:
```bash
# macOS
brew install redis
brew services start redis

# Linux
sudo apt-get install redis-server
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis:7-alpine
```

4. Start the system:
```bash
# Terminal 1: Start API server
npm run dev:api

# Terminal 2: Start worker
npm run dev:worker

# Terminal 3: Start frontend (optional)
npm run dev:frontend
```

5. Test the API:
```bash
curl http://localhost:3000/health
```

### Docker Deployment

```bash
docker-compose up -d
```

## Usage

### Generate a Video via API

```bash
curl -X POST http://localhost:3000/api/generate-video \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Machine Learning Basics",
    "description": "Explain supervised and unsupervised learning",
    "animateDiagrams": true,
    "durationSeconds": 60
  }'
```

### Generate a Video via Frontend

1. Start the frontend: `npm run dev:frontend`
2. Open http://localhost:5173
3. Fill in the form with topic and description
4. Click "Generate Lesson Video"
5. Watch progress in real-time via WebSocket
6. Preview the generated video when complete

## AI Storyboard Pipeline

The `/api/generate-video` endpoint orchestrates a complete AI-powered video generation workflow from topic to final video.

### Complete Workflow

```
User Input (Topic + Description)
    ↓
1. Structured Plan Generation (Gemini Text API)
    ├─ server/services/gemini-structured.ts
    └─ Generates: frames[], title, durations
    ↓
2. For Each Frame:
    ├─ Voiceover Script Generation (Gemini Text API)
    │  └─ server/routes/generateVideo.ts (generateVoiceoverScript)
    │
    ├─ Image Generation (Gemini Image API)
    │  ├─ server/services/gemini.ts (callGeminiImage)
    │  ├─ Enhanced prompts for pen-sketch animation
    │  └─ Output: PNG images → /public/assets/gemini-images/
    │
    ├─ Image Vectorization (Optional, if animateDiagrams=true)
    │  ├─ server/services/imageVectorizer.ts
    │  └─ Converts PNG → SVG with path extraction
    │
    └─ Voiceover Audio Generation (Deepgram TTS)
       ├─ server/services/deepgram.ts (synthesizeSpeech)
       └─ Output: MP3 audio files
    ↓
3. Video Plan Assembly
    └─ Combines all frames with assets, scripts, audio
    ↓
4. Remotion Rendering
    ├─ remotion/src/VideoFromAI.tsx (Main composition)
    ├─ remotion/src/WhiteboardAnimatorPrecise.tsx (SVG animation)
    ├─ remotion/src/SubtitleOverlay.tsx (YouTube-style subtitles)
    └─ server/services/remotion-ai-renderer.ts
    ↓
5. Final Video Output
    └─ MP4 file → /output/ai-storyboard-*.mp4
```

### Detailed Pipeline Steps

#### Step 1: Structured Plan Generation
- **File**: `server/services/gemini-structured.ts`
- **Function**: `generateStructuredJSON()`
- **Input**: Topic, description
- **Output**: JSON plan with frames (whiteboard_diagram types)
- **Process**: 
  - Calls Gemini Text API with structured prompt template
  - Validates and returns video plan with 1-5 frames
  - Each frame includes: `id`, `type`, `prompt_for_image`, `heading`, `duration`

#### Step 2: Frame Processing (Per Frame)

**2a. Voiceover Script Generation**
- **File**: `server/routes/generateVideo.ts`
- **Function**: `generateVoiceoverScript()`
- **Input**: Frame context, topic, image description
- **Output**: 2-3 sentence educational script (10-15 seconds)
- **Process**: Generates script that references visual elements in the diagram

**2b. Image Generation**
- **File**: `server/services/gemini.ts`
- **Function**: `callGeminiImage()`
- **Input**: Enhanced prompt (sanitized, with animation-friendly instructions)
- **Output**: PNG image saved to `/public/assets/gemini-images/`
- **Key Features**:
  - Sanitization removes "visual_aid", Mermaid syntax, metadata
  - Prompts optimized for pen-sketch animation (bold strokes, distinct paths)
  - Fallback to imagen-3.0 if imagen-4.0 fails (RAI filtering)
  - Retry logic with multiple model attempts

**2c. Image Vectorization** (if `animateDiagrams=true`)
- **File**: `server/services/imageVectorizer.ts`
- **Function**: `vectorizeImageFromUrl()`
- **Input**: PNG image URL
- **Output**: SVG file with extracted paths
- **Process**:
  - Downloads PNG image
  - Converts to SVG using vectorization service
  - Extracts path elements for animation
  - Saves to `/public/assets/vectorized-*.svg`

**2d. Voiceover Audio Generation**
- **File**: `server/services/deepgram.ts`
- **Function**: `synthesizeSpeech()`
- **Input**: Voiceover script text
- **Output**: MP3 audio buffer
- **Features**:
  - Female voice (aura-hera-en) for upbeat educational content
  - SSML prosody tags for pitch adjustment (upbeat tone)
  - Fallback models if primary fails
  - Saves to `/public/assets/voiceovers/`

#### Step 3: Video Rendering
- **File**: `server/services/remotion-ai-renderer.ts`
- **Function**: `renderStoryboardVideo()`
- **Input**: Video plan with all assets
- **Output**: MP4 video file
- **Components Used**:
  - `remotion/src/VideoFromAI.tsx` - Main composition orchestrator
  - `remotion/src/WhiteboardAnimatorPrecise.tsx` - SVG path animation
  - `remotion/src/SubtitleOverlay.tsx` - YouTube-style subtitles
- **Process**:
  - Creates Remotion sequences for each frame
  - Animates SVG paths stroke-by-stroke (if vectorized)
  - Syncs subtitles with voiceover audio
  - Renders final MP4 using Remotion renderer

### Important Files

#### Backend API & Routes
- **`server/routes/generateVideo.ts`** - Main API endpoint for `/api/generate-video`
  - Handles request validation
  - Orchestrates entire pipeline
  - Manages frame processing loop
  - Generates voiceover scripts
  - Sanitizes image prompts

#### AI Services
- **`server/services/gemini-structured.ts`** - Structured plan generation
  - `generateStructuredJSON()` - Creates video plan from topic
  - `PROMPT_TEMPLATE` - Template for Gemini to generate frames
  
- **`server/services/gemini.ts`** - Gemini API integration
  - `callGeminiText()` - Text generation (scripts, plans)
  - `callGeminiImage()` - Image generation with retry logic
  - Model fallback handling (imagen-4.0 → imagen-3.0)

- **`server/services/deepgram.ts`** - Text-to-Speech
  - `synthesizeSpeech()` - Generates voiceover audio
  - Upbeat mode with SSML prosody tags
  - Female voice selection for educational content

#### Image Processing
- **`server/services/imageVectorizer.ts`** - PNG to SVG conversion
  - `vectorizeImageFromUrl()` - Downloads and vectorizes images
  - Extracts SVG paths for animation
  - Handles timeout and error cases

#### Remotion Components
- **`remotion/src/VideoFromAI.tsx`** - Main video composition
  - Orchestrates all frames and sequences
  - Manages transitions between frames
  - Integrates voiceover, subtitles, and animations

- **`remotion/src/WhiteboardAnimatorPrecise.tsx`** - SVG animation engine
  - Parses SVG paths
  - Animates paths stroke-by-stroke
  - Handles path scheduling and timing
  - Supports drawing window animations

- **`remotion/src/SubtitleOverlay.tsx`** - Subtitle rendering
  - YouTube-style subtitles (semi-transparent background)
  - Word-by-word appearance
  - Two-line rolling system
  - Centered at bottom (35% from left)
  - Syncs with voiceover audio

#### Frontend
- **`frontend/src/components/GenerateVideoDemo.tsx`** - Demo UI component
  - Form for topic/description input
  - Calls `/api/generate-video` endpoint
  - Displays generated frames and preview

- **`frontend/src/api/generateVideoClient.ts`** - API client
  - Axios wrapper for video generation
  - Handles WebSocket connections for progress

### Configuration Files
- **`server/index.ts`** - Express server setup
- **`remotion.config.ts`** - Remotion configuration
- **`vite.config.ts`** - Frontend Vite config with proxy settings
- **`.env`** - Environment variables (API keys, paths)

### Try It Locally

```bash
curl -X POST http://localhost:3000/api/generate-video \
  -H "Content-Type: application/json" \
  -d '{"topic":"Quantum Entanglement","description":"Explain how observation collapses the shared state."}'
```

The frontend includes a demo form (see "AI Storyboard Demo") that calls this endpoint and lists the generated frames and assets.

### Render a Video

#### Method 1: Using the render script directly

```bash
# Using ts-node
ts-node render/index.ts templates/promo-01.json inputs/promo-01-input.json output/video.mp4

# With custom options
ts-node render/index.ts templates/promo-01.json inputs/promo-01-input.json output/video.mp4 30 1920 1080 300

# Educational sample (text-to-video)
ts-node render/index.ts templates/education.json inputs/education-sample.json output/education.mp4 30 1920 1080 600
```

#### Method 2: Using the programmatic API

```typescript
import {renderTemplateToMp4} from './render/index';

await renderTemplateToMp4({
  templatePath: 'templates/promo-01.json',
  inputPath: 'inputs/promo-01-input.json',
  outPath: 'output/video.mp4',
  fps: 30,
  width: 1920,
  height: 1080,
  duration: 300
});
```

### Preview Script

Render a low-resolution preview for testing:
```bash
npm run preview
```

This will create a 360p video at `output/preview-360p.mp4`.

## Template Format

Templates are JSON files that define the video structure:

```json
{
  "timeline": {
    "duration": 300,  // Total frames
    "fps": 30         // Optional, defaults to 30
  },
  "tracks": [
    {
      "type": "background",
      "src": "{{backgroundImage}}",
      "startFrame": 0,
      "endFrame": 300,
      "style": {
        "objectFit": "cover"
      }
    },
    {
      "type": "text",
      "content": "{{title}}",
      "style": {
        "fontSize": 72,
        "color": "#ffffff",
        "textAlign": "center",
        "x": 960,
        "y": 300
      },
      "animation": {
        "type": "fade-in",
        "duration": 1.0,
        "delay": 0.5
      },
      "startFrame": 30,
      "endFrame": 150
    }
  ]
}
```

Key notes:
- `background.src` accepts HTTPS image/video URLs, `data:` URIs, solid colors (for example, `#0ea5e9`), or CSS gradients (for example, `linear-gradient(135deg, #1f2937 0%, #312e81 100%)`).
- `style` mirrors CSS properties such as `fontSize`, `color`, `x`/`y` positions, `anchor` (`"center"` or `"top-left"`), `padding`, `borderRadius`, and more.

### Track Types

#### Background Track
- `type`: `"background"`
- `src`: Image or video URL (supports placeholders)
- `startFrame`: Frame when track starts
- `endFrame`: Frame when track ends
- `style.objectFit`: `"contain"`, `"cover"`, or `"fill"`

#### Text Track
- `type`: `"text"`
- `content`: Text content (supports placeholders)
- `style`: Font size, family, color, position, alignment
- `animation`: Optional animation configuration
- `startFrame` / `endFrame`: Frame range

#### Image Track
- `type`: `"image"`
- `src`: Image URL (supports placeholders)
- `style`: Position (x, y), dimensions (width, height), objectFit
- `animation`: Optional animation configuration
- `startFrame` / `endFrame`: Frame range

#### Voiceover Track
- `type`: `"voiceover"`
- `src`: Audio URL (supports placeholders)
- `startFrame` / `endFrame`: Frame range
- `volume`: Optional gain (0–1, default: 1.0)

### Animations

Available animation types:
- `fade-in`: Fades in from opacity 0 to 1
- `slide`: Slides in from a direction

Animation properties:
- `type`: `"fade-in"` or `"slide"`
- `duration`: Duration in seconds
- `delay`: Delay before animation starts (seconds)
- `from`: For slide animations: `"left"`, `"right"`, `"top"`, or `"bottom"`

## Input Format

Input files provide values for placeholders:

```json
{
  "title": "Welcome to Our Platform",
  "subtitle": "Transform your workflow",
  "backgroundImage": "https://example.com/bg.jpg",
  "logoImage": "https://example.com/logo.png",
  "voiceoverAudio": "https://example.com/audio.mp3"
}
```

All placeholders in the template must be present in the input file, or the render will fail with a validation error.

## API Reference

### `renderTemplateToMp4(options)`

Renders a template to an MP4 file.

**Parameters:**
- `templatePath` (string): Path to template JSON file
- `inputPath` (string): Path to input JSON file
- `outPath` (string): Output MP4 file path
- `fps` (number, optional): Frames per second (default: 30)
- `width` (number, optional): Video width in pixels (default: 1920)
- `height` (number, optional): Video height in pixels (default: 1080)
- `duration` (number, optional): Duration in frames (default: from template)

**Returns:** Promise that resolves when rendering is complete

**Throws:** Error if template/input files are invalid or placeholders are missing

## Examples

### Example 1: Basic Render

```bash
npm install
npm run build
ts-node render/index.ts templates/promo-01.json inputs/promo-01-input.json output/promo.mp4
```

### Example 2: Custom Resolution

```bash
ts-node render/index.ts templates/promo-01.json inputs/promo-01-input.json output/promo-720p.mp4 30 1280 720
```

### Example 3: Programmatic Usage

```typescript
import {renderTemplateToMp4} from './render/index';
import * as path from 'path';

async function generateVideo() {
  await renderTemplateToMp4({
    templatePath: path.join(__dirname, 'templates/promo-01.json'),
    inputPath: path.join(__dirname, 'inputs/promo-01-input.json'),
    outPath: path.join(__dirname, 'output/generated.mp4'),
    fps: 30,
    width: 1920,
    height: 1080,
  });
  
  console.log('Video generated successfully!');
}

generateVideo().catch(console.error);
```

## Validation

The render script validates:
- Template and input files exist and are valid JSON
- All placeholders in the template have corresponding values in the input
- Helpful error messages for missing placeholders

## Notes

- Video and image URLs can be local paths or remote URLs
- Voiceover audio URLs are supported (MP3, WAV, M4A); remote assets are downloaded and cached per job
- Frame-accurate timing ensures precise track positioning
- All styling uses inline styles for maximum control
- The composition ships with transcript support—pass a transcript string when queuing a job to have it uploaded alongside the rendered video

## Troubleshooting

**Error: "Missing required placeholders"**
- Ensure all `{{placeholder}}` values in your template have corresponding keys in the input JSON

**Error: "Failed to parse template file"**
- Check that your JSON is valid (use a JSON validator)

**Error: "Symbol not found: (_AVCaptureDeviceTypeDeskViewCamera)" or FFmpeg errors**
- This is a known macOS compatibility issue with Remotion's bundled FFmpeg (even when rendering video-only)
- **Primary Workarounds (in order):**
  1. **Upgrade Remotion binaries:** `npm update @remotion/renderer @remotion/bundler @remotion/cli remotion`
  2. **Point Remotion to system FFmpeg:** install FFmpeg via Homebrew and set `FFMPEG_BINARY` / `FFPROBE_BINARY`
  3. **Strip silent-audio arguments (dev quick-fix):** set `STRIP_AVFOUNDATION_ARGS=true` when running the worker/API to remove `-f lavfi -i anullsrc=...` from Remotion's FFmpeg command (uses `ffmpegOverride`, handy when testing locally without audio)
  4. **Render inside Docker/Linux:** run the worker in a Linux container or remote environment

**Video not rendering**
- Verify all asset URLs are accessible (test URLs in browser first)
- Use reliable image hosting services (Unsplash, Picsum, etc.) instead of placeholder services
- Check that file paths are correct (use absolute paths if needed)
- Ensure Remotion is properly bundled (`npm run build`)
- Empty audio/image sources are automatically skipped (won't cause errors)
- Provide valid HTTPS audio URLs for voiceover tracks; if audio fails to download the track is removed before rendering

## License

MIT

