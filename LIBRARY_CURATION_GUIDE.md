# Site Library - Manual Curation Guide

## 🎯 Philosophy

The `site-library` folder is your **curated showcase** - only your best, hand-picked content appears here.

**This is NOT an automatic dump of all generated videos!**

## 📁 Folder Structure

```
site-library/
├── video/          # Only your selected videos
│   └── .gitkeep
└── image/          # Only your selected images
    └── .gitkeep
```

## ✨ How to Add Content

### Method 1: Upload via UI (Recommended)
```
1. Open your app at http://localhost:5173
2. Go to Video Library or Photo Library
3. Click "Upload Videos" or "Upload Photos" button
4. Select files from anywhere on your computer
5. Videos/photos instantly added to site-library
```

**Benefits:**
- ✅ Upload from any folder
- ✅ Drag & drop support
- ✅ Progress indicators
- ✅ Instant preview
- ✅ No terminal commands needed

### Method 2: Manual Copy (Advanced)
```bash
# Copy a specific video from output folder
node scripts/add-to-library.js video ai-storyboard-1763748538700.mp4

# Copy a specific image
node scripts/add-to-library.js image my-photo.jpg

# Copy multiple specific files
node scripts/add-to-library.js video video1.mp4 video2.mp4 video3.mp4
```

**Benefits:**
- ✅ Copy from output folder
- ✅ Copy from assets folder
- ✅ Batch copy specific files
- ✅ Command-line control

### Method 3: Direct File Copy
```bash
# Windows PowerShell
Copy-Item "output\best-video.mp4" "site-library\video\"
Copy-Item "assets\best-image.jpg" "site-library\image\"

# Or just drag & drop files in File Explorer
```

## 🚫 What NOT to Do

### ❌ Don't Auto-Copy Everything
```bash
# DON'T DO THIS (copies all 100+ videos)
node scripts/add-to-library.js video all
```

**Why?**
- Clutters your showcase
- Hard to find best content
- Slows down UI
- Not curated

### ❌ Don't Use Output Folder for Display
The `output/` folder is your **working directory**:
- All generated videos go here first
- May contain test videos
- May contain failed attempts
- Not cleaned up

The `site-library/` is your **showcase**:
- Only your best work
- Manually selected
- Clean and organized
- What you want to share

## 🎨 Curation Workflow

### Step 1: Generate Content
```
Generate videos → They go to output/
Take photos → They go to assets/
```

### Step 2: Review & Select
```
1. Review your output/ folder
2. Watch videos, check quality
3. Select your favorites
```

### Step 3: Add to Library
```
Option A: Upload via UI
- Open Video Library
- Click "Upload Videos"
- Select best videos
- Upload!

Option B: Copy via Script
- node scripts/add-to-library.js video [filename]
```

### Step 4: Verify in UI
```
1. Open Video/Photo Library in browser
2. See only your curated content
3. Play, share, download
```

## 📊 Example Workflow

### Scenario: Generated 20 Videos Today
```
✅ DO THIS:

1. Generate 20 videos → output/ folder
2. Review all 20 videos
3. Pick best 3 videos
4. Upload those 3 via UI to site-library
5. Now UI shows only 3 curated videos

❌ DON'T DO THIS:

1. Generate 20 videos → output/ folder
2. Run: node scripts/add-to-library.js video all
3. All 20 videos in UI (including bad ones)
4. Hard to find the good ones
```

## 🎯 Benefits of Manual Curation

### Quality Control
- ✅ Only showcase your best work
- ✅ No test videos visible
- ✅ No failed generations
- ✅ Professional presentation

### Organization
- ✅ Easy to browse
- ✅ Fast loading
- ✅ Meaningful content
- ✅ Clean interface

### User Experience
- ✅ Visitors see only quality content
- ✅ Faster page loads
- ✅ Better first impression
- ✅ Easier navigation

## 💡 Tips

### Start Small
```
- Add 5-10 best videos initially
- Add more as you create great content
- Keep it curated, not cluttered
```

### Categories (Future Enhancement)
```
Could organize like:
site-library/
├── video/
│   ├── tutorials/
│   ├── demos/
│   └── presentations/
```

### Regular Cleanup
```
- Remove outdated content
- Replace with better versions
- Keep library fresh
```

## 🔍 Current State

Your `site-library` is now **EMPTY** and ready for curation:

```
site-library/video/ → Empty (only .gitkeep)
site-library/image/ → Empty (only .gitkeep)

Your generated content:
output/ → 117 videos (all your generations)
assets/ → Photos and images

Next step: Pick your favorites and add them!
```

## 🚀 Quick Start

### Add Your First 5 Videos

**Option 1: Via UI**
```
1. Open http://localhost:5173
2. Go to Video Library
3. Click "Upload Videos"
4. Select 5 best MP4s from output/ folder
5. Done!
```

**Option 2: Via Command**
```bash
# Replace with your actual best video filenames
node scripts/add-to-library.js video \
  ai-storyboard-1763748538700.mp4 \
  ai-storyboard-1763735161616.mp4 \
  ai-storyboard-1763733949170.mp4 \
  final_storyboard_style.mp4 \
  ai-storyboard-1763722104075.mp4
```

## ✨ Summary

**Remember:**
- 🎯 **site-library** = Curated showcase (manual selection)
- 📁 **output** = All generated content (automatic)
- ⬆️ **Upload via UI** = Best method for adding content
- 🚫 **Never use "all"** = Keep it curated, not cluttered
- ✨ **Quality > Quantity** = Show your best work

**Your library is your portfolio - make it count!** 🌟

