# Creating Showcase GIFs for UI

This guide explains how to create optimized GIF demos from your videos to showcase on the UI.

## Quick Start

### 1. Generate GIFs from Videos

Run the showcase GIF generator:

```bash
node scripts/create-showcase-gifs.js
```

This will:
- Convert selected videos to optimized GIFs
- Create thumbnails for each GIF
- Generate metadata JSON
- Save everything to `public/assets/showcase/`

### 2. Customize Videos

Edit `scripts/create-showcase-gifs.js` to select which videos to convert:

```javascript
videos: [
  {
    input: 'output/ai-storyboard-1763711478607.mp4',  // Input video path
    output: 'public/assets/showcase/ai-storyboard-demo.gif',  // Output GIF path
    name: 'AI Storyboard',  // Display name
    description: 'Generate animated educational videos from any topic',
    startTime: '00:00:00',  // Start time (HH:MM:SS)
    duration: 10,  // Duration in seconds
    fps: 15,  // Frames per second (lower = smaller file)
    width: 640,  // Width in pixels
  },
  // Add more videos...
]
```

### 3. Optimization Tips

**For Smaller File Sizes:**
- Reduce `fps` (10-15 fps is usually enough)
- Reduce `width` (480-640px works well)
- Reduce `duration` (5-10 seconds is ideal)

**For Better Quality:**
- Increase `fps` (20-25 fps)
- Increase `width` (720-1080px)
- The script uses 2-pass encoding for optimal quality

**Typical File Sizes:**
- 10s @ 640px @ 15fps = ~2-5 MB
- 10s @ 640px @ 20fps = ~3-7 MB
- 10s @ 1080px @ 25fps = ~10-20 MB

## UI Integration

### ShowcaseGallery Component

The `ShowcaseGallery` component displays your GIFs with:
- Click-to-play functionality (shows thumbnail first)
- Smooth hover animations
- Responsive grid layout
- Feature highlights

### Customizing the Gallery

Edit `frontend/src/components/ShowcaseGallery.tsx`:

```tsx
const SHOWCASE_ITEMS: ShowcaseItem[] = [
  {
    name: 'Your Feature Name',
    description: 'Description of what this showcases',
    gif: '/assets/showcase/your-demo.gif',
    thumbnail: '/assets/showcase/your-demo.jpg',
  },
  // Add more items...
];
```

### Adding to Your App

The gallery is already integrated into `App.tsx` as a hero section. You can:

1. **Move it to a different page:**
```tsx
import ShowcaseGallery from './components/ShowcaseGallery';

function LandingPage() {
  return <ShowcaseGallery />;
}
```

2. **Add it to a modal/popup:**
```tsx
<Modal>
  <ShowcaseGallery />
</Modal>
```

3. **Create a dedicated examples page:**
```tsx
// ExamplesPage.tsx
export default function ExamplesPage() {
  return (
    <div>
      <h1>Examples</h1>
      <ShowcaseGallery />
    </div>
  );
}
```

## Advanced Usage

### Creating GIFs Programmatically

You can also create GIFs from Node.js:

```javascript
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

async function createGif(inputVideo, outputGif, options = {}) {
  const {
    startTime = '00:00:00',
    duration = 10,
    fps = 15,
    width = 640,
  } = options;

  const ffmpeg = 'ffmpeg'; // or path to ffmpeg-static
  const palette = outputGif.replace('.gif', '-palette.png');

  // Generate palette
  await execFileAsync(ffmpeg, [
    '-ss', startTime,
    '-t', duration.toString(),
    '-i', inputVideo,
    '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen`,
    '-y', palette
  ]);

  // Create GIF
  await execFileAsync(ffmpeg, [
    '-ss', startTime,
    '-t', duration.toString(),
    '-i', inputVideo,
    '-i', palette,
    '-lavfi', `fps=${fps},scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse`,
    '-y', outputGif
  ]);
}
```

### Batch Processing

To convert multiple videos at once, add them to the `videos` array in the script and run it once.

### Automatic GIF Generation

You can automatically generate GIFs when videos are created by adding a post-render hook:

```javascript
// In your video generation service
async function onVideoComplete(videoPath) {
  // Generate GIF automatically
  await createGif(videoPath, videoPath.replace('.mp4', '.gif'), {
    duration: 8,
    fps: 15,
    width: 640,
  });
}
```

## Troubleshooting

### GIFs are too large
- Reduce fps (10-12 fps)
- Reduce width (480px)
- Reduce duration (5-7 seconds)
- Use fewer colors in your videos

### GIFs are low quality
- Increase fps (20-25 fps)
- Increase width (720-1080px)
- Use 2-pass encoding (already enabled in script)
- Ensure source video is high quality

### FFmpeg not found
- Install ffmpeg-static: `npm install ffmpeg-static`
- Or install system ffmpeg: `brew install ffmpeg` (Mac) or `choco install ffmpeg` (Windows)

### Thumbnails not generating
- Check that the GIF was created successfully first
- Ensure FFmpeg is working properly
- Try running the thumbnail command manually

## Best Practices

1. **Keep GIFs short** (5-10 seconds) - long GIFs are huge
2. **Use thumbnails** - load GIF only when user clicks
3. **Optimize for web** - 640px width is plenty for most screens
4. **Choose good moments** - pick the most interesting parts of your videos
5. **Test file sizes** - aim for under 5MB per GIF
6. **Provide fallbacks** - have static images ready if GIFs fail to load

## Example Output Structure

```
public/assets/showcase/
├── ai-storyboard-demo.gif       # Optimized GIF
├── ai-storyboard-demo.jpg       # Thumbnail
├── pen-sketch-demo.gif          # Optimized GIF
├── pen-sketch-demo.jpg          # Thumbnail
└── showcase-metadata.json       # Metadata for all GIFs
```

## Next Steps

1. Run `node scripts/create-showcase-gifs.js`
2. Check `public/assets/showcase/` for your GIFs
3. Visit your app to see the showcase gallery
4. Customize the gallery styling and content as needed
5. Share your awesome demos! 🎉

