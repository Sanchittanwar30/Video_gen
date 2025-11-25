# Site Library Guide

## Overview
The `site-library` folder contains curated videos and images that appear in the UI library. This is separate from the general `output` directory, allowing you to control exactly what content is displayed to users.

## Folder Structure

```
site-library/
├── video/          # Videos shown in Video Library
│   ├── video1.mp4
│   ├── video1-metadata.json
│   ├── video1-transcript.txt
│   └── video1-thumbnail.jpg
└── image/          # Images shown in Photo Library
    ├── image1.jpg
    ├── image2.png
    └── diagram.svg
```

## Supported Formats

### Videos (`site-library/video/`)
- **MP4** files

### Images (`site-library/image/`)
- **JPG/JPEG**
- **PNG**
- **WebP**
- **GIF**
- **SVG**

## Optional Metadata Files

### For Videos
You can include these optional files alongside your video:

1. **`{filename}-metadata.json`** - Video metadata
   ```json
   {
     "title": "Introduction to Quantum Physics",
     "topic": "Physics",
     "duration": "2:45",
     "description": "An educational video about quantum mechanics"
   }
   ```

2. **`{filename}-transcript.txt`** - Video description/transcript
   ```
   This video introduces the fundamental concepts of quantum physics...
   ```

3. **`{filename}-thumbnail.jpg`** - Custom thumbnail image

4. **`{filename}-voiceover.mp3`** - Associated audio file

## Adding Content to Library

### Method 1: Manual Copy
Simply copy your video/image files to the appropriate folder:

**Windows:**
```powershell
# Copy a video
Copy-Item "output\my-video.mp4" "site-library\video\"

# Copy an image
Copy-Item "public\assets\gemini-images\my-image.jpg" "site-library\image\"
```

**Linux/Mac:**
```bash
# Copy a video
cp output/my-video.mp4 site-library/video/

# Copy an image
cp public/assets/gemini-images/my-image.jpg site-library/image/
```

### Method 2: Helper Script
Use the provided script to copy content:

```bash
# Copy a specific video
node scripts/add-to-library.js video ai-storyboard-1763709751964.mp4

# Copy a specific image
node scripts/add-to-library.js image quantum-diagram.jpg

# Copy ALL videos from output directory
node scripts/add-to-library.js video all

# Copy ALL images from gemini-images directory
node scripts/add-to-library.js image all
```

The script automatically copies associated metadata files (json, txt, thumbnail) along with the video.

### Method 3: Direct Generation
When generating new content, you can configure your generator to output directly to `site-library`:

```javascript
// In your video generation code
const outputPath = path.join(process.cwd(), 'site-library', 'video', `${filename}.mp4`);
```

## API Endpoints

The library API only serves content from `site-library`:

- **GET** `/api/library/videos` - Lists videos from `site-library/video/`
- **GET** `/api/library/photos` - Lists images from `site-library/image/`
- **GET** `/api/library/stats` - Statistics for site-library content
- **DELETE** `/api/library/videos/:id` - Deletes video from site-library
- **DELETE** `/api/library/photos/:id` - Deletes image from site-library

## Static File Access

Content is served via HTTP:

- Videos: `http://localhost:3000/site-library/video/{filename}`
- Images: `http://localhost:3000/site-library/image/{filename}`

## UI Display

### Video Library
- Shows all MP4 files from `site-library/video/`
- Displays metadata from JSON files
- Shows thumbnail if available
- Grid view with search and filter

### Photo Library
- Shows all image files from `site-library/image/`
- Supports all common image formats
- Grid view with search and filter
- SVG support with fallback

## Best Practices

### 1. Curate Your Content
Only add high-quality, finished videos and images to the library. Keep work-in-progress files in the `output` directory.

### 2. Use Descriptive Filenames
```
good-filename.mp4
quantum-physics-intro.mp4
solar-system-diagram.jpg
```

Avoid:
```
ai-storyboard-1763709751964.mp4  (hard to identify)
untitled-1.mp4                    (not descriptive)
```

### 3. Include Metadata
Always include metadata files for better user experience:
- **metadata.json** for proper titles and descriptions
- **thumbnail.jpg** for better preview images
- **transcript.txt** for searchable descriptions

### 4. Organize by Topic
Consider prefixing files by category:
```
physics-quantum-entanglement.mp4
physics-relativity-basics.mp4
biology-photosynthesis.mp4
```

### 5. Regular Cleanup
Periodically review and remove outdated content:
```bash
# List files by date
ls -lt site-library/video/

# Remove old files
rm site-library/video/old-video.mp4
```

## Storage Considerations

### File Sizes
- Keep videos under 100MB for better streaming
- Optimize images before adding (compress JPG/PNG)
- Use WebP for better compression

### Storage Monitoring
Check library statistics via API:
```bash
curl http://localhost:3000/api/library/stats
```

Or view in the UI on the Home page dashboard.

## Troubleshooting

### Videos Not Appearing
1. Check the file is in `site-library/video/`
2. Verify it's an MP4 file
3. Check file permissions
4. Restart the backend server

### Images Not Appearing
1. Check the file is in `site-library/image/`
2. Verify it's a supported format (jpg, png, webp, gif, svg)
3. Check file permissions
4. Refresh the browser

### Metadata Not Loading
1. Ensure metadata.json is in the same folder
2. Check JSON syntax is valid
3. Filename must match: `video.mp4` → `video-metadata.json`

### Delete Not Working
1. Check file permissions
2. Ensure the file exists in site-library (not output)
3. Check server logs for errors

## Migration from Old System

If you were using the previous system that read from `output/` and `assets/`, you can migrate your content:

```bash
# Copy all existing videos
node scripts/add-to-library.js video all

# Copy all existing images
node scripts/add-to-library.js image all
```

This will copy (not move) files, so originals remain in place.

## Security Notes

- The `site-library` folder is publicly accessible via HTTP
- Only add content you want to be publicly available
- Don't store sensitive or private content here
- Consider adding authentication if needed

## Summary

✅ Use `site-library/video/` for videos  
✅ Use `site-library/image/` for images  
✅ Include metadata files for better UX  
✅ Use the helper script for easy copying  
✅ Keep work-in-progress in `output/`  
✅ Only add curated, finished content  

The UI library now only shows content from `site-library`, giving you full control over what users see!

