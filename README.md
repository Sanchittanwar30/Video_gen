# Remotion Video Generator

A production-ready, scalable video generation system built with Remotion v6+ that renders videos from JSON templates. Features a complete backend API, job queue system, cloud storage integration, and real-time notifications.

## 🏗️ System Architecture

```
Client → Backend API → Job Queue (BullMQ/Redis) → Worker → Remotion Render → Cloud Storage → Notification
```

- **REST API**: Express.js backend for job management
- **Job Queue**: BullMQ with Redis for scalable processing
- **Workers**: Background workers for video rendering
- **Storage**: Supabase (default, recommended) or local filesystem
- **Notifications**: WebSocket for real-time updates + Webhook support
- **Rendering**: Remotion-based template engine

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system documentation.

## Features

- **Template-based rendering**: Define video structure using JSON templates
- **Dynamic content**: Use placeholders (`{{placeholder}}`) to inject data from input files
- **Multiple track types**:
  - Background videos/images
  - Text with customizable styling
  - Images with positioning
  - Voiceover/audio tracks
- **Animations**: Fade-in and slide animations with configurable timing
- **Programmatic API**: Render videos from Node.js scripts
- **Validation**: Automatic placeholder validation before rendering

## Project Structure

```
.
├── src/
│   ├── compositions/
│   │   └── TemplateComposition.tsx  # Main template rendering component
│   ├── Root.tsx                     # Remotion root with composition registration
│   └── index.tsx                    # Entry point
├── render/
│   └── index.ts                     # Programmatic rendering function
├── templates/
│   └── promo-01.json                # Example template
├── inputs/
│   └── promo-01-input.json          # Example input data
├── scripts/
│   └── preview.ts                   # Preview script for testing
├── package.json
├── tsconfig.json
└── remotion.config.ts
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Redis (for job queue)
- npm or yarn

See [INSTALLATION.md](./INSTALLATION.md) for complete installation instructions.

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

### Development Mode

Open Remotion Studio to preview compositions:
```bash
npm run dev
```

### Render a Video

#### Method 1: Using the render script directly

```bash
# Using ts-node
ts-node render/index.ts templates/promo-01.json inputs/promo-01-input.json output/video.mp4

# With custom options
ts-node render/index.ts templates/promo-01.json inputs/promo-01-input.json output/video.mp4 30 1920 1080 300
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
- `volume`: Optional volume (0-1, default: 1)

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

**Note:** If you encounter FFmpeg errors on macOS, use the no-audio template:
```bash
ts-node render/index.ts templates/promo-01-no-audio.json inputs/promo-01-input.json output/promo.mp4
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
- Audio files should be in formats supported by Remotion (MP3, WAV, etc.)
- Frame-accurate timing ensures precise track positioning
- All styling uses inline styles for maximum control
- The composition is optimized for programmatic rendering

## Troubleshooting

**Error: "Missing required placeholders"**
- Ensure all `{{placeholder}}` values in your template have corresponding keys in the input JSON

**Error: "Failed to parse template file"**
- Check that your JSON is valid (use a JSON validator)

**Error: "Symbol not found: (_AVCaptureDeviceTypeDeskViewCamera)" or FFmpeg errors**
- This is a known macOS compatibility issue with Remotion's bundled FFmpeg
- The render script automatically filters out empty voiceover tracks, but Remotion still tries to create silent audio
- **Quick Fix - Use Low Resolution:**
  ```bash
  npm run render:low templates/promo-01-no-audio.json inputs/promo-01-input.json output/video.mp4
  ```
- **Other Workarounds:**
  1. **Manual low resolution**: `npm run render templates/promo-01-no-audio.json inputs/promo-01-input.json output/video.mp4 30 1280 720`
  2. **Update Remotion**: `npm update @remotion/renderer @remotion/bundler @remotion/cli remotion`
  3. **Use system FFmpeg**: Install via Homebrew (`brew install ffmpeg`) and set `FFMPEG_BINARY` environment variable
  4. **Use Docker**: Run Remotion in a Docker container to avoid macOS-specific issues
  5. **Remove voiceover track**: Edit template JSON and remove the voiceover track object entirely

**Video not rendering**
- Verify all asset URLs are accessible (test URLs in browser first)
- Use reliable image hosting services (Unsplash, Picsum, etc.) instead of placeholder services
- Check that file paths are correct (use absolute paths if needed)
- Ensure Remotion is properly bundled (`npm run build`)
- Empty audio/image sources are automatically skipped (won't cause errors)

## License

MIT

