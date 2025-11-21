#!/bin/bash
# Setup script for Pen Sketch Animation local execution (Linux/Mac)

echo "Installing Python dependencies for Pen Sketch Animation..."
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed or not in PATH"
    echo "Please install Python 3.8+ from https://www.python.org/downloads/"
    exit 1
fi

echo "Python found:"
python3 --version
echo ""

# Install dependencies
echo "Installing opencv-python and numpy..."
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements-pen-sketch.txt

if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Failed to install dependencies"
    echo "Try running: python3 -m pip install opencv-python numpy"
    exit 1
fi

echo ""
echo "✅ Dependencies installed successfully!"
echo ""
echo "You can now use local pen sketch animation."

