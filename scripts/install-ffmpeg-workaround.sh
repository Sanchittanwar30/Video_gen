#!/bin/bash
# Script to install system FFmpeg and configure it for Remotion

echo "Installing FFmpeg via Homebrew..."
brew install ffmpeg

echo ""
echo "FFmpeg installed. To use it with Remotion, set the environment variable:"
echo "export FFMPEG_BINARY=/opt/homebrew/bin/ffmpeg"
echo "export FFPROBE_BINARY=/opt/homebrew/bin/ffprobe"
echo ""
echo "Or add to your ~/.zshrc or ~/.bashrc:"
echo "export FFMPEG_BINARY=/opt/homebrew/bin/ffmpeg"
echo "export FFPROBE_BINARY=/opt/homebrew/bin/ffprobe"

