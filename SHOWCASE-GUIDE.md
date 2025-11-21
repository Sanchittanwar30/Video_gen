# 🎬 Showcase Gallery Setup Guide

A simple system to create beautiful video showcases for your UI - just drop videos in a folder!

## Quick Start (3 Steps)

### 1️⃣ Add Videos to Showcase Folder

Copy your best MP4 videos to:
```bash
public/assets/showcase-videos/
```

**Example:**
```
public/assets/showcase-videos/
├── ai-storyboard-example.mp4
├── pen-sketch-demo.mp4
├── whiteboard-animation.mp4
├── tutorial-video.mp4
└── feature-showcase.mp4
```

### 2️⃣ Generate GIFs

Run the auto-generator:
```bash
node scripts/auto-generate-showcase.js
```

**What it does:**
- Finds all MP4 files in `showcase-videos/`
- Converts each to an optimized GIF (first 10 seconds)
- Creates thumbnails (for fast loading)
- Generates metadata JSON
- Saves everything to `public/assets/showcase/`

**Output:**
```
public/assets/showcase/
├── ai-storyboard-example.gif
├── ai-storyboard-example.jpg
├── pen-sketch-demo.gif
├── pen-sketch-demo.jpg
├── whiteboard-animation.gif
├── whiteboard-animation.jpg
└── showcase-metadata.json
```

### 3️⃣ View in UI

Start your app and check the homepage:
```bash
cd frontend
npm run dev
```

The gallery automatically loads all GIFs from the metadata! 🎉

## Features

### ✨ Automatic Title Generation
Filenames → Pretty titles:
- `ai-storyboard-demo.mp4` → "Ai Storyboard Demo"
- `pen_sketch_animation.mp4` → "Pen Sketch Animation"
- `my-feature-1763123456789.mp4` → "My Feature"

### 📦 Optimized GIFs
- **2-pass encoding** for best quality
- **Palette generation** for accurate colors
- **Smart sizing** (~500KB per 10s GIF)
- **Fast loading** with thumbnail previews

### 🎯 Smart Gallery
- **Click-to-play** - Loads GIF on demand
- **Responsive grid** - Adapts to any screen
- **Auto-updating** - Reads from metadata JSON
- **Professional styling** - Hover effects & animations

## Customization

### Change GIF Settings

Edit `scripts/auto-generate-showcase.js`:

```javascript
const CONFIG = {
  gif: {
    duration: 10,      // Length in seconds (1-30)
    fps: 18,           // Frames per second (12-25)
    width: 640,        // Width in pixels (480-1080)
    quality: 'medium', // 'high', 'medium', or 'small'
  },
};
```

**Quality Presets:**
- `high`: 720px @ 20fps (~1-2MB per 10s)
- `medium`: 640px @ 18fps (~500KB-1MB per 10s) ⭐ Recommended
- `small`: 480px @ 15fps (~300-500KB per 10s)

### Edit Gallery Layout

Edit `frontend/src/components/ShowcaseGallery.tsx`:

**Change grid columns:**
```tsx
gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))'
//                                            ↑ Card min-width
```

**Limit number of items:**
```tsx
{showcaseItems.slice(0, 5).map((item, index) => (
//                     ↑ Show only first 5
```

**Change card styling:**
```tsx
borderRadius: 'var(--radius-lg)',  // Corner radius
boxShadow: '0 10px 30px...',       // Shadow on hover
```

### Add Custom Descriptions

Instead of auto-generated descriptions, create a config file:

**Create `public/assets/showcase-videos/config.json`:**
```json
{
  "ai-storyboard-demo.mp4": {
    "name": "AI Video Generator",
    "description": "Create educational videos from any topic in minutes"
  },
  "pen-sketch-demo.mp4": {
    "name": "Whiteboard Animation",
    "description": "Hand-drawn style animations for engaging content"
  }
}
```

Then update the script to read from this config.

## Tips & Best Practices

### 📹 Video Selection

**Choose videos that:**
- Show your best features
- Are engaging in the first 10 seconds
- Have clear, visible action
- Represent different use cases

**Good examples:**
- Complete workflow demos
- Before/after transformations
- Feature highlights
- User interactions

### 🎨 Visual Quality

**For best results:**
- Use 1080p source videos
- Keep movement smooth
- Ensure good lighting/contrast
- Avoid very fast motion (causes blur in GIFs)

### 💾 File Size

**Target sizes:**
- **Ideal:** 500KB - 1MB per GIF
- **Maximum:** 2-3MB per GIF
- **Total gallery:** Under 10MB

**If GIFs are too large:**
1. Reduce `duration` (8s instead of 10s)
2. Reduce `fps` (15 instead of 18)
3. Reduce `width` (480px instead of 640px)
4. Use `quality: 'small'` preset

### 🚀 Performance

**Gallery loads fast because:**
- Thumbnails load first (tiny JPGs)
- GIFs only load on click
- Lazy loading enabled
- Optimized 2-pass encoding

## Golpo-Style Showcase

To create a minimal showcase like Golpo (just 2 videos):

### 1. Add Only 2 Videos
```
public/assets/showcase-videos/
├── example-1.mp4
└── example-2.mp4
```

### 2. Run Generator
```bash
node scripts/auto-generate-showcase.js
```

### 3. Gallery Auto-Adjusts
The gallery automatically centers and sizes itself for 2 items!

**Result:**
```
┌─────────────────────────────────────┐
│   Example 1        Example 2        │
│   [  GIF  ]        [  GIF  ]        │
│   Description      Description      │
└─────────────────────────────────────┘
```

Clean, centered, professional! ✨

## Troubleshooting

### "No video files found"
- Check that videos are in `public/assets/showcase-videos/`
- Ensure files have `.mp4` extension
- Try absolute path if needed

### GIFs look pixelated
- Increase `width` in CONFIG
- Increase `fps` to 20-25
- Use higher quality source videos

### Script fails
- Check FFmpeg is installed: `node_modules/ffmpeg-static/`
- Try running with system ffmpeg: `ffmpeg -version`
- Check disk space (GIFs need ~1-2MB each)

### Gallery not updating
- Clear browser cache (Ctrl+Shift+R)
- Check `showcase-metadata.json` exists
- Verify paths in metadata are correct

## Advanced: Auto-Update

Want the gallery to update automatically when you add videos?

### Option 1: Watch Script
Create `scripts/watch-showcase.js`:
```javascript
const chokidar = require('chokidar');
const { exec } = require('child_process');

const watcher = chokidar.watch('public/assets/showcase-videos/*.mp4');

watcher.on('add', () => {
  console.log('New video detected! Regenerating GIFs...');
  exec('node scripts/auto-generate-showcase.js');
});
```

Run: `node scripts/watch-showcase.js`

### Option 2: Pre-commit Hook
Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
if git diff --cached --name-only | grep "showcase-videos.*\.mp4"; then
  node scripts/auto-generate-showcase.js
  git add public/assets/showcase/
fi
```

## Examples

### 5-Video Gallery (Like Your Request)
```bash
# Add 5 videos
cp video1.mp4 public/assets/showcase-videos/ai-demo.mp4
cp video2.mp4 public/assets/showcase-videos/sketch-demo.mp4
cp video3.mp4 public/assets/showcase-videos/tutorial.mp4
cp video4.mp4 public/assets/showcase-videos/feature-a.mp4
cp video5.mp4 public/assets/showcase-videos/feature-b.mp4

# Generate
node scripts/auto-generate-showcase.js

# Result: Beautiful 5-card grid!
```

### 2-Video Gallery (Golpo Style)
```bash
# Add 2 videos
cp best-example1.mp4 public/assets/showcase-videos/
cp best-example2.mp4 public/assets/showcase-videos/

# Generate
node scripts/auto-generate-showcase.js

# Result: Centered 2-card layout!
```

## Summary

**To add showcase videos:**
1. Drop MP4s in `public/assets/showcase-videos/`
2. Run `node scripts/auto-generate-showcase.js`
3. Done! Gallery updates automatically 🎉

**Recommended settings:**
- 5-10 second clips
- 640px width
- 18 fps
- Medium quality

**Perfect for:**
- Product demos
- Feature showcases
- Tutorial previews
- Portfolio examples

Happy showcasing! 🌟

