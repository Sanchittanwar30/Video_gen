# Colab API Usage Guide

This guide explains how to use the Colab API endpoints to offload heavy video rendering to Google Colab.

## Architecture

```
Your Application → API Server → Colab Notebook → API Server → Your Application
```

1. Your app calls `/api/colab/generate` with a video plan
2. Server creates a job and returns job ID
3. Colab notebook polls `/api/colab/jobs/pending` for new jobs
4. Colab processes the job and calls `/api/colab/callback/:jobId`
5. Your app polls `/api/colab/status/:jobId` or receives webhook callback

## API Endpoints

### 1. Create Colab Job

**POST** `/api/colab/generate`

Create a new video rendering job for Colab processing.

**Request Body:**
```json
{
  "videoPlan": {
    "frames": [
      {
        "id": "frame-1",
        "type": "whiteboard_diagram",
        "duration": 18,
        "text": "Introduction",
        "animate": true,
        "vectorized": {
          "svgUrl": "/assets/vectorized/example.svg"
        }
      }
    ]
  },
  "callbackUrl": "https://your-app.com/webhook/colab" // Optional
}
```

**Response:**
```json
{
  "jobId": "colab-1234567890-abc123",
  "status": "pending",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "endpoints": {
    "status": "http://localhost:3000/api/colab/status/colab-1234567890-abc123",
    "download": "http://localhost:3000/api/colab/download/colab-1234567890-abc123",
    "plan": "http://localhost:3000/api/colab/plan/colab-1234567890-abc123"
  },
  "message": "Job created. Use Colab notebook to process, or poll status endpoint."
}
```

### 2. Get Job Status

**GET** `/api/colab/status/:jobId`

Check the status of a rendering job.

**Response:**
```json
{
  "jobId": "colab-1234567890-abc123",
  "status": "completed",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "startedAt": "2024-01-01T00:01:00.000Z",
  "completedAt": "2024-01-01T00:05:00.000Z",
  "downloadUrl": "http://localhost:3000/api/colab/download/colab-1234567890-abc123"
}
```

**Status Values:**
- `pending`: Job created, waiting for Colab to process
- `processing`: Colab is currently rendering
- `completed`: Video is ready for download
- `failed`: Rendering failed (check `error` field)

### 3. Download Rendered Video

**GET** `/api/colab/download/:jobId`

Download the completed video file.

**Response:** MP4 file download

### 4. Get Pending Jobs (For Colab)

**GET** `/api/colab/jobs/pending`

Get all pending jobs. This endpoint is used by Colab notebooks to find work.

**Response:**
```json
{
  "jobs": [
    {
      "jobId": "colab-1234567890-abc123",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "planUrl": "http://localhost:3000/api/colab/plan/colab-1234567890-abc123",
      "callbackUrl": "https://your-app.com/webhook/colab"
    }
  ]
}
```

### 5. Job Callback (For Colab)

**POST** `/api/colab/callback/:jobId`

Colab calls this endpoint to report job completion.

**Request Body:**
```json
{
  "status": "completed",
  "outputPath": "/path/to/output.mp4"
}
```

or

```json
{
  "status": "failed",
  "error": "Error message"
}
```

## Usage Examples

### Example 1: Create Job and Poll for Completion

```typescript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

// Create job
const createResponse = await axios.post(`${API_BASE_URL}/api/colab/generate`, {
  videoPlan: {
    frames: [
      // ... your video plan
    ]
  }
});

const { jobId } = createResponse.data;

// Poll for completion
async function waitForCompletion(jobId: string): Promise<string> {
  while (true) {
    const statusResponse = await axios.get(`${API_BASE_URL}/api/colab/status/${jobId}`);
    const { status, downloadUrl } = statusResponse.data;
    
    if (status === 'completed') {
      return downloadUrl;
    } else if (status === 'failed') {
      throw new Error(`Job failed: ${statusResponse.data.error}`);
    }
    
    // Wait 5 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

const downloadUrl = await waitForCompletion(jobId);
console.log(`Video ready: ${downloadUrl}`);
```

### Example 2: Using Webhook Callback

```typescript
// Create job with callback URL
const createResponse = await axios.post(`${API_BASE_URL}/api/colab/generate`, {
  videoPlan: {
    frames: [/* ... */]
  },
  callbackUrl: 'https://your-app.com/webhook/colab'
});

// In your webhook handler
app.post('/webhook/colab', async (req, res) => {
  const { jobId, status, outputPath, error } = req.body;
  
  if (status === 'completed') {
    // Download video
    const videoResponse = await axios.get(
      `${API_BASE_URL}/api/colab/download/${jobId}`,
      { responseType: 'stream' }
    );
    
    // Save or process video
    // ...
  } else if (status === 'failed') {
    console.error(`Job ${jobId} failed: ${error}`);
  }
  
  res.json({ received: true });
});
```

### Example 3: Process Job Locally (Fallback)

If Colab is not available, you can process jobs locally:

```typescript
// Create job
const createResponse = await axios.post(`${API_BASE_URL}/api/colab/generate`, {
  videoPlan: { frames: [/* ... */] }
});

const { jobId } = createResponse.data;

// Process locally
await axios.post(`${API_BASE_URL}/api/colab/process/${jobId}`);

// Poll for completion
const status = await waitForCompletion(jobId);
```

## Setting Up Colab Notebook

1. **Update API URL in Colab notebook:**
   ```python
   API_BASE_URL = "https://your-server.com"  # Your public API URL
   ```

2. **Run the notebook cells** - it will automatically:
   - Poll for pending jobs
   - Download video plans
   - Render videos
   - Call back to your server

3. **For local development**, use ngrok or similar:
   ```bash
   ngrok http 3000
   # Use the ngrok URL as API_BASE_URL in Colab
   ```

## Error Handling

- **Job not found (404)**: Job ID is invalid or job was cleaned up
- **Job not completed (400)**: Trying to download before completion
- **Render failed**: Check Colab logs for details

## Best Practices

1. **Use webhooks** for production to avoid polling
2. **Set reasonable timeouts** when polling
3. **Clean up old jobs** periodically (automatic after 24 hours)
4. **Monitor Colab session** - free sessions timeout after ~90 minutes
5. **Handle failures gracefully** - retry or fallback to local rendering

## Troubleshooting

### Colab can't reach your API
- Use ngrok for local development
- Ensure your server is publicly accessible
- Check firewall settings

### Jobs stuck in "pending"
- Verify Colab notebook is running
- Check Colab can reach your API
- Verify `/api/colab/jobs/pending` returns jobs

### Callback not received
- Verify callback URL is accessible
- Check server logs for callback errors
- Ensure Colab notebook completed successfully

