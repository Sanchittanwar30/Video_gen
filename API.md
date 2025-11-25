# API Documentation

Complete API reference for Video Generation Studio.

**Base URL**: `http://localhost:3000`

---

## Table of Contents

- [Authentication](#authentication)
- [Video Generation](#video-generation)
- [Pen Sketch Animation](#pen-sketch-animation)
- [Image Vectorization](#image-vectorization)
- [Health Check](#health-check)
- [WebSocket Events](#websocket-events)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

---

## Authentication

Currently, the API does not require authentication. In production, implement API key authentication.

**Future Implementation:**
```http
Authorization: Bearer YOUR_API_KEY
```

---

## Video Generation

### Generate AI Storyboard Video

Generate a complete educational video from a topic description.

**Endpoint**: `POST /api/generate-video`

**Request Body**:
```json
{
  "topic": "Quantum Entanglement Explained Simply",
  "description": "Introduce the concept, walk through an example with two particles, and conclude with why observation collapses the state."
}
```

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `topic` | string | ✅ Yes | Video topic (max 200 chars) |
| `description` | string | No | Detailed description for better results |

**Response**: `200 OK`
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Quantum Entanglement Explained Simply",
  "videoUrl": "/output/ai-storyboard-1732186945170.mp4",
  "frames": [
    {
      "id": "frame_1",
      "type": "whiteboard_diagram",
      "heading": "What is Quantum Entanglement?",
      "duration": 5,
      "imageUrl": "/assets/gemini-images/gemini-image-abc123.png",
      "vectorized": {
        "svgUrl": "/assets/vectorized-images/image-abc123.svg"
      },
      "voiceoverUrl": "/assets/voiceovers/voiceover-abc123.mp3",
      "voiceoverScript": "Quantum entanglement is a phenomenon where two particles become connected..."
    },
    {
      "id": "frame_2",
      "type": "motion_scene",
      "heading": "Two Entangled Particles",
      "duration": 6,
      "imageUrl": "/assets/gemini-images/gemini-image-def456.png",
      "voiceoverUrl": "/assets/voiceovers/voiceover-def456.mp3",
      "voiceoverScript": "Imagine two particles that share a quantum state..."
    }
  ]
}
```

**Frame Types**:
- `whiteboard_diagram` - Static diagram with drawing animation
- `motion_scene` - AI-generated image with motion effects

**Error Responses**:

`400 Bad Request` - Missing or invalid topic
```json
{
  "error": "topic is required"
}
```

`500 Internal Server Error` - Generation failed
```json
{
  "error": "Image generation failed",
  "details": "Gemini API rate limit exceeded"
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/generate-video \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Photosynthesis Explained",
    "description": "Start with sunlight, show energy conversion, and explain oxygen production."
  }'
```

**Processing Time**: 2-5 minutes depending on frame count

**WebSocket Updates**: Subscribe to job ID for real-time progress

---

## Pen Sketch Animation

### Create Whiteboard Animation

Convert an image into a hand-drawn whiteboard-style animation.

**Endpoint**: `POST /api/pen-sketch/animate`

**Request**: `multipart/form-data`

**Parameters**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `images` | File | ✅ Yes | - | Image file (PNG, JPG, JPEG) |
| `duration` | number | No | 5 | Animation duration in seconds |
| `frameRate` | number | No | 25 | Frames per second |
| `videoWidth` | number | No | 1920 | Output width in pixels |
| `videoHeight` | number | No | 1080 | Output height in pixels |
| `voiceover` | File | No | - | Optional audio file (MP3, WAV) |

**Response**: `200 OK`
```json
{
  "jobId": "pen-sketch-1732186945170-abc123",
  "status": "completed",
  "videoUrl": "/output/pen-sketch/pen-sketch-1732186945170-abc123.mp4",
  "message": "Animation created successfully"
}
```

**Status Values**:
- `processing` - Animation in progress
- `completed` - Animation ready
- `failed` - Error occurred

**Error Responses**:

`400 Bad Request` - Invalid file or parameters
```json
{
  "error": "No image file provided"
}
```

`500 Internal Server Error` - Processing failed
```json
{
  "error": "Animation generation failed",
  "message": "Python script error: ..."
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/pen-sketch/animate \
  -F "images=@diagram.png" \
  -F "duration=8" \
  -F "frameRate=25" \
  -F "videoWidth=1920" \
  -F "videoHeight=1080"
```

**Processing Time**: 30 seconds - 2 minutes depending on image complexity

---

### Get Animation Status

Check the status of a pen sketch animation job.

**Endpoint**: `GET /api/pen-sketch/status/:jobId`

**Response**: `200 OK`
```json
{
  "jobId": "pen-sketch-1732186945170-abc123",
  "status": "completed",
  "videoUrl": "/output/pen-sketch/pen-sketch-1732186945170-abc123.mp4"
}
```

---

### Download Animation

Download the generated animation video.

**Endpoint**: `GET /api/pen-sketch/download/:jobId`

**Response**: `200 OK` - Binary video file (MP4)

**Error**: `404 Not Found` if video doesn't exist

---

## Image Vectorization

### Vectorize Image

Convert a raster image to SVG format (optional feature).

**Endpoint**: `POST /api/vectorize`

**Request**: `multipart/form-data`

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image` | File | ✅ Yes | Image file to vectorize |

**Response**: `200 OK`
```json
{
  "svgUrl": "/assets/vectorized-images/image-abc123.svg",
  "pngUrl": "/assets/vectorized-images/image-abc123.png"
}
```

**Supported Formats**: PNG, JPG, JPEG

---

## Health Check

### Server Status

Check if the server is running and healthy.

**Endpoint**: `GET /health`

**Response**: `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2025-11-21T12:34:56.789Z",
  "service": "video-generation-api"
}
```

**Use Case**: Health monitoring, load balancer checks

---

## WebSocket Events

### Connection

Connect to the WebSocket server for real-time updates.

**URL**: `ws://localhost:3001`

**Client-side**:
```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.onopen = () => {
  // Subscribe to job updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    jobId: 'your-job-id-here'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Progress update:', data);
};
```

### Message Types

#### 1. Progress Update

Sent periodically during video generation.

```json
{
  "type": "progress",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "phase": "images",
  "percentage": 45,
  "message": "Processing frame 2 of 5...",
  "step": 2,
  "totalSteps": 5
}
```

**Phases**:
- `planning` (0-20%) - AI creates video structure
- `images` (20-70%) - Generating visuals
- `voiceover` (70-75%) - Creating audio
- `rendering` (75-100%) - Final video compilation

#### 2. Completion

Sent when generation is complete.

```json
{
  "type": "complete",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "videoUrl": "/output/ai-storyboard-1732186945170.mp4"
}
```

#### 3. Error

Sent if generation fails.

```json
{
  "type": "error",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Image generation failed: API quota exceeded"
}
```

---

## Error Handling

### Standard Error Response

All errors follow this format:

```json
{
  "error": "Human-readable error message",
  "details": "Optional detailed error information",
  "code": "ERROR_CODE"
}
```

### HTTP Status Codes

| Code | Description | Common Causes |
|------|-------------|---------------|
| `200` | OK | Request successful |
| `400` | Bad Request | Missing/invalid parameters |
| `404` | Not Found | Resource doesn't exist |
| `500` | Internal Server Error | Server-side failure |
| `503` | Service Unavailable | External API down |

### Common Errors

#### Missing Topic
```json
{
  "error": "topic is required"
}
```

#### Image Generation Failed
```json
{
  "error": "Image generation failed",
  "details": "Gemini API rate limit exceeded"
}
```

#### File Upload Failed
```json
{
  "error": "No image file provided"
}
```

#### Video Not Found
```json
{
  "error": "Video not found",
  "details": "Job ID does not exist or video was deleted"
}
```

---

## Rate Limiting

**Current**: No rate limiting implemented

**Planned**:
- 10 requests per minute per IP
- 50 requests per hour per API key
- Exponential backoff on 429 responses

**Response** (when implemented):
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60,
  "limit": 10,
  "remaining": 0
}
```

**Headers**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 5
X-RateLimit-Reset: 1732186945
```

---

## Best Practices

### 1. Use WebSocket for Long Operations

Don't poll the API for status updates. Use WebSocket for real-time progress.

✅ **Good**:
```javascript
const ws = new WebSocket('ws://localhost:3001');
ws.send(JSON.stringify({ type: 'subscribe', jobId }));
```

❌ **Bad**:
```javascript
setInterval(() => {
  fetch(`/api/status/${jobId}`); // Polling
}, 1000);
```

### 2. Handle Timeouts

Video generation can take 2-5 minutes. Set appropriate timeouts.

```javascript
const response = await fetch('/api/generate-video', {
  method: 'POST',
  body: JSON.stringify(data),
  signal: AbortSignal.timeout(600000) // 10 minutes
});
```

### 3. Validate File Uploads

Check file type and size before uploading.

```javascript
const file = document.querySelector('input[type="file"]').files[0];

if (!['image/png', 'image/jpeg'].includes(file.type)) {
  alert('Only PNG and JPEG files are supported');
  return;
}

if (file.size > 10 * 1024 * 1024) { // 10MB
  alert('File size must be less than 10MB');
  return;
}
```

### 4. Cache Responses

Cache generated videos to avoid regenerating identical content.

```javascript
const cacheKey = `video-${topic}-${description}`;
const cached = localStorage.getItem(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const response = await generateVideo(topic, description);
localStorage.setItem(cacheKey, JSON.stringify(response));
```

---

## SDK Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

async function generateVideo(topic, description) {
  const response = await axios.post('http://localhost:3000/api/generate-video', {
    topic,
    description
  });
  
  return response.data;
}

// Usage
const video = await generateVideo(
  'Photosynthesis',
  'Explain the process of converting sunlight into energy'
);

console.log('Video URL:', video.videoUrl);
```

### Python

```python
import requests

def generate_video(topic, description=""):
    response = requests.post(
        'http://localhost:3000/api/generate-video',
        json={'topic': topic, 'description': description}
    )
    return response.json()

# Usage
video = generate_video(
    topic='Photosynthesis',
    description='Explain the process of converting sunlight into energy'
)

print(f"Video URL: {video['videoUrl']}")
```

### cURL

```bash
#!/bin/bash

# Generate video
curl -X POST http://localhost:3000/api/generate-video \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Photosynthesis",
    "description": "Explain the process"
  }' \
  -o response.json

# Extract video URL
VIDEO_URL=$(jq -r '.videoUrl' response.json)
echo "Video URL: $VIDEO_URL"

# Download video
curl "http://localhost:3000${VIDEO_URL}" -o video.mp4
```

---

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/video-generation-studio/issues)
- **Documentation**: [README.md](README.md)
- **WebSocket Guide**: [WEBSOCKET-PROGRESS.md](WEBSOCKET-PROGRESS.md)

---

**API Version**: 1.0.0  
**Last Updated**: November 21, 2025

