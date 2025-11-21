#!/usr/bin/env python3
"""
Color Sketch Animation - Fast color-preserving progressive drawing
Animates colored images with stroke-by-stroke appearance while keeping colors.
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
    handlers=[logging.StreamHandler(sys.stderr)]
)
logger = logging.getLogger(__name__)

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')


class ColorSketchAnimator:
    """Fast color-preserving sketch animator."""
    
    def __init__(self, config: dict):
        self.config = config
        self.temp_dir = tempfile.mkdtemp(prefix='sketch_color_')
        self.metadata = {'version': '3.0-color', 'variant': config.get('variant', 'pen-sketch')}
        logger.info(f"Temp directory: {self.temp_dir}")
        
        self.ffmpeg_cmd = self._find_ffmpeg()
        if self.ffmpeg_cmd:
            logger.info(f"Using FFmpeg: {self.ffmpeg_cmd}")
    
    def _find_ffmpeg(self):
        node_ffmpeg = Path(os.getcwd()) / 'node_modules' / 'ffmpeg-static' / 'ffmpeg.exe'
        return str(node_ffmpeg) if node_ffmpeg.exists() else shutil.which('ffmpeg') or 'ffmpeg'
    
    def preprocess_color_image(self, input_path: str, width: int, height: int):
        """Load and preprocess while keeping colors."""
        try:
            logger.info(f"Loading color image: {input_path}")
            img = cv2.imread(input_path, cv2.IMREAD_COLOR)
            if img is None:
                return None, None, None
            
            # Resize to target
            img_resized = cv2.resize(img, (width, height), interpolation=cv2.INTER_AREA)
            
            # Enhance (optional)
            if self.config.get('enhance', True):
                # Convert to LAB for better enhancement
                lab = cv2.cvtColor(img_resized, cv2.COLOR_BGR2LAB)
                l, a, b = cv2.split(lab)
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
                l = clahe.apply(l)
                lab = cv2.merge([l, a, b])
                img_resized = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
                logger.info("Enhanced color image")
            
            # Create edge map for stroke ordering
            gray = cv2.cvtColor(img_resized, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 50, 150)
            
            # Create stroke importance map (edges + density)
            kernel = np.ones((5,5), np.uint8)
            stroke_map = cv2.dilate(edges, kernel, iterations=2)
            
            logger.info(f"Preprocessed color image: {width}x{height}")
            return img_resized, edges, stroke_map
        except Exception as e:
            logger.error(f"Preprocessing error: {e}")
            return None, None, None
    
    def create_color_animation(self, input_png: str, output_mp4: str) -> bool:
        """Create color-preserving stroke animation."""
        try:
            width = self.config.get('width', 1920)
            height = self.config.get('height', 1080)
            fps = self.config.get('fps', 30)
            duration = self.config.get('duration', 5.0)
            total_frames = int(fps * duration)
            
            # Load color image
            img_color, edges, stroke_map = self.preprocess_color_image(input_png, width, height)
            if img_color is None:
                return False
            
            logger.info(f"Generating {total_frames} color frames ({duration}s @ {fps}fps)")
            
            # Find stroke pixels (non-white areas + edges)
            gray = cv2.cvtColor(img_color, cv2.COLOR_BGR2GRAY)
            _, mask = cv2.threshold(gray, 250, 255, cv2.THRESH_BINARY_INV)
            mask = cv2.bitwise_or(mask, stroke_map)
            
            # Get all pixels to draw (y, x coordinates)
            stroke_pixels = np.column_stack(np.where(mask > 0))
            total_pixels = len(stroke_pixels)
            
            if total_pixels == 0:
                logger.warning("No stroke pixels found, using full image")
                stroke_pixels = np.column_stack(np.where(np.ones((height, width), dtype=bool)))
                total_pixels = len(stroke_pixels)
            
            logger.info(f"Found {total_pixels} stroke pixels to animate")
            
            # Sort pixels for natural drawing order (top-left to bottom-right with some randomness)
            # Score = y*0.6 + x*0.4 + small_random (creates diagonal sweep with variation)
            np.random.seed(42)  # Reproducible
            scores = stroke_pixels[:, 0] * 0.6 + stroke_pixels[:, 1] * 0.4 + np.random.randn(total_pixels) * 20
            sorted_indices = np.argsort(scores)
            stroke_pixels = stroke_pixels[sorted_indices]
            
            logger.info("Sorted pixels for natural drawing progression")
            
            # Start FFmpeg
            ffmpeg_args = [
                self.ffmpeg_cmd, '-y',
                '-f', 'rawvideo', '-vcodec', 'rawvideo',
                '-s', f'{width}x{height}', '-pix_fmt', 'rgb24', '-r', str(fps),
                '-i', '-',
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
                '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                output_mp4
            ]
            
            ffmpeg_process = subprocess.Popen(
                ffmpeg_args,
                stdin=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                bufsize=10**8
            )
            
            # Background thread for stderr
            import threading, queue
            stderr_queue = queue.Queue()
            def read_stderr():
                try:
                    for line in ffmpeg_process.stderr:
                        stderr_queue.put(line)
                except: pass
            threading.Thread(target=read_stderr, daemon=True).start()
            
            # Create white background
            white_bg = np.ones((height, width, 3), dtype=np.uint8) * 255
            
            # Generate frames progressively
            logger.info("Generating color frames with progressive drawing...")
            
            for frame_idx in range(total_frames):
                # Calculate pixels to reveal
                progress = (frame_idx + 1) / total_frames
                pixels_to_draw = int(total_pixels * progress)
                
                # Start with white canvas
                canvas = white_bg.copy()
                
                # Draw revealed pixels with their original colors
                if pixels_to_draw > 0:
                    revealed_pixels = stroke_pixels[:pixels_to_draw]
                    ys = revealed_pixels[:, 0]
                    xs = revealed_pixels[:, 1]
                    canvas[ys, xs] = img_color[ys, xs]
                    
                    # Optional: Add slight blur for smoother appearance
                    if frame_idx > 0 and frame_idx % 10 == 0:
                        canvas = cv2.GaussianBlur(canvas, (3, 3), 0)
                
                # Convert BGR to RGB for FFmpeg
                canvas_rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
                
                # Write to FFmpeg
                ffmpeg_process.stdin.write(canvas_rgb.tobytes())
                
                if (frame_idx + 1) % 25 == 0 or frame_idx == 0:
                    logger.info(f"Generated {frame_idx + 1}/{total_frames} frames ({(frame_idx + 1)/total_frames*100:.1f}%)")
            
            # Close and wait
            ffmpeg_process.stdin.close()
            logger.info("Waiting for FFmpeg to finish encoding...")
            return_code = ffmpeg_process.wait(timeout=60)
            
            if return_code != 0:
                stderr_lines = []
                while not stderr_queue.empty():
                    try: stderr_lines.append(stderr_queue.get_nowait().decode('utf-8', errors='ignore'))
                    except: break
                logger.error(f"FFmpeg failed: {''.join(stderr_lines)}")
                return False
            
            logger.info(f"✓ Color animation complete: {output_mp4}")
            
            # Save outputs
            output_dir = Path(output_mp4).parent
            final_png = output_dir / (Path(output_mp4).stem + '_original.png')
            cv2.imwrite(str(final_png), img_color)
            
            metadata_path = output_dir / (Path(output_mp4).stem + '_metadata.json')
            self.metadata['total_pixels'] = int(total_pixels)
            with open(metadata_path, 'w') as f:
                json.dump(self.metadata, f, indent=2)
            
            logger.info(f"Output files:")
            logger.info(f"  MP4: {output_mp4}")
            logger.info(f"  PNG: {final_png}")
            logger.info(f"  Metadata: {metadata_path}")
            
            return True
        except Exception as e:
            logger.error(f"Animation error: {e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            if os.path.exists(self.temp_dir):
                shutil.rmtree(self.temp_dir, ignore_errors=True)
                logger.info("Cleaned up temp directory")


def main():
    parser = argparse.ArgumentParser(description='Create color pen sketch animation')
    parser.add_argument('input', help='Input PNG file')
    parser.add_argument('--output', required=True, help='Output MP4 file')
    parser.add_argument('--duration', type=float, default=5.0, help='Duration in seconds')
    parser.add_argument('--fps', type=int, default=25, help='Frames per second')
    parser.add_argument('--width', type=int, default=1920, help='Output width')
    parser.add_argument('--height', type=int, default=1080, help='Output height')
    parser.add_argument('--variant', default='pen-sketch', help='Animation variant')
    parser.add_argument('--skeletonize', action='store_true', help='Skeletonize (ignored for color)')
    
    args = parser.parse_args()
    
    config = {
        'duration': args.duration,
        'fps': args.fps,
        'width': args.width,
        'height': args.height,
        'variant': args.variant,
        'enhance': True,
    }
    
    animator = ColorSketchAnimator(config)
    success = animator.create_color_animation(args.input, args.output)
    
    result = {
        'success': success,
        'output_path': args.output if success else None,
        'message': 'Color animation created successfully' if success else 'Animation failed'
    }
    print(json.dumps(result))
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

