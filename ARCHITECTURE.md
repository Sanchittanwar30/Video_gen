# Video Generation System Architecture

## Overview

This system provides a scalable, production-ready video generation pipeline using Remotion, with support for job queues, cloud storage, and real-time notifications.

## Architecture Diagram

```
Client (Browser/Mobile App)
    ↓
Backend API (Express/Node.js)
    ↓
Job Queue (BullMQ + Redis)
    ↓
Worker Process (Node.js)
    ↓
Remotion Render Engine
    ↓
Cloud Storage (S3/Supabase)
    ↓
Notification (WebSocket/Webhook)
    ↓
Client receives final video URL
```

## Components

### 1. Backend API (`server/`)

**Express.js REST API** that handles:
- Job creation (`POST /api/video/generate`)
- Status checking (`GET /api/video/status/:jobId`)
- Job cancellation (`DELETE /api/video/cancel/:jobId`)

**Files:**
- `server/index.ts` - Main API server
- `server/routes/video.ts` - Video generation routes
- `server/config.ts` - Configuration management
- `server/queue.ts` - BullMQ queue setup
- `server/websocket.ts` - WebSocket server for real-time updates
- `server/services/storage.ts` - Storage abstraction (Supabase/Local)

### 2. Job Queue (`server/queue.ts`)

**BullMQ** with Redis backend for:
- Job queuing and processing
- Job status tracking
- Retry logic with exponential backoff
- Job history management

**Features:**
- Automatic retries (3 attempts)
- Job progress tracking
- Job completion/failure events
- Webhook support

### 3. Worker Process (`workers/video-worker.ts`)

**Background worker** that:
- Processes video generation jobs
- Renders videos using Remotion
- Uploads videos to cloud storage
- Sends notifications (webhook/WebSocket)
- Handles errors and retries

**Configuration:**
- Concurrency: 1 job at a time (configurable)
- Rate limiting: 5 jobs per minute
- Automatic cleanup of local files

### 4. Storage Service (`server/services/storage.ts`)

**Abstracted storage layer** supporting:
- **Supabase Storage** - Default, production-ready storage (recommended)
- **Local Filesystem** - Development/testing fallback

**Operations:**
- Upload rendered videos
- Generate public URLs
- Download assets (if needed)
- Delete files

### 5. WebSocket Server (`server/websocket.ts`)

**Real-time notifications** for:
- Job progress updates
- Job completion
- Job failures
- Status changes

**Features:**
- Client subscription to specific jobs
- Broadcast to all clients
- Heartbeat/ping-pong
- Automatic reconnection handling

### 6. Remotion Render Engine (`render/index.ts`)

**Template-based video rendering** with:
- JSON template support
- Placeholder resolution
- Multiple track types (background, text, image, audio)
- Animation support
- Frame-accurate timing

## Data Flow

### 1. Video Generation Request

```
Client → POST /api/video/generate
  ↓
API validates request
  ↓
API creates temp files (template.json, input.json)
  ↓
API adds job to BullMQ queue
  ↓
API returns jobId (202 Accepted)
```

### 2. Job Processing

```
Worker picks up job from queue
  ↓
Worker updates progress (10%)
  ↓
Worker calls Remotion render
  ↓
Worker updates progress (30-80%)
  ↓
Video rendered to local disk
  ↓
Worker uploads to cloud storage
  ↓
Worker updates progress (100%)
  ↓
Worker sends webhook (if configured)
  ↓
Worker broadcasts WebSocket notification
  ↓
Worker cleans up local files
```

### 3. Status Updates

```
Client → GET /api/video/status/:jobId
  ↓
API queries BullMQ for job status
  ↓
API returns: status, progress, result, error
```

OR

```
WebSocket connection established
  ↓
Client subscribes to jobId
  ↓
Server broadcasts updates automatically
```

## Environment Configuration

See `.env.example` for all configuration options:

```bash
# Server
PORT=3000
NODE_ENV=development

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Storage (S3 or Supabase)
ASSET_STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...

# Or Supabase
SUPABASE_URL=...
SUPABASE_KEY=...
SUPABASE_BUCKET=videos
```

## Deployment

### Development

```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start API
npm run dev:api

# Terminal 3: Start Worker
npm run dev:worker
```

### Production (Docker)

```bash
docker-compose up -d
```

### Production (Manual)

```bash
# Start API (PM2 recommended)
pm2 start server/index.ts --name video-api

# Start Worker (PM2 recommended)
pm2 start workers/video-worker.ts --name video-worker
```

## Scaling

### Horizontal Scaling

- **API servers**: Stateless, can run multiple instances behind a load balancer
- **Workers**: Can run multiple workers for parallel processing
- **Redis**: Use Redis Cluster for high availability

### Vertical Scaling

- Increase worker concurrency (currently 1)
- Increase rate limits
- Use faster storage (SSD, NVMe)
- Optimize Remotion rendering settings

## Monitoring

### Job Metrics

- Jobs queued
- Jobs in progress
- Jobs completed
- Jobs failed
- Average processing time

### System Metrics

- Redis connection status
- Worker health
- Storage usage
- API response times

## Error Handling

### Job Failures

- Automatic retries (3 attempts with exponential backoff)
- Failed jobs stored for 7 days
- Error details included in job status
- Webhook notifications on failure

### Worker Failures

- Workers automatically reconnect to Redis
- Jobs remain in queue if worker crashes
- Failed jobs can be manually retried

## Security Considerations

1. **API Authentication**: Add authentication middleware (JWT, API keys)
2. **Rate Limiting**: Implement rate limiting per user/IP
3. **Input Validation**: Validate all template/input data
4. **Storage Security**: Use signed URLs for private videos
5. **Webhook Security**: Verify webhook signatures
6. **Environment Variables**: Never commit secrets to git

## Future Enhancements

- [ ] Database for job history
- [ ] User authentication/authorization
- [ ] Template management API
- [ ] Preview/thumbnail generation
- [ ] Video transcoding (multiple formats)
- [ ] CDN integration
- [ ] Analytics dashboard
- [ ] AI-powered template suggestions
- [ ] Batch processing
- [ ] Scheduled jobs

