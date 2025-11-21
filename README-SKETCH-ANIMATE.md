# Sketch Animation Generator

A Python CLI tool that converts Canva-style PNG images into sketch animation MP4 videos using Potrace and FFmpeg streaming.

## Features

- **Preprocessing**: Contrast enhancement, denoising, optional skeletonization
- **Vectorization**: Uses Potrace to convert images to optimized SVG paths
- **Streaming Animation**: Streams frames directly to FFmpeg (no large frame arrays in RAM)
- **Multiple Outputs**: Generates MP4, SVG, cleaned PNG, and JSON metadata
- **Robust**: Handles missing dependencies gracefully with fallbacks

## Requirements

### Required
- **Python 3.8+**
- **Potrace**: Vectorization tool
  - Windows: Download from [Potrace website](http://potrace.sourceforge.net/)
  - Linux: `sudo apt-get install potrace` or `sudo yum install potrace`
  - macOS: `brew install potrace`
- **FFmpeg**: Video encoding
  - The script will try to use FFmpeg from `node_modules/ffmpeg-static` if available
  - Otherwise, install system FFmpeg

### Optional (Recommended)
- **OpenCV** (`opencv-python`): For image preprocessing
  ```bash
  pip install opencv-python
  ```
- **CairoSVG**: For high-quality SVG rendering
  ```bash
  pip install cairosvg
  ```
- **Pillow**: For image processing fallbacks
  ```bash
  pip install pillow
  ```

## Installation

1. Install Python dependencies:
   ```bash
   pip install opencv-python numpy cairosvg pillow
   ```

2. Install Potrace (see Requirements above)

3. Install FFmpeg (or ensure `node_modules/ffmpeg-static` exists)

## Usage

### Basic Usage

```bash
python sketch_animate.py input.png --output output.mp4
```

### Advanced Options

```bash
python sketch_animate.py input.png \
    --output output.mp4 \
    --duration 10 \
    --fps 30 \
    --width 1920 \
    --height 1080 \
    --skeletonize \
    --variant "my_variant" \
    --seed 42
```

### Command-Line Options

- `input`: Input PNG file path (required)
- `--output`, `-o`: Output MP4 file path (required)
- `--duration`: Animation duration in seconds (default: 5.0)
- `--fps`: Frame rate (default: 30)
- `--width`: Output width in pixels (default: 1920)
- `--height`: Output height in pixels (default: 1080)
- `--denoise`: Apply denoising (default: enabled)
- `--no-denoise`: Disable denoising
- `--enhance-contrast`: Enhance contrast (default: enabled)
- `--no-enhance-contrast`: Disable contrast enhancement
- `--skeletonize`: Apply skeletonization (creates thin line art)
- `--variant`: Variant name for metadata (default: "default")
- `--seed`: Random seed for metadata
- `--ffmpeg-path`: Path to FFmpeg binary (auto-detected if not specified)
- `--verbose`, `-v`: Enable verbose logging

## Output Files

The script generates multiple output files:

1. **MP4**: The final animation video
2. **SVG**: Optimized vector graphics from Potrace
3. **PNG**: Cleaned/preprocessed input image
4. **JSON**: Metadata file with processing parameters

Example:
```
output.mp4
output.svg
output_cleaned.png
output_metadata.json
```

## How It Works

1. **Preprocessing**: Enhances contrast, denoises, optionally skeletonizes the input PNG
2. **Conversion**: Converts preprocessed PNG to PBM format
3. **Vectorization**: Runs Potrace to generate optimized SVG paths
4. **Path Parsing**: Extracts ordered stroke paths from SVG
5. **Streaming Animation**: Progressively renders paths and streams frames to FFmpeg via stdin
6. **Output**: Saves MP4, SVG, cleaned PNG, and metadata JSON

## Memory Efficiency

The script uses **FFmpeg streaming** to avoid accumulating large frame arrays in RAM:
- Frames are generated on-the-fly
- Written directly to FFmpeg's stdin
- No intermediate frame storage
- Suitable for long animations and high resolutions

## Troubleshooting

### Potrace not found
- Install Potrace (see Requirements)
- Ensure `potrace` is in your PATH
- On Windows, you may need to add Potrace to PATH manually

### FFmpeg not found
- Install FFmpeg system-wide, OR
- Ensure `node_modules/ffmpeg-static/ffmpeg.exe` exists (Windows)
- Use `--ffmpeg-path` to specify custom location

### OpenCV errors
- Install: `pip install opencv-python`
- Script will work without OpenCV but with limited preprocessing

### CairoSVG errors
- Install: `pip install cairosvg`
- Script will fall back to simple rendering without CairoSVG

## Examples

### Basic sketch animation
```bash
python sketch_animate.py drawing.png --output sketch.mp4
```

### Long animation with skeletonization
```bash
python sketch_animate.py drawing.png \
    --output sketch.mp4 \
    --duration 15 \
    --skeletonize
```

### High-resolution output
```bash
python sketch_animate.py drawing.png \
    --output sketch.mp4 \
    --width 3840 \
    --height 2160 \
    --fps 60
```

## License

See main project license.

