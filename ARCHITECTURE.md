# AI Video Generation System Architecture

## Overview

This system provides an AI-powered video generation pipeline that creates educational whiteboard-style videos from a simple topic and description. The system uses Google Gemini for content generation, Deepgram for text-to-speech, and Remotion for video rendering with pen-sketch animations.

## Architecture Diagram

```
User Input (Topic + Description)
    ↓
Frontend (React/Vite)
    ↓
Backend API (Express/Node.js)
    ├─ POST /api/generate-video
    └─ WebSocket Server (Port 3001)
    ↓
AI Pipeline:
    ├─ 1. Structured Plan Generation (Gemini Text API)
    │  └─ Generates video plan with frames
    │
    ├─ 2. Per-Frame Processing:
    │  ├─ Voiceover Script (Gemini Text API)
    │  ├─ Image Generation (Gemini Image API)
    │  ├─ Image Vectorization (PNG → SVG)
    │  └─ Voiceover Audio (Deepgram TTS)
    │
    └─ 3. Video Rendering (Remotion)
       ├─ SVG Path Animation
       ├─ Subtitle Overlay
       └─ Audio Synchronization
    ↓
Final MP4 Video Output
```

## System Components

### 1. Frontend (`frontend/`)

**React + Vite application** that provides:
- User interface for video generation
- Real-time progress updates via WebSocket
- Video preview and playback

**Key Files:**
- `frontend/src/components/GenerateVideoDemo.tsx` - Main demo component
- `frontend/src/components/VideoForm.tsx` - Video generation form
- `frontend/src/api/generateVideoClient.ts` - API client with WebSocket support
- `frontend/vite.config.ts` - Vite configuration with proxy settings

**Features:**
- Form-based topic/description input
- Real-time progress tracking
- Video preview after generation
- WebSocket connection for live updates

### 2. Backend API (`server/`)

**Express.js REST API** that handles:
- AI video generation (`POST /api/generate-video`)
- Health checks (`GET /health`)
- Static asset serving

**Key Files:**
- `server/index.ts` - Main Express server setup
- `server/routes/generateVideo.ts` - AI video generation endpoint
- `server/routes/video.ts` - Alternative video generation route
- `server/websocket.ts` - WebSocket server for real-time updates

**API Endpoints:**
- `POST /api/generate-video` - Generate AI video from topic
  - Request: `{ topic: string, description?: string, animateDiagrams?: boolean }`
  - Response: `{ videoUrl: string, frames: [...] }`
- `GET /health` - Health check endpoint
- `WS /ws` - WebSocket connection for progress updates

### 3. AI Services

#### 3.1 Structured Plan Generation (`server/services/gemini-structured.ts`)

**Purpose**: Generates structured video plan from topic

**Key Functions:**
- `generateStructuredJSON()` - Creates video plan with frames
- `validatePlan()` - Validates generated plan structure

**Process:**
1. Calls Gemini Text API with structured prompt template
2. Generates 1-5 whiteboard diagram frames
3. Each frame includes: `id`, `type`, `prompt_for_image`, `heading`, `duration`
4. Validates and returns structured plan

**Output Format:**
```json
{
  "title": "Video Title",
  "frames": [
    {
      "id": "frame_1",
      "type": "whiteboard_diagram",
      "prompt_for_image": "...",
      "heading": "...",
      "duration": 4
    }
  ]
}
```

#### 3.2 Gemini Integration (`server/services/gemini.ts`)

**Purpose**: Handles all Gemini API interactions

**Key Functions:**
- `callGeminiText()` - Text generation (scripts, plans)
- `callGeminiImage()` - Image generation with retry logic

**Features:**
- Model fallback (imagen-4.0 → imagen-3.0)
- Retry logic for rate limits
- Error handling and logging
- Prompt sanitization

**Image Generation:**
- Enhanced prompts for pen-sketch animation
- Sanitization to remove metadata, Mermaid syntax, "visual_aid"
- Animation-friendly instructions (bold strokes, distinct paths)
- Fallback handling for RAI filtering

#### 3.3 Deepgram TTS (`server/services/deepgram.ts`)

**Purpose**: Generates voiceover audio from text

**Key Functions:**
- `synthesizeSpeech()` - Converts text to speech

**Features:**
- Female voice (aura-hera-en) for educational content
- Upbeat mode with SSML prosody tags
- Pitch adjustment without rate change
- Fallback models if primary fails
- MP3 output format

**Configuration:**
- Model: `aura-hera-en` (energetic female voice)
- SSML prosody: `pitch="+5%"` for upbeat tone
- Fallback models prioritized for female voices

#### 3.4 Image Vectorization (`server/services/imageVectorizer.ts`)

**Purpose**: Converts PNG images to SVG for animation

**Key Functions:**
- `vectorizeImageFromUrl()` - Downloads and vectorizes images

**Process:**
1. Downloads PNG image from URL
2. Converts to SVG using vectorization service
3. Extracts path elements for animation
4. Saves to `/public/assets/vectorized-*.svg`

**Features:**
- Path extraction for stroke-by-stroke animation
- ViewBox preservation
- Background detection
- Timeout handling (15 seconds)

### 4. Remotion Components (`remotion/src/`)

#### 4.1 Main Composition (`remotion/src/VideoFromAI.tsx`)

**Purpose**: Orchestrates entire video composition

**Key Features:**
- Creates sequences for each frame
- Manages transitions between frames
- Integrates voiceover, subtitles, and animations
- Handles frame timing and synchronization

**Structure:**
- Sequence per frame with proper timing
- Voiceover audio tracks
- Subtitle overlays
- Whiteboard animations

#### 4.2 SVG Animation (`remotion/src/WhiteboardAnimatorPrecise.tsx`)

**Purpose**: Animates SVG paths stroke-by-stroke

**Key Features:**
- Parses SVG path elements
- Schedules path drawing animations
- Supports drawing window animations
- Handles path complexity and timing

**Animation Process:**
1. Parse SVG and extract paths
2. Schedule paths for drawing
3. Animate each path stroke-by-stroke
4. Sync with voiceover timing

#### 4.3 Subtitle Overlay (`remotion/src/SubtitleOverlay.tsx`)

**Purpose**: Renders YouTube-style subtitles

**Key Features:**
- YouTube-style appearance (semi-transparent background)
- Word-by-word appearance
- Two-line rolling system
- Centered at bottom (35% from left)
- Syncs with voiceover audio

**Styling:**
- Semi-transparent dark background (rgba(0, 0, 0, 0.8))
- White text with shadow
- Roboto font family
- Smooth fade in/out transitions

### 5. Video Rendering (`server/services/remotion-ai-renderer.ts`)

**Purpose**: Renders final MP4 video using Remotion

**Key Functions:**
- `renderStoryboardVideo()` - Main rendering function

**Process:**
1. Creates Remotion composition from video plan
2. Renders each frame with animations
3. Combines audio, video, and subtitles
4. Outputs MP4 file to `/output/ai-storyboard-*.mp4`

**Configuration:**
- FPS: 30
- Resolution: 1920x1080
- Format: MP4 (H.264)

## Data Flow

### 1. Video Generation Request

```
User submits form (topic + description)
    ↓
Frontend → POST /api/generate-video
    ↓
Backend validates request
    ↓
Backend starts AI pipeline
    ↓
Backend returns 200 OK with video plan
    (or streams progress via WebSocket)
```

### 2. AI Pipeline Execution

```
Step 1: Generate Structured Plan
    ↓
Gemini Text API → Video Plan (frames[])
    ↓
For each frame:
    ├─ Generate Voiceover Script (Gemini Text)
    ├─ Generate Image (Gemini Image)
    ├─ Vectorize Image (if animateDiagrams=true)
    └─ Generate Audio (Deepgram TTS)
    ↓
Step 2: Render Video
    ↓
Remotion Composition
    ├─ Animate SVG paths (if vectorized)
    ├─ Display subtitles
    └─ Play voiceover audio
    ↓
Step 3: Output
    ↓
MP4 file saved to /output/
```

### 3. Real-Time Updates (WebSocket)

```
Client connects to WS /ws
    ↓
Server sends progress updates:
    - Plan generation: 10%
    - Image generation: 20-40%
    - Audio generation: 50-70%
    - Video rendering: 80-95%
    - Complete: 100%
    ↓
Client displays progress in UI
```

## File Structure

```
.
├── frontend/
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
├── server/
│   ├── index.ts                    # Express server
│   ├── routes/
│   │   ├── generateVideo.ts       # Main AI endpoint
│   │   └── video.ts               # Alternative endpoint
│   ├── services/
│   │   ├── gemini-structured.ts   # Plan generation
│   │   ├── gemini.ts              # Gemini API
│   │   ├── deepgram.ts            # TTS
│   │   ├── imageVectorizer.ts     # PNG → SVG
│   │   └── remotion-ai-renderer.ts # Video rendering
│   └── websocket.ts               # WebSocket server
│
├── remotion/
│   └── src/
│       ├── VideoFromAI.tsx        # Main composition
│       ├── WhiteboardAnimatorPrecise.tsx # SVG animation
│       └── SubtitleOverlay.tsx    # Subtitles
│
├── public/
│   └── assets/
│       ├── gemini-images/         # Generated images
│       ├── vectorized/            # SVG files
│       └── voiceovers/            # Audio files
│
└── output/
    └── ai-storyboard-*.mp4        # Final videos
```

## Environment Configuration

Required environment variables:

```bash
# Server
PORT=3000
NODE_ENV=development

# Gemini API
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
GEMINI_API_KEY=your-gemini-api-key

# Deepgram TTS
DEEPGRAM_API_KEY=your-deepgram-api-key
DEEPGRAM_TTS_MODEL=aura-hera-en

# Image Vectorization
VECTORIZER_API_URL=https://vectorizer-api-url
VECTORIZER_API_KEY=your-vectorizer-key

# Optional
USE_FIXED_TEST_IMAGE=false
ANIMATE_DIAGRAMS=true
```

## API Request/Response

### Request

```bash
POST /api/generate-video
Content-Type: application/json

{
  "topic": "Machine Learning Basics",
  "description": "Explain supervised and unsupervised learning",
  "animateDiagrams": true,
  "durationSeconds": 60
}
```

### Response

```json
{
  "videoUrl": "/output/ai-storyboard-1234567890.mp4",
  "title": "Machine Learning Basics",
  "frames": [
    {
      "id": "frame_1",
      "type": "whiteboard_diagram",
      "heading": "Introduction to Machine Learning",
      "asset": "/assets/gemini-images/gemini-image-xxx.png",
      "vectorizedAsset": "/assets/vectorized-xxx.svg",
      "voiceoverUrl": "/assets/voiceovers/voiceover-xxx.mp3",
      "voiceoverScript": "Machine learning is a subset of artificial intelligence...",
      "duration": 4
    }
  ]
}
```

## Error Handling

### API Errors
- **400 Bad Request**: Missing required fields (topic)
- **500 Internal Server Error**: AI generation failure, rendering failure
- **503 Service Unavailable**: Gemini API rate limits, service overloaded

### Retry Logic
- Gemini Image API: 3 attempts with fallback models
- Deepgram TTS: Multiple model fallbacks
- Image Vectorization: 15-second timeout

### Error Recovery
- Failed image generation: Falls back to imagen-3.0
- Failed voiceover: Continues without audio
- Failed vectorization: Uses static image instead of animation

## Performance Considerations

### Generation Time
- Plan generation: ~5-10 seconds
- Image generation: ~10-20 seconds per frame
- Audio generation: ~5-10 seconds per frame
- Vectorization: ~5-15 seconds per image
- Video rendering: ~30-60 seconds for 60-second video

**Total**: ~2-5 minutes for a typical 60-second video

### Optimization
- Parallel frame processing (where possible)
- Image caching
- Audio caching
- Incremental rendering

## Security Considerations

1. **API Keys**: Stored in environment variables, never committed
2. **Input Validation**: All user inputs validated and sanitized
3. **Rate Limiting**: Implemented for API endpoints
4. **File Uploads**: Validated file types and sizes
5. **CORS**: Configured for frontend origin only

## Future Enhancements

- [ ] Database for video history
- [ ] User authentication/authorization
- [ ] Batch video generation
- [ ] Custom voice selection
- [ ] Multiple language support
- [ ] Video editing capabilities
- [ ] Analytics dashboard
- [ ] CDN integration for faster delivery
- [ ] Preview generation (thumbnails)
- [ ] Video compression optimization
