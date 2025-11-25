# Quick Start: Populate Your Library

## 🎯 Goal
Your UI now only shows content from the `site-library` folder. Let's add some content!

## 📁 Current Status
- ✅ Empty library folders created:
  - `site-library/video/` (for videos)
  - `site-library/image/` (for images)
- ✅ Backend configured to serve from site-library
- ✅ UI ready to display content

## 🚀 Quick Setup (Choose One)

### Option 1: Copy ALL Your Videos & Images (Recommended)

```bash
# Copy all 100+ videos from output folder
node scripts/add-to-library.js video all

# Copy all images from assets folder
node scripts/add-to-library.js image all
```

This will copy all your existing videos and images to the site-library, making them visible in the UI.

### Option 2: Copy Specific Files

```bash
# Copy one video
node scripts/add-to-library.js video ai-storyboard-1763709751964.mp4

# Copy one image
node scripts/add-to-library.js image quantum-diagram.jpg
```

### Option 3: Manual Copy (Windows PowerShell)

```powershell
# Copy a video manually
Copy-Item "output\ai-storyboard-1763709751964.mp4" "site-library\video\"

# Copy an image manually
Copy-Item "public\assets\gemini-images\my-image.jpg" "site-library\image\"
```

## 🔄 After Adding Content

1. **Refresh your browser** (or the library will auto-update)
2. **Navigate to Video Library** - See your videos
3. **Navigate to Photo Library** - See your images
4. **Home page stats** will show the count

## 📊 Verify It's Working

### Check via API:
```bash
# Check video count
curl http://localhost:3000/api/library/videos

# Check image count
curl http://localhost:3000/api/library/photos

# Check statistics
curl http://localhost:3000/api/library/stats
```

### Check via UI:
1. Open http://localhost:5173
2. Go to **Video Library** - Should show your videos
3. Go to **Photo Library** - Should show your images
4. Go to **Home** - Stats should reflect your content

## 📝 Example: Add Your First 10 Videos

```bash
# Navigate to project directory
cd C:\Users\Dell\Video_gen

# Add your first 10 videos (edit filenames as needed)
node scripts/add-to-library.js video ai-storyboard-1763709751964.mp4
node scripts/add-to-library.js video ai-storyboard-1763711478607.mp4
# ... add more videos ...

# Or just copy all at once:
node scripts/add-to-library.js video all
```

## 🎨 UI Features After Populating

Once you add content, you'll see:

### Video Library Page
- ✅ Grid of video thumbnails
- ✅ Search and filter
- ✅ Play, download, delete actions
- ✅ Fullscreen video player
- ✅ Statistics dashboard

### Photo Library Page
- ✅ Grid of image thumbnails
- ✅ Search and filter
- ✅ View, download, delete actions
- ✅ Fullscreen image viewer
- ✅ Statistics dashboard

### Home Page
- ✅ Live statistics
- ✅ Total videos count
- ✅ Total images count
- ✅ Storage used

## 🔍 File Locations

### Where Files Are:
- **Original Videos**: `output/` folder (100+ videos)
- **Original Images**: `public/assets/gemini-images/` folder
- **Library Videos**: `site-library/video/` (what UI shows)
- **Library Images**: `site-library/image/` (what UI shows)

### Important:
- The helper script **copies** files (doesn't move them)
- Original files remain untouched in `output/`
- You control what appears in the UI

## ⚡ Quick Commands Cheat Sheet

```bash
# Add all videos to library
node scripts/add-to-library.js video all

# Add all images to library
node scripts/add-to-library.js image all

# Add specific video
node scripts/add-to-library.js video filename.mp4

# Add specific image
node scripts/add-to-library.js image filename.jpg

# Check what's in the library
ls site-library/video/
ls site-library/image/

# View statistics
curl http://localhost:3000/api/library/stats
```

## 🎯 Recommended Workflow

1. **Initial Setup** (Do this now):
   ```bash
   node scripts/add-to-library.js video all
   node scripts/add-to-library.js image all
   ```

2. **Ongoing Use**:
   - Generate new videos → They go to `output/`
   - Review and curate → Copy good ones to `site-library/`
   - Users only see curated content in `site-library/`

3. **Regular Maintenance**:
   - Delete old/outdated videos from `site-library/video/`
   - Add new quality content as it's created
   - Keep the library fresh and relevant

## ✨ You're Ready!

After running the commands above, your library will be populated and the UI will display all your content beautifully organized!

**Next Steps:**
1. Run: `node scripts/add-to-library.js video all`
2. Run: `node scripts/add-to-library.js image all`
3. Refresh your browser
4. Enjoy your populated library! 🎉

