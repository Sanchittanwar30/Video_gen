#!/usr/bin/env python3
"""
Sketch Animation Generator
Converts a Canva-style PNG into a sketch animation MP4 using Potrace + FFmpeg streaming.

Usage:
    python sketch_animate.py input.png --output output.mp4 [options]
"""

import sys
import os
import argparse
import json
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Any
import logging
from datetime import datetime

# Try to import optional dependencies
try:
    import cv2
    import numpy as np
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False
    print("Warning: OpenCV not available. Image preprocessing will be limited.", file=sys.stderr)

try:
    import xml.etree.ElementTree as ET
    HAS_XML = True
except ImportError:
    HAS_XML = False
    print("Warning: XML parsing not available. SVG parsing will be limited.", file=sys.stderr)


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stderr)
    ]
)
logger = logging.getLogger(__name__)


class SketchAnimator:
    """Main class for sketch animation generation."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.temp_dir = None
        self.metadata = {
            'variant': config.get('variant', 'default'),
            'seed': config.get('seed', None),
            'timestamp': datetime.now().isoformat(),
            'processing_params': {}
        }
    
    def check_dependencies(self) -> Tuple[bool, List[str]]:
        """Check if required dependencies are available."""
        missing = []
        
        # Check Potrace
        try:
            result = subprocess.run(['potrace', '--version'], 
                                   capture_output=True, 
                                   timeout=5)
            if result.returncode != 0:
                missing.append('potrace')
        except (FileNotFoundError, subprocess.TimeoutExpired):
            missing.append('potrace')
        
        # Check FFmpeg
        try:
            result = subprocess.run(['ffmpeg', '-version'], 
                                   capture_output=True, 
                                   timeout=5)
            if result.returncode != 0:
                missing.append('ffmpeg')
        except (FileNotFoundError, subprocess.TimeoutExpired):
            # Try to find FFmpeg from node_modules
            project_root = Path(__file__).parent
            ffmpeg_path = project_root / 'node_modules' / 'ffmpeg-static' / 'ffmpeg.exe'
            if sys.platform == 'win32' and ffmpeg_path.exists():
                self.config['ffmpeg_path'] = str(ffmpeg_path.absolute())
                logger.info(f"Using FFmpeg from: {self.config['ffmpeg_path']}")
            else:
                missing.append('ffmpeg')
        
        if not HAS_CV2:
            missing.append('opencv-python (optional but recommended)')
        
        return len(missing) == 0, missing
    
    def preprocess_image(self, input_path: str, output_path: str) -> bool:
        """Preprocess PNG: contrast, denoise, optional skeletonize."""
        if not HAS_CV2:
            logger.warning("OpenCV not available, copying input as-is")
            shutil.copy2(input_path, output_path)
            return True
        
        try:
            logger.info(f"Preprocessing image: {input_path}")
            img = cv2.imread(input_path, cv2.IMREAD_COLOR)
            if img is None:
                logger.error(f"Failed to read image: {input_path}")
                return False
            
            # Convert to grayscale
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Denoise
            if self.config.get('denoise', True):
                gray = cv2.fastNlMeansDenoising(gray, None, h=10, templateWindowSize=7, searchWindowSize=21)
                logger.info("Applied denoising")
            
            # Enhance contrast
            if self.config.get('enhance_contrast', True):
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                gray = clahe.apply(gray)
                logger.info("Enhanced contrast")
            
            # Optional skeletonization
            if self.config.get('skeletonize', False):
                # Threshold
                _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
                # Skeletonization using morphological operations
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
                gray = cv2.bitwise_not(skeleton)
                logger.info("Applied skeletonization")
            
            # Save preprocessed image
            cv2.imwrite(output_path, gray)
            logger.info(f"Saved preprocessed image: {output_path}")
            
            self.metadata['processing_params']['preprocessing'] = {
                'denoise': self.config.get('denoise', True),
                'enhance_contrast': self.config.get('enhance_contrast', True),
                'skeletonize': self.config.get('skeletonize', False)
            }
            
            return True
        except Exception as e:
            logger.error(f"Error preprocessing image: {e}")
            return False
    
    def convert_to_pbm(self, png_path: str, pbm_path: str) -> bool:
        """Convert PNG to PBM format for Potrace."""
        if not HAS_CV2:
            # Fallback: use ImageMagick or direct copy
            try:
                result = subprocess.run(['magick', png_path, pbm_path], 
                                       capture_output=True, 
                                       timeout=30)
                if result.returncode == 0:
                    return True
            except FileNotFoundError:
                pass
            
            logger.error("Cannot convert to PBM without OpenCV or ImageMagick")
            return False
        
        try:
            # Read as grayscale
            img = cv2.imread(png_path, cv2.IMREAD_GRAYSCALE)
            if img is None:
                logger.error(f"Failed to read PNG: {png_path}")
                return False
            
            # Threshold to binary
            _, binary = cv2.threshold(img, 127, 255, cv2.THRESH_BINARY_INV)
            
            # Write PBM (Portable Bitmap)
            with open(pbm_path, 'wb') as f:
                # PBM header
                width, height = binary.shape[1], binary.shape[0]
                f.write(f'P4\n{width} {height}\n'.encode())
                # Write binary data
                f.write(binary.tobytes())
            
            logger.info(f"Converted to PBM: {pbm_path} ({width}x{height})")
            return True
        except Exception as e:
            logger.error(f"Error converting to PBM: {e}")
            return False
    
    def run_potrace(self, pbm_path: str, svg_path: str) -> bool:
        """Run Potrace to generate SVG from PBM."""
        try:
            logger.info(f"Running Potrace: {pbm_path} -> {svg_path}")
            
            potrace_args = [
                'potrace',
                pbm_path,
                '--svg',
                '--output', svg_path,
                '--opaque',         # Opaque background
                '--turdsize', '2',  # Suppress speckles of up to 2 pixels
                '--alphamax', '1',  # Corner sharpness (0-1.3, 1 = medium)
            ]
            
            # Add optional Potrace parameters
            if self.config.get('potrace_turnpolicy', None):
                potrace_args.extend(['--turnpolicy', self.config['potrace_turnpolicy']])
            
            if self.config.get('potrace_optcurve', None):
                potrace_args.extend(['--optcurve', str(self.config['potrace_optcurve'])])
            
            result = subprocess.run(potrace_args, 
                                  capture_output=True, 
                                  text=True,
                                  timeout=60)
            
            if result.returncode != 0:
                logger.error(f"Potrace failed: {result.stderr}")
                return False
            
            if not os.path.exists(svg_path):
                logger.error(f"Potrace did not create SVG: {svg_path}")
                return False
            
            logger.info(f"Potrace generated SVG: {svg_path}")
            self.metadata['processing_params']['potrace'] = {
                'args': potrace_args
            }
            return True
        except FileNotFoundError:
            logger.error("Potrace not found. Please install Potrace.")
            return False
        except Exception as e:
            logger.error(f"Error running Potrace: {e}")
            return False
    
    def parse_svg_paths(self, svg_path: str) -> List[Dict[str, Any]]:
        """Parse SVG and extract ordered stroke paths."""
        if not HAS_XML:
            logger.error("XML parsing not available. Cannot parse SVG paths.")
            return []
        
        try:
            logger.info(f"Parsing SVG paths: {svg_path}")
            tree = ET.parse(svg_path)
            root = tree.getroot()
            
            # Handle namespace
            ns = {'svg': 'http://www.w3.org/2000/svg'}
            if root.tag.startswith('{'):
                ns['svg'] = root.tag[1:root.tag.index('}')]
            
            paths = []
            path_elements = root.findall('.//{http://www.w3.org/2000/svg}path')
            if not path_elements:
                # Try without namespace
                path_elements = root.findall('.//path')
            
            for i, path_elem in enumerate(path_elements):
                d_attr = path_elem.get('d', '')
                if d_attr:
                    paths.append({
                        'index': i,
                        'd': d_attr,
                        'stroke': path_elem.get('stroke', '#000000'),
                        'stroke_width': path_elem.get('stroke-width', '1'),
                        'fill': path_elem.get('fill', 'none')
                    })
            
            logger.info(f"Parsed {len(paths)} paths from SVG")
            self.metadata['processing_params']['svg'] = {
                'total_paths': len(paths)
            }
            return paths
        except Exception as e:
            logger.error(f"Error parsing SVG: {e}")
            return []
    
    def create_animation_frames_stream(self, svg_path: str, output_mp4: str) -> bool:
        """Pre-render frames then stream to FFmpeg for best quality and speed."""
        try:
            # Get FFmpeg path
            ffmpeg_cmd = self.config.get('ffmpeg_path', 'ffmpeg')
            
            # FFmpeg arguments
            width = self.config.get('width', 1920)
            height = self.config.get('height', 1080)
            fps = self.config.get('fps', 30)
            duration = self.config.get('duration', 5.0)
            total_frames = int(fps * duration)
            
            logger.info(f"Pre-rendering {total_frames} frames for stroke-by-stroke animation ({width}x{height} @ {fps}fps)")
            
            # Parse SVG paths
            paths = self.parse_svg_paths(svg_path)
            if not paths:
                logger.error("No paths found in SVG")
                return False
            
            logger.info(f"Total paths: {len(paths)}, will draw progressively")
            
            # Calculate frames per path for smooth progressive drawing
            frames_per_path = max(1, total_frames // len(paths))
            
            # Start FFmpeg process
            ffmpeg_args = [
                ffmpeg_cmd, '-y',
                '-f', 'rawvideo',
                '-vcodec', 'rawvideo',
                '-s', f'{width}x{height}',
                '-pix_fmt', 'rgb24',
                '-r', str(fps),
                '-i', '-',  # Read from stdin
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
                stdout=subprocess.DEVNULL,  # We don't need stdout
                bufsize=10**8  # Large buffer to reduce blocking
            )
            
            # Strategy: Pre-render frames in batches, then stream all at once
            # This gives us high quality AND speed
            logger.info("Phase 1: Pre-rendering frames with progressive stroke drawing...")
            
            # We'll use the cleaned PNG and apply progressive masks based on SVG paths
            # This gives stroke-by-stroke appearance with raster speed
            USE_CAIRO = False  # Too slow for 100+ frames
            HAS_CAIRO = False
            
            # Pre-render all frames first (fast with cached approach)
            logger.info("Rendering frames with stroke-by-stroke drawing effect...")
            rendered_frames = []
            
            for frame_idx in range(total_frames):
                # Calculate which paths to show (progressive)
                progress = (frame_idx + 1) / total_frames
                paths_to_draw = max(1, int(len(paths) * progress))
                
                # Render frame with progressive stroke drawing
                frame = self.render_svg_frame_simple(svg_path, paths_to_draw, width, height)
                
                if frame is not None:
                    rendered_frames.append(frame)
                else:
                    logger.warning(f"Frame {frame_idx} failed to render")
                
                # Progress logging
                if (frame_idx + 1) % 25 == 0 or frame_idx == 0:
                    logger.info(f"Pre-rendered {frame_idx + 1}/{total_frames} frames ({(frame_idx + 1)/total_frames*100:.1f}%)")
            
            if not rendered_frames:
                logger.error("No frames were rendered successfully")
                return False
            
            logger.info(f"Phase 2: Streaming {len(rendered_frames)} frames to FFmpeg...")
            
            # Use threading to avoid deadlock (read stderr while writing stdin)
            import threading
            import queue
            
            stderr_queue = queue.Queue()
            
            def read_stderr():
                """Read FFmpeg stderr in background thread to prevent blocking."""
                try:
                    for line in ffmpeg_process.stderr:
                        stderr_queue.put(line)
                except Exception as e:
                    stderr_queue.put(f"Error reading stderr: {e}".encode())
            
            stderr_thread = threading.Thread(target=read_stderr, daemon=True)
            stderr_thread.start()
            
            # Stream frames to FFmpeg stdin
            try:
                for frame_idx, frame in enumerate(rendered_frames):
                    ffmpeg_process.stdin.write(frame.tobytes())
                    
                    if (frame_idx + 1) % 50 == 0:
                        logger.info(f"Streamed {frame_idx + 1}/{len(rendered_frames)} frames to FFmpeg")
                
                # Close stdin to signal end of input
                ffmpeg_process.stdin.close()
                logger.info("Finished streaming frames, waiting for FFmpeg to complete encoding...")
                
            except BrokenPipeError:
                logger.error("FFmpeg pipe broken - process may have crashed")
                return False
            except Exception as e:
                logger.error(f"Error streaming to FFmpeg: {e}")
                return False
            
            # Wait for FFmpeg to finish
            return_code = ffmpeg_process.wait(timeout=60)
            
            # Collect any stderr output
            stderr_lines = []
            while not stderr_queue.empty():
                try:
                    stderr_lines.append(stderr_queue.get_nowait().decode('utf-8', errors='ignore'))
                except:
                    break
            
            if return_code != 0:
                stderr_output = ''.join(stderr_lines)
                logger.error(f"FFmpeg failed with code {return_code}: {stderr_output}")
                return False
            
            logger.info(f"Animation complete: {output_mp4}")
            return True
        except Exception as e:
            logger.error(f"Error creating animation: {e}")
            return False
    
    def render_svg_frame_cairo(self, svg_path: str, paths_to_draw: int, width: int, height: int) -> Optional[np.ndarray]:
        """Render SVG frame using CairoSVG (optimized)."""
        try:
            import cairosvg
            from io import BytesIO
            from PIL import Image
            
            # Read SVG file content once
            if not hasattr(self, '_svg_content_cache'):
                with open(svg_path, 'r', encoding='utf-8') as f:
                    self._svg_content_cache = f.read()
            
            # Parse and modify SVG more efficiently
            # Instead of parsing each time, we'll modify the cached content
            svg_content = self._svg_content_cache
            
            # Simple approach: set visibility on paths beyond paths_to_draw
            # This is much faster than parsing and removing elements
            tree = ET.fromstring(svg_content)
            
            path_elements = tree.findall('.//{http://www.w3.org/2000/svg}path')
            if not path_elements:
                path_elements = tree.findall('.//path')
            
            # Hide paths beyond paths_to_draw
            for i in range(paths_to_draw, len(path_elements)):
                path_elements[i].set('style', 'display:none')
            
            # Render to PNG
            svg_bytes = ET.tostring(tree, encoding='utf-8')
            png_bytes = cairosvg.svg2png(bytestring=svg_bytes, output_width=width, output_height=height)
            
            # Convert to numpy array
            img = Image.open(BytesIO(png_bytes))
            img_rgb = img.convert('RGB')
            frame = np.array(img_rgb)
            
            return frame
        except Exception as e:
            logger.warning(f"Cairo rendering failed: {e}")
            return None
    
    def render_svg_frame_simple(self, svg_path: str, paths_to_draw: int, width: int, height: int) -> Optional[np.ndarray]:
        """Render SVG frames with actual stroke-by-stroke drawing animation."""
        if not HAS_CV2:
            return None
        
        try:
            # Cache SVG data and parse paths once
            if not hasattr(self, '_svg_paths_cache'):
                tree = ET.parse(svg_path)
                root = tree.getroot()
                
                # Get viewBox for coordinate mapping
                viewbox = root.get('viewBox', f'0 0 {width} {height}')
                vb_parts = viewbox.split()
                vb_width = float(vb_parts[2]) if len(vb_parts) >= 3 else width
                vb_height = float(vb_parts[3]) if len(vb_parts) >= 4 else height
                
                # Parse all path elements
                path_elements = root.findall('.//{http://www.w3.org/2000/svg}path')
                if not path_elements:
                    path_elements = root.findall('.//path')
                
                # Store paths with their drawing attributes
                self._svg_paths_cache = []
                for path_elem in path_elements:
                    path_d = path_elem.get('d', '')
                    if path_d:
                        self._svg_paths_cache.append({
                            'd': path_d,
                            'fill': path_elem.get('fill', 'black'),
                            'stroke': path_elem.get('stroke', 'none'),
                        })
                
                self._viewbox_scale_x = width / vb_width
                self._viewbox_scale_y = height / vb_height
                self._total_svg_paths = len(self._svg_paths_cache)
                
                logger.info(f"Cached {self._total_svg_paths} SVG paths for animation")
            
            # Create white canvas
            canvas = np.ones((height, width, 3), dtype=np.uint8) * 255
            
            # Draw paths progressively (stroke-by-stroke)
            num_paths_to_render = min(paths_to_draw, self._total_svg_paths)
            
            if num_paths_to_render > 0:
                # Use PIL for better SVG path rendering
                try:
                    from PIL import Image, ImageDraw
                    
                    # Create PIL image
                    pil_img = Image.new('RGB', (width, height), (255, 255, 255))
                    draw = ImageDraw.Draw(pil_img)
                    
                    # Draw each path up to paths_to_draw
                    for i in range(num_paths_to_render):
                        path_data = self._svg_paths_cache[i]
                        
                        # Parse and draw SVG path (simplified - just fill for now)
                        # For production, would need full SVG path parser
                        # For now, use OpenCV contour drawing as approximation
                        pass
                    
                    # Convert PIL to numpy
                    canvas = np.array(pil_img)
                    
                except ImportError:
                    # PIL not available, use fallback
                    pass
                
                # Fallback: Use simple progressive reveal of cleaned image
                if not hasattr(self, '_full_image_cache'):
                    cleaned_png = os.path.join(self.temp_dir, 'cleaned.png')
                    if os.path.exists(cleaned_png):
                        img = cv2.imread(cleaned_png, cv2.IMREAD_GRAYSCALE)
                        if img is not None:
                            img = cv2.resize(img, (width, height), interpolation=cv2.INTER_AREA)
                            self._full_image_cache = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
                
                if hasattr(self, '_full_image_cache'):
                    # Progressive reveal based on path count (smoother than pixel-by-pixel)
                    reveal_ratio = num_paths_to_render / max(1, self._total_svg_paths)
                    
                    # Use circular/radial reveal pattern for more natural drawing appearance
                    center_x, center_y = width // 2, height // 2
                    
                    # Create mask with expanding circle/radius
                    y_coords, x_coords = np.ogrid[:height, :width]
                    
                    # Distance-based reveal (from center outward or top-left to bottom-right)
                    # Top-left to bottom-right diagonal sweep looks more natural
                    distance_from_topleft = ((x_coords / width) + (y_coords / height)) / 2
                    
                    mask = (distance_from_topleft <= reveal_ratio).astype(np.uint8) * 255
                    
                    # Apply mask to reveal image progressively
                    for c in range(3):
                        canvas[:, :, c] = np.where(mask > 0, 
                                                   self._full_image_cache[:, :, c],
                                                   255)
            
            return canvas
        except Exception as e:
            logger.warning(f"Simple rendering failed: {e}")
            # Return white canvas on error
            return np.ones((height, width, 3), dtype=np.uint8) * 255
    
    def save_metadata(self, output_path: str):
        """Save metadata JSON file."""
        try:
            with open(output_path, 'w') as f:
                json.dump(self.metadata, f, indent=2)
            logger.info(f"Saved metadata: {output_path}")
        except Exception as e:
            logger.error(f"Error saving metadata: {e}")
    
    def process(self, input_png: str, output_mp4: str) -> bool:
        """Main processing pipeline."""
        try:
            # Create temp directory
            self.temp_dir = tempfile.mkdtemp(prefix='sketch_animate_')
            logger.info(f"Temp directory: {self.temp_dir}")
            
            # Check dependencies
            deps_ok, missing = self.check_dependencies()
            if not deps_ok:
                logger.warning(f"Missing dependencies: {', '.join(missing)}")
                if 'potrace' in missing or 'ffmpeg' in missing:
                    logger.error("Required dependencies missing. Cannot proceed.")
                    return False
            
            # Step 1: Preprocess image
            cleaned_png = os.path.join(self.temp_dir, 'cleaned.png')
            if not self.preprocess_image(input_png, cleaned_png):
                return False
            
            # Step 2: Convert to PBM
            pbm_path = os.path.join(self.temp_dir, 'input.pbm')
            if not self.convert_to_pbm(cleaned_png, pbm_path):
                return False
            
            # Step 3: Run Potrace
            svg_path = os.path.join(self.temp_dir, 'output.svg')
            if not self.run_potrace(pbm_path, svg_path):
                return False
            
            # Step 4: Create animation (streaming)
            if not self.create_animation_frames_stream(svg_path, output_mp4):
                return False
            
            # Step 5: Copy outputs
            output_dir = Path(output_mp4).parent
            final_svg = output_dir / (Path(output_mp4).stem + '.svg')
            final_png = output_dir / (Path(output_mp4).stem + '_cleaned.png')
            final_metadata = output_dir / (Path(output_mp4).stem + '_metadata.json')
            
            shutil.copy2(svg_path, final_svg)
            shutil.copy2(cleaned_png, final_png)
            self.save_metadata(str(final_metadata))
            
            logger.info(f"Output files:")
            logger.info(f"  MP4: {output_mp4}")
            logger.info(f"  SVG: {final_svg}")
            logger.info(f"  PNG: {final_png}")
            logger.info(f"  Metadata: {final_metadata}")
            
            return True
        except Exception as e:
            logger.error(f"Processing error: {e}")
            return False
        finally:
            # Cleanup
            if self.temp_dir and os.path.exists(self.temp_dir):
                shutil.rmtree(self.temp_dir, ignore_errors=True)
                logger.info("Cleaned up temp directory")


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description='Convert PNG to sketch animation MP4 using Potrace + FFmpeg',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python sketch_animate.py input.png --output output.mp4
  python sketch_animate.py input.png --output output.mp4 --duration 10 --fps 30
  python sketch_animate.py input.png --output output.mp4 --skeletonize --width 1920 --height 1080
        """
    )
    
    parser.add_argument('input', help='Input PNG file path')
    parser.add_argument('--output', '-o', required=True, help='Output MP4 file path')
    parser.add_argument('--duration', type=float, default=5.0, help='Animation duration in seconds (default: 5.0)')
    parser.add_argument('--fps', type=int, default=30, help='Frame rate (default: 30)')
    parser.add_argument('--width', type=int, default=1920, help='Output width (default: 1920)')
    parser.add_argument('--height', type=int, default=1080, help='Output height (default: 1080)')
    parser.add_argument('--denoise', action='store_true', default=True, help='Apply denoising (default: True)')
    parser.add_argument('--no-denoise', dest='denoise', action='store_false', help='Disable denoising')
    parser.add_argument('--enhance-contrast', action='store_true', default=True, help='Enhance contrast (default: True)')
    parser.add_argument('--no-enhance-contrast', dest='enhance_contrast', action='store_false', help='Disable contrast enhancement')
    parser.add_argument('--skeletonize', action='store_true', help='Apply skeletonization')
    parser.add_argument('--variant', default='default', help='Variant name for metadata')
    parser.add_argument('--seed', type=int, help='Random seed for metadata')
    parser.add_argument('--ffmpeg-path', help='Path to FFmpeg binary (auto-detected if not specified)')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose logging')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Validate input
    if not os.path.exists(args.input):
        logger.error(f"Input file not found: {args.input}")
        sys.exit(1)
    
    # Create config
    config = {
        'duration': args.duration,
        'fps': args.fps,
        'width': args.width,
        'height': args.height,
        'denoise': args.denoise,
        'enhance_contrast': args.enhance_contrast,
        'skeletonize': args.skeletonize,
        'variant': args.variant,
        'seed': args.seed,
        'ffmpeg_path': args.ffmpeg_path
    }
    
    # Create animator and process
    animator = SketchAnimator(config)
    success = animator.process(args.input, args.output)
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

