#!/usr/bin/env python3
"""
Highlighting Style Animation - Like educational apps (Golpo AI style)
Animates with marker/highlighter effect, drawing cursor, and glow.
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

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stderr)]
)
logger = logging.getLogger(__name__)

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')


class HighlightAnimator:
    """Educational-style highlighting animation with marker cursor."""
    
    def __init__(self, config: dict):
        self.config = config
        self.temp_dir = tempfile.mkdtemp(prefix='sketch_highlight_')
        self.metadata = {'version': '4.0-highlight', 'variant': config.get('variant', 'pen-sketch')}
        logger.info(f"Temp directory: {self.temp_dir}")
        
        self.ffmpeg_cmd = self._find_ffmpeg()
        if self.ffmpeg_cmd:
            logger.info(f"Using FFmpeg: {self.ffmpeg_cmd}")
    
    def _find_ffmpeg(self):
        node_ffmpeg = Path(os.getcwd()) / 'node_modules' / 'ffmpeg-static' / 'ffmpeg.exe'
        return str(node_ffmpeg) if node_ffmpeg.exists() else shutil.which('ffmpeg') or 'ffmpeg'
    
    def preprocess_image(self, input_path: str, width: int, height: int):
        """Load and enhance image."""
        try:
            logger.info(f"Loading image: {input_path}")
            img = cv2.imread(input_path, cv2.IMREAD_COLOR)
            if img is None:
                return None
            
            # Resize
            img_resized = cv2.resize(img, (width, height), interpolation=cv2.INTER_AREA)
            
            # Enhance colors
            lab = cv2.cvtColor(img_resized, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
            l = clahe.apply(l)
            lab = cv2.merge([l, a, b])
            img_enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
            
            # Create edge map for stroke path
            gray = cv2.cvtColor(img_enhanced, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 50, 150)
            
            # Dilate edges for thicker highlighting strokes
            kernel = np.ones((5,5), np.uint8)
            stroke_map = cv2.dilate(edges, kernel, iterations=3)
            
            logger.info(f"Preprocessed image: {width}x{height}")
            return img_enhanced, edges, stroke_map
        except Exception as e:
            logger.error(f"Preprocessing error: {e}")
            return None, None, None
    
    def create_highlight_animation(self, input_png: str, output_mp4: str) -> bool:
        """Create highlighting-style animation with marker cursor."""
        try:
            width = self.config.get('width', 1920)
            height = self.config.get('height', 1080)
            fps = self.config.get('fps', 30)
            duration = self.config.get('duration', 5.0)
            total_frames = int(fps * duration)
            
            # Load and process image
            img_color, edges, stroke_map = self.preprocess_image(input_png, width, height)
            if img_color is None:
                return False
            
            logger.info(f"Generating {total_frames} frames with highlighting effect ({duration}s @ {fps}fps)")
            
            # Find all pixels to draw (prioritize edges and colored areas)
            gray = cv2.cvtColor(img_color, cv2.COLOR_BGR2GRAY)
            _, content_mask = cv2.threshold(gray, 250, 255, cv2.THRESH_BINARY_INV)
            
            # Combine edges and content
            drawing_mask = cv2.bitwise_or(content_mask, stroke_map)
            
            # Get pixel coordinates
            stroke_pixels = np.column_stack(np.where(drawing_mask > 0))
            total_pixels = len(stroke_pixels)
            
            if total_pixels == 0:
                logger.warning("No content found, using full image")
                stroke_pixels = np.column_stack(np.where(np.ones((height, width), dtype=bool)))
                total_pixels = len(stroke_pixels)
            
            logger.info(f"Found {total_pixels} pixels to animate")
            
            # Sort for natural drawing path (diagonal with some clustering)
            np.random.seed(42)
            
            # Create drawing path: left-to-right, top-to-bottom with local clustering
            scores = (stroke_pixels[:, 0] * 0.5 +  # Y coordinate (top to bottom)
                     stroke_pixels[:, 1] * 0.5 +   # X coordinate (left to right)
                     np.random.randn(total_pixels) * 30)  # Local variation for clustering
            
            sorted_indices = np.argsort(scores)
            stroke_pixels = stroke_pixels[sorted_indices]
            
            logger.info("Created natural drawing path")
            
            # Start FFmpeg
            ffmpeg_args = [
                self.ffmpeg_cmd, '-y',
                '-f', 'rawvideo', '-vcodec', 'rawvideo',
                '-s', f'{width}x{height}', '-pix_fmt', 'rgb24', '-r', str(fps),
                '-i', '-',
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',  # Higher quality
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
            
            # Background stderr reader
            import threading, queue
            stderr_queue = queue.Queue()
            def read_stderr():
                try:
                    for line in ffmpeg_process.stderr:
                        stderr_queue.put(line)
                except: pass
            threading.Thread(target=read_stderr, daemon=True).start()
            
            # Create base layers
            white_bg = np.ones((height, width, 3), dtype=np.uint8) * 255
            
            # Highlighting effect parameters
            highlight_trail_frames = int(fps * 0.3)  # 0.3 second glow trail
            cursor_size = 25  # Drawing cursor size
            
            logger.info("Generating frames with highlighting effect...")
            
            # Generate frames
            for frame_idx in range(total_frames):
                progress = (frame_idx + 1) / total_frames
                pixels_drawn = int(total_pixels * progress)
                
                # Start with white canvas
                canvas = white_bg.copy()
                
                # Draw all revealed pixels
                if pixels_drawn > 0:
                    revealed = stroke_pixels[:pixels_drawn]
                    ys, xs = revealed[:, 0], revealed[:, 1]
                    canvas[ys, xs] = img_color[ys, xs]
                    
                    # Add highlighting glow effect on recently drawn pixels
                    # Create glow for last N pixels (trailing highlighter effect)
                    glow_start = max(0, pixels_drawn - highlight_trail_frames * 50)
                    if pixels_drawn > glow_start:
                        recent_pixels = stroke_pixels[glow_start:pixels_drawn]
                        
                        # Create glow mask
                        glow_mask = np.zeros((height, width), dtype=np.float32)
                        
                        for i, (py, px) in enumerate(recent_pixels):
                            # Fade from strong to weak
                            age = len(recent_pixels) - i
                            intensity = min(1.0, age / (highlight_trail_frames * 10))
                            
                            # Draw glow circle
                            cv2.circle(glow_mask, (px, py), 8, intensity, -1)
                        
                        # Apply glow (brighten colors)
                        glow_mask = cv2.GaussianBlur(glow_mask, (21, 21), 0)
                        glow_mask = glow_mask[:, :, np.newaxis]
                        
                        # Brighten with warm glow
                        glow_color = np.array([20, 30, 50], dtype=np.float32)  # Warm yellow-orange glow
                        canvas = canvas.astype(np.float32)
                        canvas += glow_mask * glow_color
                        canvas = np.clip(canvas, 0, 255).astype(np.uint8)
                    
                    # Draw animated cursor/marker at current position
                    if pixels_drawn < total_pixels:
                        cursor_y, cursor_x = stroke_pixels[pixels_drawn]
                        
                        # Pulsing cursor effect
                        pulse = 0.8 + 0.2 * np.sin(frame_idx * 0.3)
                        cursor_radius = int(cursor_size * pulse)
                        
                        # Draw cursor as semi-transparent circle
                        overlay = canvas.copy()
                        cv2.circle(overlay, (cursor_x, cursor_y), cursor_radius, 
                                 (100, 150, 255), -1)  # Blue marker cursor
                        cv2.circle(overlay, (cursor_x, cursor_y), cursor_radius, 
                                 (50, 100, 200), 3)  # Darker border
                        
                        # Blend cursor with canvas (semi-transparent)
                        alpha = 0.4
                        canvas = cv2.addWeighted(canvas, 1-alpha, overlay, alpha, 0)
                
                # Convert BGR to RGB for FFmpeg
                canvas_rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
                
                # Write frame
                ffmpeg_process.stdin.write(canvas_rgb.tobytes())
                
                if (frame_idx + 1) % 25 == 0 or frame_idx == 0:
                    logger.info(f"Generated {frame_idx + 1}/{total_frames} frames ({(frame_idx + 1)/total_frames*100:.1f}%)")
            
            # Finalize
            ffmpeg_process.stdin.close()
            logger.info("Waiting for FFmpeg to finish...")
            return_code = ffmpeg_process.wait(timeout=60)
            
            if return_code != 0:
                stderr_lines = []
                while not stderr_queue.empty():
                    try: stderr_lines.append(stderr_queue.get_nowait().decode('utf-8', errors='ignore'))
                    except: break
                logger.error(f"FFmpeg failed: {''.join(stderr_lines)}")
                return False
            
            logger.info(f"✓ Highlighting animation complete: {output_mp4}")
            
            # Save outputs
            output_dir = Path(output_mp4).parent
            final_png = output_dir / (Path(output_mp4).stem + '_original.png')
            cv2.imwrite(str(final_png), img_color)
            
            metadata_path = output_dir / (Path(output_mp4).stem + '_metadata.json')
            self.metadata['total_pixels'] = int(total_pixels)
            self.metadata['style'] = 'highlighting'
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
    parser = argparse.ArgumentParser(description='Create highlighting-style animation')
    parser.add_argument('input', help='Input PNG file')
    parser.add_argument('--output', required=True, help='Output MP4 file')
    parser.add_argument('--duration', type=float, default=5.0, help='Duration in seconds')
    parser.add_argument('--fps', type=int, default=25, help='Frames per second')
    parser.add_argument('--width', type=int, default=1920, help='Output width')
    parser.add_argument('--height', type=int, default=1080, help='Output height')
    parser.add_argument('--variant', default='pen-sketch', help='Animation variant')
    parser.add_argument('--skeletonize', action='store_true', help='Skeletonize (ignored)')
    
    args = parser.parse_args()
    
    config = {
        'duration': args.duration,
        'fps': args.fps,
        'width': args.width,
        'height': args.height,
        'variant': args.variant,
    }
    
    animator = HighlightAnimator(config)
    success = animator.create_highlight_animation(args.input, args.output)
    
    result = {
        'success': success,
        'output_path': args.output if success else None,
        'message': 'Highlighting animation created' if success else 'Animation failed'
    }
    print(json.dumps(result))
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

