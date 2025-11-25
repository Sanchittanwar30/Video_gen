# Video URL Fix - Full URLs for Playback

## 🐛 Problem
Videos in the library couldn't play because:
- Backend API returned relative URLs: `/site-library/video/file.mp4`
- Frontend runs on `http://localhost:5173`
- Backend runs on `http://localhost:3000`
- Browser tried to load: `http://localhost:5173/site-library/video/file.mp4` ❌
- But video is actually at: `http://localhost:3000/site-library/video/file.mp4` ✅

## ✅ Solution
Updated the backend to return **full URLs** instead of relative paths:

### Before (Broken)
```json
{
  "url": "/site-library/video/ai-storyboard-1763748538700.mp4",
  "thumbnail": "/site-library/video/ai-storyboard-1763748538700-thumbnail.jpg"
}
```

### After (Fixed)
```json
{
  "url": "http://localhost:3000/site-library/video/ai-storyboard-1763748538700.mp4",
  "thumbnail": "http://localhost:3000/site-library/video/ai-storyboard-1763748538700-thumbnail.jpg"
}
```

## 🔧 Changes Made

### 1. Updated Backend (server/routes/library.ts)
```typescript
// Videos
const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

return {
  id: file.replace('.mp4', ''),
  name: metadata.title || name,
  description: description || 'AI-generated video',
  url: `${baseUrl}/site-library/video/${file}`,  // Full URL now
  thumbnail: `${baseUrl}/site-library/video/${file.replace('.mp4', '-thumbnail.jpg')}`,
  duration: metadata.duration || 'Unknown',
  // ...
}

// Images
return {
  id: file,
  name: file.replace(/\.(jpg|jpeg|png|webp|gif|svg)$/, '').replace(/-/g, ' ').replace(/_/g, ' '),
  url: `${baseUrl}/site-library/image/${file}`,  // Full URL now
  thumbnail: `${baseUrl}/site-library/image/${file}`,
  // ...
}
```

### 2. Confirmed Frontend API URLs
All frontend API clients correctly use port 3000:
- `frontend/src/api/generateVideoClient.ts`: ✅ `http://localhost:3000`
- `frontend/src/services/api.ts`: ✅ `http://localhost:3000`
- `frontend/src/services/openai.ts`: ✅ `http://localhost:3000`

## 🚀 How to Apply Fix

### Step 1: Restart Backend Server
```bash
# Stop current backend (Ctrl+C)
npm run dev
```

### Step 2: Restart Frontend (if needed)
```bash
# Frontend should auto-reload, but if not:
# Ctrl+C and restart
npm run dev
```

### Step 3: Hard Refresh Browser
```
Press: Ctrl + Shift + R (Windows/Linux)
Or: Cmd + Shift + R (Mac)
```

## ✅ Expected Result

### Video Library
```
✅ Videos load and display thumbnails
✅ Click to play inline
✅ Hover controls work
✅ Download works
✅ Fullscreen player works
```

### Photo Library
```
✅ Images load and display
✅ Click to view fullscreen
✅ Download works
✅ Delete works
```

## 🔍 Verification

### Check API Response
```bash
# Test the API
curl http://localhost:3000/api/library/videos

# Should return:
{
  "videos": [
    {
      "url": "http://localhost:3000/site-library/video/ai-storyboard-1763748538700.mp4",
      // Full URL with http://localhost:3000
    }
  ]
}
```

### Check Browser Network Tab
```
1. Open DevTools (F12)
2. Go to Network tab
3. Filter: "mp4"
4. Click a video to play
5. Should see request to: http://localhost:3000/site-library/video/...
6. Status: 200 OK
```

### Check Video Element
```
1. Inspect video element in DevTools
2. Check src attribute
3. Should be: http://localhost:3000/site-library/video/[filename].mp4
4. Not: /site-library/video/[filename].mp4
```

## 🌐 Production Considerations

### Environment Variables
For production, set `API_BASE_URL`:

```bash
# .env (backend)
API_BASE_URL=https://your-domain.com
PORT=3000

# .env (frontend)
VITE_API_URL=https://your-domain.com
```

Then URLs will automatically use your production domain:
```
https://your-domain.com/site-library/video/video.mp4
```

### CORS
Make sure CORS is properly configured for cross-origin requests:
```typescript
// server/index.ts
app.use(cors({
  origin: ['http://localhost:5173', 'https://your-frontend-domain.com'],
  credentials: true
}));
```

## 📊 Port Summary

| Service | Port | Purpose |
|---------|------|---------|
| Backend HTTP | 3000 | API endpoints, static files |
| WebSocket | 3001 | Real-time progress updates |
| Frontend | 5173 | Vite dev server (React app) |

## ✨ Summary

**Problem**: Relative URLs didn't work across different ports  
**Solution**: Backend now returns full URLs with `http://localhost:3000`  
**Result**: Videos and images load properly! 🎉  

**Action Required**: Restart backend server and refresh browser!

