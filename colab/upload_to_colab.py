#!/usr/bin/env python3
"""
Script to prepare and upload project files to Google Colab.
This script creates a minimal package with only necessary files for rendering.
"""

import os
import json
import zipfile
import shutil
from pathlib import Path

def create_colab_package(output_dir='colab-package'):
    """Create a minimal package for Colab with only necessary files."""
    
    # Create output directory
    package_dir = Path(output_dir)
    package_dir.mkdir(exist_ok=True)
    
    # Files and directories to include
    include_patterns = [
        'package.json',
        'package-lock.json',
        'tsconfig.json',
        'remotion.config.ts',
        'src/',
        'remotion/',
        'server/services/remotion-ai-renderer.ts',
        'server/services/storage.ts',
        'public/',
        'node_modules/',  # Optional: can be excluded and installed in Colab
    ]
    
    # Files to exclude
    exclude_patterns = [
        'node_modules/.cache',
        'node_modules/.bin',
        '*.log',
        '.git',
        'output/',
        'temp/',
        'build/',
        '.env',
        '.env.local',
    ]
    
    print(f"Creating Colab package in {package_dir}...")
    
    # Copy files
    for pattern in include_patterns:
        src = Path(pattern)
        if src.exists():
            dst = package_dir / pattern
            if src.is_dir():
                shutil.copytree(src, dst, dirs_exist_ok=True, ignore=shutil.ignore_patterns(*exclude_patterns))
            else:
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst)
            print(f"  ✓ {pattern}")
    
    # Create a requirements file for Colab
    requirements = {
        "node_version": "20",
        "ffmpeg": True,
        "chromium": True,
    }
    
    with open(package_dir / 'colab-requirements.json', 'w') as f:
        json.dump(requirements, f, indent=2)
    
    print(f"\nPackage created in {package_dir}/")
    print("Next steps:")
    print("1. Zip the package: zip -r colab-package.zip colab-package/")
    print("2. Upload to Google Colab")
    print("3. Or use git clone if your project is in a repository")
    
    return package_dir

def create_video_plan_template():
    """Create a template for video plan JSON."""
    template = {
        "frames": [
            {
                "id": "frame-1",
                "type": "whiteboard_diagram",
                "duration": 18,
                "text": "Example frame",
                "animate": True,
                "vectorized": {
                    "svgUrl": "/assets/vectorized/example.svg"
                }
            }
        ]
    }
    
    with open('video-plan-template.json', 'w') as f:
        json.dump(template, f, indent=2)
    
    print("Created video-plan-template.json")

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'template':
        create_video_plan_template()
    else:
        create_colab_package()

