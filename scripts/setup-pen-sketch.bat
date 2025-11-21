@echo off
REM Setup script for Pen Sketch Animation local execution (Windows)
echo Installing Python dependencies for Pen Sketch Animation...
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/downloads/
    pause
    exit /b 1
)

echo Python found:
python --version
echo.

REM Install dependencies
echo Installing opencv-python and numpy...
python -m pip install --upgrade pip
python -m pip install -r requirements-pen-sketch.txt

if errorlevel 1 (
    echo.
    echo ERROR: Failed to install dependencies
    echo Try running: python -m pip install opencv-python numpy
    pause
    exit /b 1
)

echo.
echo ✅ Dependencies installed successfully!
echo.
echo You can now use local pen sketch animation.
pause

