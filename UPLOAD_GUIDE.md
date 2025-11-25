# Upload Guide - UI Upload Functionality

## Overview
The UI now supports uploading videos and images directly to the `site-library` through a web interface with drag & drop support.

## ✨ Features

### Video Upload
- **Drag & Drop**: Drag video files directly onto the library page
- **File Picker**: Click "Upload Videos" button to select files
- **Multiple Files**: Upload up to 10 videos at once
- **File Size Limit**: 500MB per video
- **Supported Format**: MP4 only
- **Progress Indicator**: Real-time upload progress
- **Auto-refresh**: Library refreshes automatically after upload

### Photo Upload
- **Drag & Drop**: Drag image files directly onto the library page
- **File Picker**: Click "Upload Photos" button to select files
- **Multiple Files**: Upload up to 20 images at once
- **File Size Limit**: 50MB per image
- **Supported Formats**: JPG, JPEG, PNG, WebP, GIF, SVG
- **Progress Indicator**: Real-time upload progress
- **Auto-refresh**: Library refreshes automatically after upload

## 🎯 How to Use

### Method 1: Upload Button

#### Upload Videos:
1. Navigate to **Video Library** page
2. Click **"Upload Videos"** button in the top right
3. Select MP4 files from your computer (can select multiple)
4. Wait for upload to complete
5. Library will automatically refresh

#### Upload Photos:
1. Navigate to **Photo Library** page
2. Click **"Upload Photos"** button in the top right
3. Select image files from your computer (can select multiple)
4. Wait for upload to complete
5. Library will automatically refresh

### Method 2: Drag & Drop

#### Upload Videos:
1. Navigate to **Video Library** page
2. Drag MP4 files from your computer
3. Drop them anywhere on the library page
4. Upload starts automatically
5. Library refreshes when complete

#### Upload Photos:
1. Navigate to **Photo Library** page
2. Drag image files from your computer
3. Drop them anywhere on the library page
4. Upload starts automatically
5. Library refreshes when complete

## 📊 Upload Limits

### Videos
| Property | Limit |
|----------|-------|
| Max file size | 500 MB per file |
| Max files | 10 files per upload |
| Formats | MP4 only |
| Total size | 5 GB per upload |

### Photos
| Property | Limit |
|----------|-------|
| Max file size | 50 MB per file |
| Max files | 20 files per upload |
| Formats | JPG, JPEG, PNG, WebP, GIF, SVG |
| Total size | 1 GB per upload |

## 🔒 File Validation

### Server-Side Validation
- **File Type Check**: Only allows specified MIME types
- **File Size Check**: Rejects files exceeding size limits
- **File Count Check**: Limits number of files per upload
- **Storage Check**: Ensures destination directory exists

### Client-Side Validation
- **Format Check**: Filters files by extension before upload
- **Count Check**: Warns if too many files selected
- **Error Handling**: Shows user-friendly error messages

## 📁 Upload Destinations

### Videos
```
site-library/video/{filename}.mp4
```

### Photos
```
site-library/image/{filename}.jpg
site-library/image/{filename}.png
site-library/image/{filename}.svg
```

## 🎨 UI Components

### Upload Progress Indicator
```
┌─────────────────────────────────────┐
│ 🔄 Uploading 5 video(s)...         │
└─────────────────────────────────────┘
```

### Drag & Drop Zone (Empty Library)
```
┌─────────────────────────────────────┐
│                                     │
│          📤 (Upload Icon)           │
│                                     │
│    Drag & Drop Videos Here          │
│                                     │
│  Or click the "Upload Videos"       │
│         button above                │
│                                     │
│  Supports: MP4 files                │
│  (max 500MB each, up to 10 files)  │
│                                     │
└─────────────────────────────────────┘
```

### Upload Button States
```
Normal:     [Upload Videos]
Uploading:  [Uploading...] (disabled)
Success:    Shows success message in progress indicator
```

## 🔄 Upload Flow

### 1. File Selection
```
User clicks "Upload Videos" button
      ↓
File picker opens
      ↓
User selects MP4 files
```

### 2. Validation
```
Client validates:
  - File format (MP4)
  - File count (max 10)
      ↓
If valid, proceed
If invalid, show error alert
```

### 3. Upload
```
FormData created with files
      ↓
POST to /api/library/videos/upload
      ↓
Server validates:
  - MIME type
  - File size
  - Destination directory
```

### 4. Save to Disk
```
Files saved to site-library/video/
      ↓
Response sent to client
  { success: true, files: [...] }
```

### 5. Refresh
```
Upload progress shown
      ↓
Success message displayed (2 seconds)
      ↓
Library automatically refreshes
      ↓
New videos/photos appear
```

## 🔗 API Endpoints

### Upload Videos
```
POST /api/library/videos/upload
Content-Type: multipart/form-data

FormData:
  videos: File[] (max 10 files)

Response:
{
  "success": true,
  "message": "Successfully uploaded 5 video(s)",
  "files": [
    {
      "filename": "my-video.mp4",
      "originalname": "my-video.mp4",
      "size": "45.2 MB",
      "path": "/site-library/video/my-video.mp4"
    }
  ]
}
```

### Upload Photos
```
POST /api/library/photos/upload
Content-Type: multipart/form-data

FormData:
  images: File[] (max 20 files)

Response:
{
  "success": true,
  "message": "Successfully uploaded 12 image(s)",
  "files": [
    {
      "filename": "diagram.jpg",
      "originalname": "diagram.jpg",
      "size": "2.5 MB",
      "path": "/site-library/image/diagram.jpg"
    }
  ]
}
```

## 🐛 Troubleshooting

### Upload Button Disabled
**Cause**: Upload already in progress
**Solution**: Wait for current upload to complete

### "Only MP4 files allowed"
**Cause**: Trying to upload non-MP4 video
**Solution**: Convert video to MP4 format first

### "File too large"
**Cause**: File exceeds size limit (500MB for videos, 50MB for images)
**Solution**: 
- Compress the file
- Use video editing software to reduce file size
- Split large files into smaller parts

### Upload Fails with Network Error
**Cause**: Backend server not running or network issue
**Solution**:
- Check if backend is running (`npm run dev`)
- Check console for errors
- Verify API endpoint is accessible

### Files Not Appearing After Upload
**Cause**: Library not refreshed or upload failed
**Solution**:
- Click "Refresh" button
- Check browser console for errors
- Verify files are in `site-library/video/` or `site-library/image/`

### "Maximum X files at a time"
**Cause**: Selected too many files
**Solution**: Upload in batches (max 10 videos or 20 images per batch)

## 🔧 Backend Configuration

### Multer Settings
```typescript
// Video upload configuration
const videoStorage = multer.diskStorage({
  destination: 'site-library/video/',
  filename: (req, file, cb) => cb(null, file.originalname)
});

const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: videoFilter, // MP4 only
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

// Image upload configuration
const imageStorage = multer.diskStorage({
  destination: 'site-library/image/',
  filename: (req, file, cb) => cb(null, file.originalname)
});

const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFilter, // Images only
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});
```

## 🎯 Best Practices

### 1. File Naming
- Use descriptive filenames
- Avoid special characters
- Use hyphens or underscores instead of spaces
```
Good: quantum-physics-intro.mp4
Bad:  video (1) final FINAL v2.mp4
```

### 2. File Organization
- Upload related content together
- Use consistent naming conventions
- Consider prefixing by category

### 3. File Preparation
- Compress large files before upload
- Convert to supported formats
- Test videos play correctly before upload

### 4. Batch Uploads
- Upload in reasonable batches (5-10 files)
- Don't overwhelm the server
- Wait for one batch to complete before starting next

## 📱 Mobile Support

- ✅ Drag & drop works on modern mobile browsers
- ✅ File picker opens native file selector
- ✅ Touch-friendly upload buttons
- ✅ Responsive progress indicators
- ✅ Optimized for slower connections

## 🔐 Security Notes

- Files are validated server-side
- Only allowed MIME types accepted
- File size limits enforced
- Destination directory is controlled
- Original filenames preserved (be careful with sensitive names)

## ✨ Summary

✅ **Upload Videos**: Click button or drag & drop MP4 files  
✅ **Upload Photos**: Click button or drag & drop image files  
✅ **Multiple Files**: Up to 10 videos or 20 images at once  
✅ **Drag & Drop**: Works on empty library or with existing content  
✅ **Progress Indicators**: Real-time upload status  
✅ **Auto-refresh**: Library updates automatically  
✅ **File Validation**: Both client and server-side  
✅ **Mobile Friendly**: Works on tablets and phones  

Users can now easily add content to the library without command-line tools! 🎉

