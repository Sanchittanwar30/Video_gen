# How to Upload Your Project to Colab

Yes, you need to upload your project files to Colab so it can run the rendering code. Here are your options:

## Option 1: Upload ZIP File (Easiest)

### Step 1: Create a Project ZIP

**In your local terminal:**
```powershell
# Create a ZIP excluding node_modules and other large folders
Compress-Archive -Path src,remotion,server,public,package.json,package-lock.json,tsconfig.json,remotion.config.ts -DestinationPath colab-project.zip -Force
```

Or manually:
1. Select these folders/files:
   - `src/`
   - `remotion/`
   - `server/` (or just `server/services/remotion-ai-renderer.ts`)
   - `public/`
   - `package.json`
   - `package-lock.json`
   - `tsconfig.json`
   - `remotion.config.ts`
2. Right-click → "Send to" → "Compressed (zipped) folder"
3. Name it `colab-project.zip`

### Step 2: Upload to Colab

In Colab notebook, add this cell:
```python
from google.colab import files
import zipfile
import os

# Upload ZIP file
print("Upload your project ZIP file:")
uploaded = files.upload()

# Extract it
for filename in uploaded.keys():
    if filename.endswith('.zip'):
        with zipfile.ZipFile(filename, 'r') as zip_ref:
            zip_ref.extractall('/content/video-gen')
        print(f"✅ Extracted {filename}")
        os.remove(filename)  # Clean up

# Change to project directory
os.chdir('/content/video-gen')
print(f"✅ Current directory: {os.getcwd()}")
```

## Option 2: Git Clone (If Your Project is in a Repo)

If your project is in GitHub/GitLab:

```python
# In Colab notebook
!git clone YOUR_REPO_URL /content/video-gen
!cd /content/video-gen && npm install
```

## Option 3: Upload Individual Files (Manual)

For smaller projects, you can upload files one by one:

```python
from google.colab import files
import os

# Create directory structure
!mkdir -p /content/video-gen/src
!mkdir -p /content/video-gen/remotion
!mkdir -p /content/video-gen/server/services
!mkdir -p /content/video-gen/public

# Upload files
uploaded = files.upload()

# Move files to correct locations
# (You'll need to organize them manually)
```

## Option 4: Minimal Upload (Recommended)

You only need these files for rendering:

**Required:**
- `src/WhiteboardAnimatorPrecise.tsx`
- `src/index.tsx`
- `src/Root.tsx`
- `remotion/src/VideoFromAI.tsx`
- `server/services/remotion-ai-renderer.ts`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `remotion.config.ts`

**Optional (for assets):**
- `public/assets/` (if your video plans reference local assets)

### Minimal ZIP Creation

```powershell
# Create minimal ZIP with only required files
$files = @(
    "src",
    "remotion",
    "server/services/remotion-ai-renderer.ts",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "remotion.config.ts"
)

Compress-Archive -Path $files -DestinationPath colab-minimal.zip -Force
```

## Updated Colab Notebook Cell

Here's the updated "Upload Project Files" cell for the notebook:

```python
from google.colab import files
import zipfile
import os

# Create project directory
!mkdir -p /content/video-gen

print("📦 Upload your project ZIP file:")
print("   Option 1: Upload colab-project.zip")
print("   Option 2: Use git clone if in a repository")
print("")

# Option 1: Upload ZIP
uploaded = files.upload()

for filename in uploaded.keys():
    if filename.endswith('.zip'):
        print(f"📂 Extracting {filename}...")
        with zipfile.ZipFile(filename, 'r') as zip_ref:
            zip_ref.extractall('/content/video-gen')
        print(f"✅ Extracted to /content/video-gen")
        os.remove(filename)

# Option 2: Git clone (uncomment if using)
# !git clone YOUR_REPO_URL /content/video-gen

# Change to project directory
os.chdir('/content/video-gen')
print(f"✅ Current directory: {os.getcwd()}")
print(f"📁 Files: {os.listdir('.')}")
```

## What Files Are Actually Needed?

### For Rendering Only:
- ✅ `src/` - Your React components
- ✅ `remotion/` - Remotion compositions
- ✅ `server/services/remotion-ai-renderer.ts` - Renderer service
- ✅ `package.json` - Dependencies
- ✅ `tsconfig.json` - TypeScript config
- ✅ `remotion.config.ts` - Remotion config

### Not Needed:
- ❌ `node_modules/` - Will be installed in Colab
- ❌ `output/` - Output directory
- ❌ `temp/` - Temporary files
- ❌ `.git/` - Git history
- ❌ `build/` - Build artifacts

## Quick Setup Script

I'll create a helper script to create the minimal ZIP:

```powershell
# create-colab-package.ps1
$required = @(
    "src",
    "remotion", 
    "server/services/remotion-ai-renderer.ts",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "remotion.config.ts"
)

Write-Host "Creating Colab package..." -ForegroundColor Green
Compress-Archive -Path $required -DestinationPath "colab-project.zip" -Force
Write-Host "✅ Created colab-project.zip" -ForegroundColor Green
Write-Host "Upload this file to Colab!" -ForegroundColor Yellow
```

## Summary

**Yes, you need to upload your project**, but you only need:
- Source code files
- Configuration files
- Package files (for npm install)

**You DON'T need:**
- node_modules (installed in Colab)
- Build outputs
- Temporary files

The easiest way is **Option 1: Upload ZIP file**.

