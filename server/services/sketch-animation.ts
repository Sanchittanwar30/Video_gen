/**
 * Sketch Animation Service
 * Handles conversion of SVG to whiteboard/sketch animation videos
 * 
 * Flow options:
 * 1. SVG → PNG → Sketch Animation Video (current)
 * 2. SVG → Direct Processing (future enhancement)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';

export interface SketchAnimationOptions {
  inputSvg?: string;        // SVG content (string)
  inputPng?: string;        // PNG file path (if already converted)
  outputPath: string;       // Output video path
  duration: number;         // Duration in seconds
  fps?: number;             // FPS (default: 30)
  width?: number;           // Width (default: 1920)
  height?: number;          // Height (default: 1080)
  variant?: string;         // Variant identifier
  tempDir?: string;         // Temporary directory for intermediate files
}

export interface SketchAnimationResult {
  success: boolean;
  videoPath?: string;
  error?: string;
  method: 'png-svg' | 'direct-svg' | 'png-direct';
}

/**
 * Convert SVG to PNG using Puppeteer
 */
export async function svgToPng(
  svgContent: string,
  outputPngPath: string,
  options: {
    width?: number;
    height?: number;
    puppeteer?: any; // Optional puppeteer instance
  } = {}
): Promise<string> {
  const puppeteer = options.puppeteer || require('puppeteer');
  const width = options.width || 1920;
  const height = options.height || 1080;

  let browser: any = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height });

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      margin: 0;
      padding: 40px;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    svg {
      max-width: 100%;
      max-height: 100%;
    }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    // Wait for rendering (using Promise-based delay instead of deprecated waitForTimeout)
    await new Promise(resolve => setTimeout(resolve, 500));

    await page.screenshot({
      path: outputPngPath,
      type: 'png',
      fullPage: false,
      clip: {
        x: 0,
        y: 0,
        width,
        height,
      },
    });

    return outputPngPath;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Create whiteboard/sketch animation from PNG
 */
export async function createSketchAnimation(
  pngPath: string,
  options: {
    outputPath: string;
    duration: number;
    fps?: number;
    width?: number;
    height?: number;
    variant?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const {
    outputPath,
    duration,
    fps = 30,
    width = 1920,
    height = 1080,
    variant = 'sketch',
  } = options;

  const USE_LOCAL_PEN_SKETCH = process.env.USE_LOCAL_PEN_SKETCH !== 'false';

  if (!USE_LOCAL_PEN_SKETCH) {
    return { success: false, error: 'Local pen sketch animation is disabled' };
  }

  const scriptPath = path.join(process.cwd(), 'sketch_animate_whiteboard.py');
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });

  const args = [
    scriptPath,
    pngPath,
    '--output', outputPath,
    '--duration', duration.toString(),
    '--fps', fps.toString(),
    '--width', width.toString(),
    '--height', height.toString(),
    '--variant', variant,
  ];

  return new Promise((resolve) => {
    const spawnOptions: any = {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    };

    if (process.platform === 'win32') {
      spawnOptions.env = {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      };
    }

    const pythonProcess = spawn(pythonCmd, args, spawnOptions);

    let stderr = '';

    pythonProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString('utf8');
      if (!output.trim().startsWith('{') && !output.trim().startsWith('[')) {
        console.log(`[Sketch Animation] ${output.trim()}`);
      }
    });

    pythonProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString('utf8');
    });

    pythonProcess.on('close', async (code: number) => {
      if (code !== 0) {
        resolve({
          success: false,
          error: `Python script failed with exit code ${code}: ${stderr.substring(0, 200)}`,
        });
        return;
      }

      // Verify output file exists
      try {
        await fs.access(outputPath);
        const stats = await fs.stat(outputPath);
        if (stats.size > 0) {
          resolve({ success: true });
        } else {
          resolve({
            success: false,
            error: 'Output video file is empty',
          });
        }
      } catch (error: any) {
        resolve({
          success: false,
          error: `Output video file not found: ${error.message}`,
        });
      }
    });

    pythonProcess.on('error', (error: Error) => {
      resolve({
        success: false,
        error: `Failed to start Python process: ${error.message}`,
      });
    });
  });
}

/**
 * Main function: SVG to Whiteboard Animation
 * Handles the complete pipeline: SVG → PNG → Sketch Animation Video
 */
export async function svgToWhiteboardAnimation(
  options: SketchAnimationOptions
): Promise<SketchAnimationResult> {
  const {
    inputSvg,
    inputPng,
    outputPath,
    duration,
    fps = 30,
    width = 1920,
    height = 1080,
    variant = 'sketch',
    tempDir,
  } = options;

  // Validate inputs
  if (!inputSvg && !inputPng) {
    return {
      success: false,
      error: 'Either inputSvg or inputPng must be provided',
      method: 'png-svg',
    };
  }

  let pngPath: string;
  const cleanupPaths: string[] = [];

  try {
    // Step 1: Convert SVG to PNG if needed
    if (inputSvg && !inputPng) {
      const tempPngDir = tempDir || path.join(process.cwd(), 'temp', 'sketch-animation');
      await fs.mkdir(tempPngDir, { recursive: true });
      pngPath = path.join(tempPngDir, `svg-to-png-${Date.now()}.png`);
      cleanupPaths.push(tempPngDir);

      console.log(`[Sketch Animation] Converting SVG to PNG...`);
      await svgToPng(inputSvg, pngPath, { width, height });
      console.log(`[Sketch Animation] ✓ PNG created: ${pngPath}`);
    } else {
      pngPath = inputPng!;
    }

    // Step 2: Create sketch animation from PNG
    console.log(`[Sketch Animation] Creating whiteboard animation from PNG...`);
    const result = await createSketchAnimation(pngPath, {
      outputPath,
      duration,
      fps,
      width,
      height,
      variant,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        method: 'png-svg',
      };
    }

    console.log(`[Sketch Animation] ✓ Whiteboard animation created: ${outputPath}`);

    return {
      success: true,
      videoPath: outputPath,
      method: inputSvg ? 'png-svg' : 'png-direct',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error during sketch animation',
      method: 'png-svg',
    };
  } finally {
    // Cleanup temporary files (optional - keep for debugging)
    // Uncomment if you want automatic cleanup:
    /*
    for (const cleanupPath of cleanupPaths) {
      try {
        await fs.rm(cleanupPath, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    */
  }
}

/**
 * Alternative idea: Direct SVG path extraction for whiteboard animation
 * This would require a custom Python script that can parse SVG paths directly
 * and animate them stroke-by-stroke, which would be more efficient than PNG conversion
 * 
 * Future enhancement: SVG → Path Extraction → Stroke Animation
 */
export async function svgToWhiteboardAnimationDirect(
  svgContent: string,
  outputPath: string,
  options: {
    duration: number;
    fps?: number;
  }
): Promise<SketchAnimationResult> {
  // TODO: Implement direct SVG path extraction and animation
  // This would require:
  // 1. SVG path parser (extract <path>, <line>, <circle>, etc.)
  // 2. Convert paths to stroke drawing sequences
  // 3. Animate strokes frame-by-frame
  // 
  // Benefits:
  // - No PNG conversion needed
  // - Vector-based animation (scalable)
  // - More accurate stroke-by-stroke drawing
  // - Faster processing
  
  return {
    success: false,
    error: 'Direct SVG animation not yet implemented. Use svgToWhiteboardAnimation instead.',
    method: 'direct-svg',
  };
}

