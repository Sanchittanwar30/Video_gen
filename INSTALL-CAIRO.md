# Installing Cairo Library for Windows

CairoSVG requires the Cairo graphics library to be installed on your system. Here are the easiest ways to install it on Windows:

## Option 1: GTK+ Runtime Installer (Recommended - Easiest)

1. **Download GTK+ Runtime:**
   - Go to: https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases
   - Download the latest `gtk3-runtime-*.exe` installer

2. **Install:**
   - Run the installer
   - Accept default installation path (usually `C:\Program Files\GTK3-Runtime`)
   - Complete the installation

3. **Add to PATH (if not automatic):**
   - Add `C:\Program Files\GTK3-Runtime\bin` to your system PATH
   - Or restart your terminal/IDE

4. **Verify:**
   ```bash
   python -c "import cairosvg; print('✅ CairoSVG working!')"
   ```

## Option 2: Chocolatey (If you have it)

```bash
choco install gtk-runtime
```

Then restart your terminal and verify.

## Option 3: Manual DLL Installation

1. Download Cairo DLL from: https://www.gtk.org/download/windows.php
2. Extract `cairo.dll` and dependencies
3. Place in a directory that's in your PATH (e.g., `C:\Windows\System32` or a custom directory)

## Why is Cairo Important?

- **High-quality SVG rendering**: Cairo provides accurate, anti-aliased rendering
- **Better animation quality**: Smooth, professional-looking sketch animations
- **Fallback available**: The script works without Cairo, but with basic rendering

## Current Status

The script will work **without Cairo** using a fallback rendering method, but for best quality, install GTK+ Runtime.

## Quick Test

After installation, test with:
```bash
python -c "import cairosvg; cairosvg.svg2png(bytestring=b'<svg></svg>', output_width=100, output_height=100); print('✅ Cairo working!')"
```

