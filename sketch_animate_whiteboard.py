#!/usr/bin/env python3
"""
Whiteboard Animation Style - Path-based stroke drawing
Draws along actual contours/strokes like hand-drawn whiteboard videos.
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


class WhiteboardAnimator:
    """Professional whiteboard-style animation with stroke-by-stroke path drawing."""
    
    def __init__(self, config: dict):
        self.config = config
        self.temp_dir = tempfile.mkdtemp(prefix='sketch_wb_')
        self.metadata = {'version': '6.2-noise-filtered', 'variant': config.get('variant', 'pen-sketch')}
        logger.info(f"Temp directory: {self.temp_dir}")
        
        self.ffmpeg_cmd = self._find_ffmpeg()
        if self.ffmpeg_cmd:
            logger.info(f"Using FFmpeg: {self.ffmpeg_cmd}")
    
    def _find_ffmpeg(self):
        node_ffmpeg = Path(os.getcwd()) / 'node_modules' / 'ffmpeg-static' / 'ffmpeg.exe'
        return str(node_ffmpeg) if node_ffmpeg.exists() else shutil.which('ffmpeg') or 'ffmpeg'
    
    
    
    def extract_drawing_strokes(self, input_path: str, width: int, height: int):
        """Extract outlines and color regions separately for two-pass drawing."""
        try:
            logger.info(f"Extracting drawing strokes from: {input_path}")
            img = cv2.imread(input_path, cv2.IMREAD_COLOR)
            if img is None:
                return None, None, None
            
            # Resize
            img_resized = cv2.resize(img, (width, height), interpolation=cv2.INTER_AREA)
            
            # Enhance colors (balanced)
            lab = cv2.cvtColor(img_resized, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            # Moderate contrast enhancement
            clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8,8))
            l = clahe.apply(l)
            lab = cv2.merge([l, a, b])
            img_enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
            
            # Convert to grayscale
            gray = cv2.cvtColor(img_enhanced, cv2.COLOR_BGR2GRAY)
            
            # Pre-process: Denoise to remove background artifacts
            gray_clean = cv2.fastNlMeansDenoising(gray, None, h=10, templateWindowSize=7, searchWindowSize=21)
            
            # Apply bilateral filter for edge-preserving smoothing
            gray_clean = cv2.bilateralFilter(gray_clean, 5, 50, 50)
            
            # ===== PASS 1: Extract OUTLINES (edges) =====
            # Use higher thresholds to avoid picking up noise
            edges = cv2.Canny(gray_clean, 70, 180)
            
            # Clean up edges - remove noise
            kernel = np.ones((2,2), np.uint8)
            edges_clean = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
            
            # Find edge contours
            edge_contours, _ = cv2.findContours(edges_clean, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
            
            # Sort by Y coordinate (top to bottom)
            def contour_top(cnt):
                M = cv2.moments(cnt)
                if M['m00'] != 0:
                    cy = M['m01'] / M['m00']
                else:
                    cy = 0
                return cy  # Pure top-to-bottom
            
            edge_contours = sorted(edge_contours, key=contour_top)
            
            # Filter out tiny noise contours (be more aggressive)
            min_edge_area = 50  # Increased from 5 to filter background noise
            edge_contours = [cnt for cnt in edge_contours if cv2.contourArea(cnt) >= min_edge_area]
            
            # ===== PASS 2: Extract COLOR REGIONS (fills) =====
            _, binary = cv2.threshold(gray_clean, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            
            # Clean up binary mask
            binary_clean = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
            binary_clean = cv2.morphologyEx(binary_clean, cv2.MORPH_CLOSE, kernel, iterations=1)
            
            # Find color region contours
            color_contours, hierarchy = cv2.findContours(binary_clean, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
            
            # Sort by Y coordinate (top to bottom)
            color_contours = sorted(color_contours, key=contour_top)
            
            # Filter out tiny noise regions (be more aggressive)
            min_color_area = 100  # Increased from 15 to filter background noise
            color_contours = [cnt for cnt in color_contours if cv2.contourArea(cnt) >= min_color_area]
            
            logger.info(f"Extracted {len(edge_contours)} outline strokes and {len(color_contours)} color regions")
            
            # Create outline stroke paths (for pass 1)
            # Use moderate approximation to smooth out noise while keeping detail
            outline_paths = []
            for contour in edge_contours:
                epsilon = 0.003 * cv2.arcLength(contour, True)  # Balanced approximation
                approx = cv2.approxPolyDP(contour, epsilon, True)
                points = [(int(p[0][0]), int(p[0][1])) for p in approx]
                # Require at least 3 points to avoid single-point noise
                if len(points) >= 3:
                    outline_paths.append(points)
            
            # Create color fill data (for pass 2)
            color_fills = []
            for contour in color_contours:
                color_fills.append(contour)
            
            logger.info(f"Created {len(outline_paths)} outline paths and {len(color_fills)} color fills")
            return img_enhanced, outline_paths, color_fills
        except Exception as e:
            logger.error(f"Stroke extraction error: {e}")
            return None, None
    
    def draw_hand_cursor(self, canvas, x, y, frame_idx):
        """Draw simple animated marker cursor."""
        # Gentle pulsing effect
        pulse = 0.85 + 0.15 * np.sin(frame_idx * 0.2)
        size = int(20 * pulse)
        
        # Simple marker cursor with shadow
        # Shadow
        cv2.circle(canvas, (x+2, y+2), size, (180, 180, 180), -1, cv2.LINE_AA)
        # Main cursor (blue marker)
        cv2.circle(canvas, (x, y), size, (50, 150, 255), -1, cv2.LINE_AA)
        
        return canvas
    
    def create_whiteboard_animation(self, input_png: str, output_mp4: str) -> bool:
        """Create whiteboard-style stroke animation."""
        try:
            width = self.config.get('width', 1920)
            height = self.config.get('height', 1080)
            fps = self.config.get('fps', 30)
            duration = self.config.get('duration', 5.0)
            total_frames = int(fps * duration)
            
            # Extract strokes (two-pass: outlines + colors)
            img_color, outline_paths, color_fills = self.extract_drawing_strokes(input_png, width, height)
            if img_color is None or (not outline_paths and not color_fills):
                logger.error("Failed to extract strokes")
                return False
            
            logger.info(f"Creating {total_frames} frame whiteboard animation ({duration}s @ {fps}fps)")
            
            # Two-pass animation + final hold:
            # Pass 1 (first 50% of frames): Draw outlines (top to bottom)
            # Pass 2 (next 35% of frames): Fill colors (top to bottom)
            # Pass 3 (last 15% of frames): Show complete original image
            
            outline_frames = int(total_frames * 0.50)
            color_frames = int(total_frames * 0.35)
            hold_frames = total_frames - outline_frames - color_frames
            
            # Calculate points/fills per frame for each pass
            total_outline_points = sum(len(path) for path in outline_paths) if outline_paths else 1
            total_color_fills = len(color_fills) if color_fills else 1
            
            outline_points_per_frame = max(1, total_outline_points / max(1, outline_frames))
            color_fills_per_frame = max(1, total_color_fills / max(1, color_frames))
            
            logger.info(f"Pass 1: Drawing {len(outline_paths)} outlines over {outline_frames} frames")
            logger.info(f"Pass 2: Filling {len(color_fills)} colors over {color_frames} frames")
            logger.info(f"Pass 3: Holding complete image for {hold_frames} frames")
            
            # Start FFmpeg
            ffmpeg_args = [
                self.ffmpeg_cmd, '-y',
                '-f', 'rawvideo', '-vcodec', 'rawvideo',
                '-s', f'{width}x{height}', '-pix_fmt', 'rgb24', '-r', str(fps),
                '-i', '-',
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',  # Good quality/speed balance
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
            
            # Create clean white background
            white_bg = np.ones((height, width, 3), dtype=np.uint8) * 255
            
            # Stroke thickness (balanced for visibility)
            outline_thickness = 3  # Good balance for clean lines
            
            logger.info("Generating frames with two-pass drawing (outlines then colors)...")
            
            # Generate frames
            for frame_idx in range(total_frames):
                # Start with white canvas
                canvas = white_bg.copy()
                cursor_x, cursor_y = width // 2, height // 2
                
                # ===== PASS 1: Draw outlines (first 60% of frames) =====
                if frame_idx < outline_frames and outline_paths:
                    # Calculate outline drawing progress (linear for consistent speed)
                    outline_progress = (frame_idx + 1) / outline_frames
                    target_outline_points = int(total_outline_points * outline_progress)
                    
                    # Draw outline strokes progressively
                    drawn_points = 0
                    for stroke_path in outline_paths:
                        if drawn_points + len(stroke_path) <= target_outline_points:
                            # Draw complete stroke (clean black line)
                            for i in range(len(stroke_path) - 1):
                                pt1, pt2 = stroke_path[i], stroke_path[i + 1]
                                # Main outline (black, anti-aliased for smooth edges)
                                cv2.line(canvas, pt1, pt2, (0, 0, 0), outline_thickness, cv2.LINE_AA)
                            drawn_points += len(stroke_path)
                            cursor_x, cursor_y = stroke_path[-1]
                        elif drawn_points < target_outline_points:
                            # Draw partial stroke
                            points_to_draw = target_outline_points - drawn_points
                            for i in range(min(points_to_draw - 1, len(stroke_path) - 1)):
                                pt1, pt2 = stroke_path[i], stroke_path[i + 1]
                                # Main outline
                                cv2.line(canvas, pt1, pt2, (0, 0, 0), outline_thickness, cv2.LINE_AA)
                            cursor_x, cursor_y = stroke_path[min(points_to_draw, len(stroke_path) - 1)]
                            break
                        else:
                            break
                    
                    # Draw cursor during outline pass
                    canvas = self.draw_hand_cursor(canvas, cursor_x, cursor_y, frame_idx)
                
                # ===== PASS 2: Fill colors (last 40% of frames) =====
                elif frame_idx >= outline_frames and color_fills:
                    # First, draw ALL outlines (completed)
                    for stroke_path in outline_paths:
                        for i in range(len(stroke_path) - 1):
                            pt1, pt2 = stroke_path[i], stroke_path[i + 1]
                            # Main outline (clean black, anti-aliased)
                            cv2.line(canvas, pt1, pt2, (0, 0, 0), outline_thickness, cv2.LINE_AA)
                    
                    # Calculate color fill progress (linear for consistent speed)
                    color_frame_idx = frame_idx - outline_frames
                    color_progress = (color_frame_idx + 1) / color_frames
                    fills_to_draw = int(total_color_fills * color_progress)
                    
                    # Draw color fills progressively (top to bottom)
                    for i in range(min(fills_to_draw, len(color_fills))):
                        contour = color_fills[i]
                        
                        # Create mask for this fill region
                        mask = np.zeros((height, width), dtype=np.uint8)
                        cv2.drawContours(mask, [contour], 0, 255, -1)
                        
                        # Apply original colors from image
                        canvas[mask > 0] = img_color[mask > 0]
                        
                        # Update cursor position to center of filled region
                        M = cv2.moments(contour)
                        if M['m00'] != 0:
                            cursor_x = int(M['m10'] / M['m00'])
                            cursor_y = int(M['m01'] / M['m00'])
                    
                    # Draw cursor during fill pass
                    if fills_to_draw < total_color_fills:
                        canvas = self.draw_hand_cursor(canvas, cursor_x, cursor_y, frame_idx)
                
                # ===== PASS 3: Show complete original image (final hold) =====
                else:
                    # Show the COMPLETE original image for full resemblance
                    # No approximations, no missing details
                    canvas = img_color.copy()
                    
                    # Optional: Add subtle "completion" effect on first hold frame
                    if frame_idx == outline_frames + color_frames:
                        logger.info("Transition to complete image hold")
                
                # Convert BGR to RGB and write frame
                canvas_rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
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
            
            logger.info(f"✓ Whiteboard animation complete: {output_mp4}")
            
            # Save outputs
            output_dir = Path(output_mp4).parent
            final_png = output_dir / (Path(output_mp4).stem + '_original.png')
            cv2.imwrite(str(final_png), img_color)
            
            metadata_path = output_dir / (Path(output_mp4).stem + '_metadata.json')
            self.metadata['outline_strokes'] = len(outline_paths)
            self.metadata['color_fills'] = len(color_fills)
            self.metadata['outline_frames'] = outline_frames
            self.metadata['color_frames'] = color_frames
            self.metadata['hold_frames'] = hold_frames
            self.metadata['style'] = 'whiteboard-two-pass-hold'
            self.metadata['guarantees_full_resemblance'] = True
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
    parser = argparse.ArgumentParser(description='Create whiteboard-style animation')
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
    
    animator = WhiteboardAnimator(config)
    success = animator.create_whiteboard_animation(args.input, args.output)
    
    result = {
        'success': success,
        'output_path': args.output if success else None,
        'message': 'Whiteboard animation created' if success else 'Animation failed'
    }
    print(json.dumps(result))
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

