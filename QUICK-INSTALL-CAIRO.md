# Quick Cairo Installation Guide

## Is Cairo Required?

**No, but recommended for best quality.**

The `sketch_animate.py` script works **without Cairo** using a fallback rendering method. However, Cairo provides:
- ✅ Higher quality SVG rendering
- ✅ Better anti-aliasing
- ✅ More accurate path rendering

## Manual Installation (No Admin Required)

### Step 1: Download GTK+ Runtime

1. Visit: https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases
2. Download the latest `gtk3-runtime-*.exe` file
3. Run the installer (you can choose user installation, no admin needed)

### Step 2: Add to PATH (Optional but Recommended)

After installation, add GTK+ bin directory to your PATH:
- Usually located at: `C:\Users\<YourUsername>\AppData\Local\GTK3-Runtime\bin`
- Or: `C:\Program Files\GTK3-Runtime\bin` (if installed system-wide)

### Step 3: Verify

Restart your terminal and run:
```bash
python -c "import cairosvg; cairosvg.svg2png(bytestring=b'<svg></svg>', output_width=10, output_height=10); print('✅ Cairo working!')"
```

## Alternative: Use Without Cairo

The script will automatically use fallback rendering if Cairo is not available. You can test it right now:

```bash
python sketch_animate.py input.png --output test.mp4
```

## Current Status

✅ **Core dependencies installed:**
- OpenCV 4.11.0
- NumPy 2.3.5  
- Pillow 12.0.0
- CairoSVG 2.8.2 (Python package installed, but needs system Cairo library)

⚠️ **Cairo system library:** Not installed (optional - script works without it)

The script is **ready to use** - it will work with fallback rendering. Install Cairo only if you want the highest quality output.

