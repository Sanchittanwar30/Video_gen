#!/usr/bin/env python3
"""
Sketch Animation Script v2 - Optimized contour-based drawing
Converts PNG to animated sketch video using OpenCV contour drawing.
"""

import os
import sys
import cv2
import numpy as np
import subprocess
import argparse
import logging
import json
import tempfile
import shutil
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stderr)
    ]
)
logger = logging.getLogger(__name__)

# Reconfigure stdout for JSON output
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')


class SketchAnimatorV2:
    """Optimized sketch animator using contour-based drawing."""
    
    def __init__(self, config: dict):
        self.config = config
        self.temp_dir = tempfile.mkdtemp(prefix='sketch_animate_')
        self.metadata = {
            'version': '2.0',
            'variant': config.get('variant', 'pen-sketch'),
            'processing_params': {}
        }
        logger.info(f"Temp directory: {self.temp_dir}")
        
        # Find FFmpeg
        self.ffmpeg_cmd = self._find_ffmpeg()
        if self.ffmpeg_cmd:
            logger.info(f"Using FFmpeg from: {self.ffmpeg_cmd}")
    
    def _find_ffmpeg(self):
        """Find FFmpeg executable."""
        # Check node_modules/ffmpeg-static first
        node_ffmpeg = Path(os.getcwd()) / 'node_modules' / 'ffmpeg-static' / 'ffmpeg.exe'
        if node_ffmpeg.exists():
            return str(node_ffmpeg)
        
        # Fall back to system PATH
        return shutil.which('ffmpeg') or 'ffmpeg'
    
    def preprocess_image(self, input_path: str, output_path: str) -> bool:
        """Preprocess image: denoise, contrast, threshold."""
        try:
            logger.info(f"Preprocessing image: {input_path}")
            img = cv2.imread(input_path, cv2.IMREAD_GRAYSCALE)
            if img is None:
                logger.error(f"Failed to read image: {input_path}")
                return False
            
            # Denoise
            img = cv2.fastNlMeansDenoising(img, None, h=10, templateWindowSize=7, searchWindowSize=21)
            logger.info("Applied denoising")
            
            # Enhance contrast
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            img = clahe.apply(img)
            logger.info("Enhanced contrast")
            
            # Optional skeletonization for cleaner strokes
            if self.config.get('skeletonize', False):
                _, binary = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
                kernel = np.ones((3, 3), np.uint8)
                skeleton = np.zeros(binary.shape, np.uint8)
                while True:
                    opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
                    temp = cv2.subtract(binary, opened)
                    eroded = cv2.erode(binary, kernel)
                    skeleton = cv2.bitwise_or(skeleton, temp)
                    binary = eroded.copy()
                    if cv2.countNonZero(binary) == 0:
                        break
                img = cv2.bitwise_not(skeleton)
                logger.info("Applied skeletonization")
            
            # Save
            cv2.imwrite(output_path, img)
            logger.info(f"Saved preprocessed image: {output_path}")
            return True
        except Exception as e:
            logger.error(f"Preprocessing error: {e}")
            return False
    
    def extract_contours(self, cleaned_png: str, width: int, height: int):
        """Extract and cache contours for animation."""
        img = cv2.imread(cleaned_png, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return None, None
        
        # Resize to target dimensions
        img = cv2.resize(img, (width, height), interpolation=cv2.INTER_AREA)
        
        # Threshold to binary
        _, binary = cv2.threshold(img, 127, 255, cv2.THRESH_BINARY_INV)
        
        # Find contours
        contours, hierarchy = cv2.findContours(binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        
        # Sort by area (largest first)
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        
        logger.info(f"Extracted {len(contours)} contours for animation")
        return contours, img
    
    def create_animation(self, input_png: str, output_mp4: str) -> bool:
        """Create stroke-by-stroke animation."""
        try:
            # Step 1: Preprocess
            cleaned_png = os.path.join(self.temp_dir, 'cleaned.png')
            if not self.preprocess_image(input_png, cleaned_png):
                return False
            
            # Step 2: Extract contours
            width = self.config.get('width', 1920)
            height = self.config.get('height', 1080)
            fps = self.config.get('fps', 30)
            duration = self.config.get('duration', 5.0)
            total_frames = int(fps * duration)
            
            contours, cleaned_img = self.extract_contours(cleaned_png, width, height)
            if contours is None:
                logger.error("Failed to extract contours")
                return False
            
            logger.info(f"Generating {total_frames} frames ({duration}s @ {fps}fps)")
            
            # Step 3: Start FFmpeg
            ffmpeg_args = [
                self.ffmpeg_cmd, '-y',
                '-f', 'rawvideo',
                '-vcodec', 'rawvideo',
                '-s', f'{width}x{height}',
                '-pix_fmt', 'rgb24',
                '-r', str(fps),
                '-i', '-',
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-crf', '23',
                '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart',
                output_mp4
            ]
            
            ffmpeg_process = subprocess.Popen(
                ffmpeg_args,
                stdin=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                bufsize=10**8
            )
            
            # Step 4: Generate frames
            import threading
            import queue
            
            stderr_queue = queue.Queue()
            
            def read_stderr():
                try:
                    for line in ffmpeg_process.stderr:
                        stderr_queue.put(line)
                except:
                    pass
            
            threading.Thread(target=read_stderr, daemon=True).start()
            
            # Draw contours progressively
            for frame_idx in range(total_frames):
                # Calculate how many contours to draw
                progress = (frame_idx + 1) / total_frames
                contours_to_draw = int(len(contours) * progress)
                
                # Create white canvas
                canvas = np.ones((height, width, 3), dtype=np.uint8) * 255
                
                # Draw contours one by one (stroke-by-stroke)
                for i in range(contours_to_draw):
                    cv2.drawContours(canvas, contours, i, (0, 0, 0), -1)  # Fill
                    cv2.drawContours(canvas, contours, i, (0, 0, 0), 2)   # Stroke
                
                # Write to FFmpeg
                ffmpeg_process.stdin.write(canvas.tobytes())
                
                if (frame_idx + 1) % 50 == 0 or frame_idx == 0:
                    logger.info(f"Generated {frame_idx + 1}/{total_frames} frames ({(frame_idx + 1)/total_frames*100:.1f}%)")
            
            # Close and wait
            ffmpeg_process.stdin.close()
            logger.info("Waiting for FFmpeg to finish encoding...")
            return_code = ffmpeg_process.wait(timeout=60)
            
            if return_code != 0:
                logger.error(f"FFmpeg failed with code {return_code}")
                return False
            
            logger.info(f"Animation complete: {output_mp4}")
            
            # Copy outputs
            output_dir = Path(output_mp4).parent
            final_png = output_dir / (Path(output_mp4).stem + '_cleaned.png')
            shutil.copy2(cleaned_png, final_png)
            
            # Save metadata
            metadata_path = output_dir / (Path(output_mp4).stem + '_metadata.json')
            self.metadata['contours'] = len(contours)
            with open(metadata_path, 'w') as f:
                json.dump(self.metadata, f, indent=2)
            
            logger.info(f"Output files:")
            logger.info(f"  MP4: {output_mp4}")
            logger.info(f"  PNG: {final_png}")
            logger.info(f"  Metadata: {metadata_path}")
            
            return True
        except Exception as e:
            logger.error(f"Animation error: {e}")
            return False
        finally:
            if os.path.exists(self.temp_dir):
                shutil.rmtree(self.temp_dir, ignore_errors=True)
                logger.info("Cleaned up temp directory")


def main():
    parser = argparse.ArgumentParser(description='Create pen sketch animation from PNG')
    parser.add_argument('input', help='Input PNG file')
    parser.add_argument('--output', required=True, help='Output MP4 file')
    parser.add_argument('--duration', type=float, default=5.0, help='Duration in seconds')
    parser.add_argument('--fps', type=int, default=25, help='Frames per second')
    parser.add_argument('--width', type=int, default=1920, help='Output width')
    parser.add_argument('--height', type=int, default=1080, help='Output height')
    parser.add_argument('--variant', default='pen-sketch', help='Animation variant')
    parser.add_argument('--skeletonize', action='store_true', help='Apply skeletonization')
    
    args = parser.parse_args()
    
    config = {
        'duration': args.duration,
        'fps': args.fps,
        'width': args.width,
        'height': args.height,
        'variant': args.variant,
        'skeletonize': args.skeletonize,
    }
    
    animator = SketchAnimatorV2(config)
    success = animator.create_animation(args.input, args.output)
    
    # Output JSON result to stdout
    result = {
        'success': success,
        'output_path': args.output if success else None,
        'message': 'Animation created successfully' if success else 'Animation failed'
    }
    print(json.dumps(result))
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

