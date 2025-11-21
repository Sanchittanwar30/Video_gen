# WebSocket Progress UI for Video Generation

Real-time progress updates for AI storyboard video generation, keeping users engaged without overwhelming them with technical details.

## Features

### 🎯 User-Friendly Progress Tracking

**4 Simple Phases:**
1. **🧠 Planning** (0-20%) - AI creates video structure
2. **🎨 Generating Images** (20-70%) - Creating visuals
3. **🎙️ Creating Voiceover** (70-75%) - Generating audio
4. **🎬 Rendering Video** (75-100%) - Final video compilation

### ✨ Visual Engagement

- **Animated icons** - Pulsing phase icons
- **Smooth progress bar** - With shine animation
- **Phase timeline** - Visual roadmap of progress
- **Real-time percentage** - Current completion status
- **Step counter** - "Step 2 of 5" for frame processing

### 🔌 WebSocket Integration

- **Real-time updates** - No polling required
- **Auto-reconnect** - Handles connection issues
- **Multiple listeners** - Supports multiple clients
- **Broadcast** - All connected clients get updates

## How It Works

### Backend Progress Tracking

The video generation route sends progress updates at key stages:

```typescript
// server/routes/generateVideo.ts

// 1. Planning phase (5-20%)
sendProgress(jobId, 'planning', 5, 'Starting...');
sendProgress(jobId, 'planning', 20, 'Plan created!');

// 2. Images phase (25-70%)
sendProgress(jobId, 'images', 25, 'Generating images...', 1, 5);
sendProgress(jobId, 'images', 50, 'Processing frame 3 of 5...', 3, 5);

// 3. Voiceover phase (70-75%)
sendProgress(jobId, 'voiceover', 70, 'All assets ready!');

// 4. Rendering phase (75-100%)
sendProgress(jobId, 'rendering', 75, 'Rendering video...');
sendProgress(jobId, 'rendering', 95, 'Finalizing...');

// 5. Complete!
sendProgress(jobId, 'complete', 100, 'Done!');
```

### Frontend Progress Display

The `VideoGenerationProgress` component subscribes to WebSocket updates:

```tsx
// frontend/src/components/VideoGenerationProgress.tsx

<VideoGenerationProgress
  jobId={jobId}
  onComplete={(videoUrl) => {
    // Video is ready!
  }}
  onError={(error) => {
    // Handle error
  }}
/>
```

### WebSocket Messages

**Progress Update:**
```json
{
  "type": "progress",
  "jobId": "temp-123456",
  "phase": "images",
  "percentage": 45,
  "message": "Processing frame 2 of 5...",
  "step": 2,
  "totalSteps": 5
}
```

**Completion:**
```json
{
  "type": "complete",
  "jobId": "temp-123456",
  "videoUrl": "/output/ai-storyboard-123456.mp4"
}
```

**Error:**
```json
{
  "type": "error",
  "jobId": "temp-123456",
  "message": "Image generation failed"
}
```

## UI Components

### Progress Bar

```
┌────────────────────────────────────┐
│            🎨                       │
│      Generating Images              │
│  Processing frame 2 of 5...         │
├────────────────────────────────────┤
│ ████████████░░░░░░░░░░░░░░░░░░░░  │ 45%
├────────────────────────────────────┤
│  ✓    🧠    🎨    🎙️    🎬        │
│ Done Active Next  Next  Next       │
└────────────────────────────────────┘
```

### Phase Timeline

- **Completed phases**: Green checkmark ✓
- **Active phase**: Colored icon with glow + pulse animation
- **Upcoming phases**: Gray icons
- **Current step**: "Step 2 of 5" counter

### Animations

- **Pulse**: Icons scale up/down during active phase
- **Shine**: Progress bar has sliding shine effect
- **Smooth transitions**: 0.3-0.5s ease transitions
- **Color shifts**: Phase colors change smoothly

## Integration Guide

### 1. Add Progress Component

```tsx
import VideoGenerationProgress from './components/VideoGenerationProgress';

function MyComponent() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    const response = await generateVideo({ topic, description });
    setJobId(response.jobId); // Set jobId to track progress
  };

  return (
    <>
      {isGenerating && jobId && (
        <VideoGenerationProgress
          jobId={jobId}
          onComplete={(url) => {
            setVideoUrl(url);
            setIsGenerating(false);
          }}
          onError={(error) => {
            setError(error);
            setIsGenerating(false);
          }}
        />
      )}
    </>
  );
}
```

### 2. Backend Integration

Add progress tracking to any long-running process:

```typescript
import { wsServer } from '../index';

export async function myLongProcess(jobId: string) {
  // Start
  wsServer.broadcast({
    type: 'progress',
    jobId,
    phase: 'processing',
    percentage: 10,
    message: 'Starting...',
  });

  // Do work...
  
  // Update
  wsServer.broadcast({
    type: 'progress',
    jobId,
    phase: 'processing',
    percentage: 50,
    message: 'Halfway there...',
  });

  // Complete
  wsServer.broadcast({
    type: 'complete',
    jobId,
    result: 'success',
  });
}
```

## Configuration

### WebSocket Port

Set in `.env`:
```
WEBSOCKET_PORT=3001
```

### Progress Update Frequency

Adjust in `server/routes/generateVideo.ts`:
- **Every frame**: Fine-grained (slower processing)
- **Every 25%**: Coarse updates (faster, less traffic)
- **Milestones only**: Start/end of phases

### Custom Phases

Add your own phases in `VideoGenerationProgress.tsx`:

```typescript
const PHASES = [
  { key: 'planning', label: 'Planning', icon: '🧠', color: '#667eea' },
  { key: 'custom', label: 'My Phase', icon: '🔥', color: '#ff6b6b' },
  // ... more phases
];
```

## Best Practices

### ✅ Do

- Keep messages short and user-friendly
- Update progress at meaningful milestones
- Use clear, non-technical language
- Show percentage and step counter
- Handle WebSocket disconnections gracefully

### ❌ Don't

- Send updates too frequently (> 10/sec)
- Include technical error details in messages
- Block on WebSocket sends
- Expose internal API calls or parameters
- Send sensitive data through WebSocket

## Troubleshooting

### WebSocket not connecting

**Check:**
1. WebSocket server is running (port 3001)
2. CORS/firewall not blocking
3. Frontend connecting to correct port
4. Browser supports WebSockets

**Fix:**
```bash
# Check if WebSocket port is open
netstat -an | grep 3001

# Restart server
npm run dev
```

### Progress not updating

**Check:**
1. jobId matches between frontend/backend
2. WebSocket messages being sent (check server logs)
3. Component receiving messages (check browser console)
4. Progress percentage increasing

**Debug:**
```typescript
// Add logging in VideoGenerationProgress
websocket.onmessage = (event) => {
  console.log('WebSocket message:', event.data);
  // ... handle message
};
```

### Multiple progress bars showing

**Fix:** Ensure only one VideoGenerationProgress component per jobId:
```tsx
{isGenerating && jobId && !videoUrl && (
  <VideoGenerationProgress jobId={jobId} />
)}
```

## Examples

### Simple Integration

```tsx
<VideoGenerationProgress jobId="job-123" />
```

### With Callbacks

```tsx
<VideoGenerationProgress
  jobId="job-123"
  onComplete={(url) => window.location.href = url}
  onError={(err) => alert(err)}
/>
```

### Custom Styling

Modify the component's inline styles or wrap it:

```tsx
<div className="my-progress-container">
  <VideoGenerationProgress jobId="job-123" />
</div>
```

## Future Enhancements

- [ ] Progress estimation (time remaining)
- [ ] Pause/resume generation
- [ ] Cancel generation
- [ ] Progress history/logs
- [ ] Multiple job tracking
- [ ] Progress notifications (browser/email)
- [ ] Real-time preview frames
- [ ] Detailed technical logs (optional toggle)

## Summary

**User sees:**
- 🧠 Planning → 🎨 Images → 🎙️ Voiceover → 🎬 Rendering
- Clear progress bar with percentage
- Friendly messages like "Processing frame 2 of 5"
- Smooth animations and transitions

**User doesn't see:**
- API calls
- Internal errors
- Technical details
- Raw logs

**Result:** Engaged users who know their video is being created! 🎉

