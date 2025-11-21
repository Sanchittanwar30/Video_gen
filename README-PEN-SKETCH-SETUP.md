# Pen Sketch Animation - Local Setup Guide

## Python Version Requirements

**Recommended: Python 3.8 - 3.12**

Python 3.13+ (including 3.14) may not have pre-built wheels for numpy, which requires a C compiler to build from source.

## Quick Setup

### Option 1: Automatic Setup (Windows)
```bash
scripts\setup-pen-sketch.bat
```

### Option 2: Manual Installation

1. **Check your Python version:**
   ```bash
   python --version
   ```
   
   If you have Python 3.13+, consider using Python 3.11 or 3.12 instead.

2. **Install dependencies:**
   ```bash
   pip install -r requirements-pen-sketch.txt
   ```

3. **If installation fails (no pre-built wheels):**
   
   **Option A: Use Python 3.11 or 3.12**
   - Download from https://www.python.org/downloads/
   - Install and use that version instead
   
   **Option B: Install Visual Studio Build Tools (Windows)**
   - Download: https://visualstudio.microsoft.com/downloads/
   - Install "Desktop development with C++" workload
   - Then retry: `pip install -r requirements-pen-sketch.txt`

## Verify Installation

Test that dependencies are installed:
```bash
python -c "import cv2; import numpy; print('✅ Dependencies installed!')"
```

## Troubleshooting

### Error: "ModuleNotFoundError: No module named 'cv2'"
- Run: `pip install opencv-python`

### Error: "No module named 'numpy'"
- Run: `pip install numpy`
- If it fails, you may need Python 3.11/3.12 or Visual Studio Build Tools

### Error: "Unknown compiler" when installing numpy
- You're using Python 3.13+ without pre-built wheels
- Solution: Use Python 3.11 or 3.12, or install Visual Studio Build Tools

## Usage

Once dependencies are installed, the pen sketch animation will run locally automatically (no Colab needed).

