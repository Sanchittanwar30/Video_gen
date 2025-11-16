/**
 * Image Vectorization Service
 * 
 * Converts raster images (PNG, JPG) to SVG paths for line-by-line animation.
 * Uses potrace algorithm to trace bitmap images and generate vector paths.
 */

import path from 'path';
import {promises as fs} from 'fs';
import {v4 as uuidv4} from 'uuid';
import sharp from 'sharp';
// @ts-ignore - potrace doesn't have type definitions
import potrace from 'potrace';
import {promisify} from 'util';

const trace = promisify(potrace.trace);

const DEFAULT_ASSETS_SUBDIR = path.join('public', 'assets');

const ensureAssetsDir = async () => {
	const configured = process.env.ASSETS_DIR;
	const absoluteDir = configured
		? path.resolve(process.cwd(), configured)
		: path.join(process.cwd(), DEFAULT_ASSETS_SUBDIR);
	await fs.mkdir(absoluteDir, {recursive: true});
	return absoluteDir;
};

const assetUrlFromPath = (absolutePath: string): string => {
	const configured = process.env.ASSETS_DIR
		? path.resolve(process.cwd(), process.env.ASSETS_DIR)
		: path.join(process.cwd(), DEFAULT_ASSETS_SUBDIR);
	const relative = path.relative(configured, absolutePath);
	return `/assets/${relative.replace(/\\/g, '/')}`;
};

export interface VectorizedImage {
	svgPath: string;
	width: number;
	height: number;
	svgUrl: string;
	svgString?: string; // SVG content for direct use (avoids fetch issues)
}

/**
 * Converts an image to SVG paths using potrace algorithm
 * @param imagePath - Absolute path to the input image
 * @param timeoutMs - Maximum time to wait (default: 15 seconds for quality)
 * @returns Vectorized image data with SVG paths
 */
export const vectorizeImage = async (imagePath: string, timeoutMs: number = 15000): Promise<VectorizedImage | undefined> => {
	try {
		console.log(`[Vectorizer] Starting vectorization of: ${imagePath} (timeout: ${timeoutMs}ms)`);
		
		// Add timeout wrapper
		const vectorizationPromise = (async () => {
			// Verify input image exists
			await fs.access(imagePath);

			// Read and process image with sharp
			const imageBuffer = await fs.readFile(imagePath);
			const metadata = await sharp(imageBuffer).metadata();
			
			if (!metadata.width || !metadata.height) {
				throw new Error('Could not read image dimensions');
			}

			// Convert to grayscale and resize with a WIDE target to better fill 16:9 frames
			// Target a wider working size to reduce letterboxing and make figures larger
			const targetCanvasWidth = 1920;
			const targetCanvasHeight = 1080;

			// Detect if image is square or close to square (aspect ratio between 0.9 and 1.1)
			const aspectRatio = metadata.width! / metadata.height!;
			const isSquare = aspectRatio >= 0.9 && aspectRatio <= 1.1;
			
			let targetWidth: number;
			let targetHeight: number;
			
			if (isSquare) {
				// For square images: stretch to fill width (1920x1080), maintaining center crop
				// This ensures rectangular output instead of square
				console.log(`[Vectorizer] Detected square image (${metadata.width}x${metadata.height}), stretching to 1920x1080`);
				targetWidth = targetCanvasWidth;
				targetHeight = targetCanvasHeight;
			} else {
				// For non-square images: fit inside while preserving aspect ratio
				const fitScale = Math.min(
					targetCanvasWidth / metadata.width!,
					targetCanvasHeight / metadata.height!,
					Infinity
				);
				const scale = Math.min(Math.max(fitScale, 1), 2); // allow up to 2x enlargement max
				targetWidth = Math.max(1, Math.round(metadata.width! * scale));
				targetHeight = Math.max(1, Math.round(metadata.height! * scale));
			}
			
			// Resize: for square images use 'cover' to fill frame, for others use 'inside' to preserve aspect
			// Use white background to avoid creating background rectangles in SVG
			const processedBuffer = await sharp(imageBuffer)
				.resize(targetWidth, targetHeight, { 
					fit: isSquare ? 'cover' : 'inside', 
					withoutEnlargement: !isSquare, // Allow enlargement for square images to fill width
					position: 'center', // Center crop for square images
					kernel: 'lanczos3' 
				})
				.extend({
					top: Math.max(0, Math.floor((targetCanvasHeight - targetHeight) / 2)),
					bottom: Math.max(0, Math.ceil((targetCanvasHeight - targetHeight) / 2)),
					left: Math.max(0, Math.floor((targetCanvasWidth - targetWidth) / 2)),
					right: Math.max(0, Math.ceil((targetCanvasWidth - targetWidth) / 2)),
					background: { r: 255, g: 255, b: 255, alpha: 1 }, // white background (will be filtered out)
				})
				.greyscale()
				// Gentle enhancement to preserve meaning; avoid harsh binarization
				.sharpen(0.6)
				.normalize()
				.png()
				.toBuffer();
			
			console.log(`[Vectorizer] Resized from ${metadata.width}x${metadata.height} to ${targetWidth}x${targetHeight} on ${targetCanvasWidth}x${targetCanvasHeight} canvas`);

			// Trace the image to SVG using potrace with settings tuned for smoother, more accurate lines
			const svgString = await trace(processedBuffer, {
				threshold: 128, // Balanced detail
				optCurve: true,
				optTolerance: 0.2, // tighter curve fit
				turdSize: 2, // keep smaller meaningful strokes
				turnPolicy: 'majority' as string,
				alphamax: 0.8,
				blackOnWhite: true,
			});

			// Filter out unwanted elements using regex (no DOM parser needed)
			// Remove only full-frame background <rect> elements (keep useful rectangles in diagrams)
			let cleanedSvg = svgString as string;
			
			// Find and selectively remove rect elements that are full-frame backgrounds
			const rectMatches = cleanedSvg.match(/<rect[^>]*>/gi);
			if (rectMatches) {
				for (const rectTag of rectMatches) {
					// Extract width, height, x, y attributes
					const widthMatch = rectTag.match(/width\s*=\s*["']([^"']+)["']/i) || rectTag.match(/width\s*:\s*([^;]+)/i);
					const heightMatch = rectTag.match(/height\s*=\s*["']([^"']+)["']/i) || rectTag.match(/height\s*:\s*([^;]+)/i);
					const xMatch = rectTag.match(/x\s*=\s*["']([^"']+)["']/i) || rectTag.match(/x\s*:\s*([^;]+)/i);
					const yMatch = rectTag.match(/y\s*=\s*["']([^"']+)["']/i) || rectTag.match(/y\s*:\s*([^;]+)/i);
					
					const width = widthMatch ? parseFloat(widthMatch[1]) : targetCanvasWidth;
					const height = heightMatch ? parseFloat(heightMatch[1]) : targetCanvasHeight;
					const x = xMatch ? parseFloat(xMatch[1]) : 0;
					const y = yMatch ? parseFloat(yMatch[1]) : 0;
					
					// Only remove if it's a full-frame background (covers >95% of canvas and starts near origin)
					const isFullFrame = width >= targetCanvasWidth * 0.95 && 
					                   height >= targetCanvasHeight * 0.95 &&
					                   Math.abs(x) < targetCanvasWidth * 0.05 &&
					                   Math.abs(y) < targetCanvasHeight * 0.05;
					
					if (isFullFrame) {
						// Remove this full-frame background rect
						cleanedSvg = cleanedSvg.replace(new RegExp(rectTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^>]*>', 'gi'), '');
						cleanedSvg = cleanedSvg.replace(new RegExp(rectTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*/>', 'gi'), '');
					}
					// Otherwise keep it - it's a useful rectangle in the diagram
				}
			}
			
			// Remove all <foreignObject> elements (these are typically not useful for diagrams)
			cleanedSvg = cleanedSvg.replace(/<foreignObject[^>]*>[\s\S]*?<\/foreignObject>/gi, '');
			
			// Remove elements with display:none or visibility:hidden (invisible bounding boxes)
			cleanedSvg = cleanedSvg.replace(/<[^>]*(?:display\s*:\s*none|visibility\s*:\s*hidden)[^>]*>[\s\S]*?<\/[^>]+>/gi, '');
			cleanedSvg = cleanedSvg.replace(/<[^>]*(?:display\s*=\s*["']none["']|visibility\s*=\s*["']hidden["'])[^>]*\/>/gi, '');
			
			// Extract <path> elements and also convert useful <rect> elements to paths
			const pathMatch = cleanedSvg.match(/<path[^>]*d="([^"]*)"[^>]*>/g) || [];
			
			// Convert useful rect elements to path elements so they can be animated
			const usefulRects = cleanedSvg.match(/<rect[^>]*>/gi) || [];
			for (const rectTag of usefulRects) {
				const widthMatch = rectTag.match(/width\s*=\s*["']([^"']+)["']/i) || rectTag.match(/width\s*:\s*([^;]+)/i);
				const heightMatch = rectTag.match(/height\s*=\s*["']([^"']+)["']/i) || rectTag.match(/height\s*:\s*([^;]+)/i);
				const xMatch = rectTag.match(/x\s*=\s*["']([^"']+)["']/i) || rectTag.match(/x\s*:\s*([^;]+)/i);
				const yMatch = rectTag.match(/y\s*=\s*["']([^"']+)["']/i) || rectTag.match(/y\s*:\s*([^;]+)/i);
				
				const width = widthMatch ? parseFloat(widthMatch[1]) : 0;
				const height = heightMatch ? parseFloat(heightMatch[1]) : 0;
				const x = xMatch ? parseFloat(xMatch[1]) : 0;
				const y = yMatch ? parseFloat(yMatch[1]) : 0;
				
				// Convert rect to path (rectangle outline)
				if (width > 0 && height > 0) {
					const pathD = `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`;
					pathMatch.push(`<path d="${pathD}"/>`);
				}
			}
			if (!pathMatch || pathMatch.length === 0) {
				throw new Error('No paths found in vectorized image after filtering');
			}
			
			// Filter out background rectangle paths and border boxes (full frame coverage or border outlines)
			const filteredPaths: string[] = [];
			for (const pathTag of pathMatch) {
				const dMatch = pathTag.match(/d="([^"]*)"/);
				if (dMatch && dMatch[1]) {
					const d = dMatch[1];
					// Check if this is a background rectangle path or border box
					const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number).filter(n => !isNaN(n)) || [];
					if (nums.length >= 4) {
						const coords = [];
						for (let i = 0; i < nums.length; i += 2) {
							if (i + 1 < nums.length) {
								coords.push({x: nums[i], y: nums[i + 1]});
							}
						}
						if (coords.length >= 2) {
							const minX = Math.min(...coords.map(c => c.x));
							const maxX = Math.max(...coords.map(c => c.x));
							const minY = Math.min(...coords.map(c => c.y));
							const maxY = Math.max(...coords.map(c => c.y));
							const width = maxX - minX;
							const height = maxY - minY;
							
							// Check if it's near the edges (border detection)
							const nearLeft = minX <= targetCanvasWidth * 0.02;
							const nearRight = (targetCanvasWidth - maxX) <= targetCanvasWidth * 0.02;
							const nearTop = minY <= targetCanvasHeight * 0.02;
							const nearBottom = (targetCanvasHeight - maxY) <= targetCanvasHeight * 0.02;
							
							// Skip if it's a full-frame background rectangle (covers >85% of canvas - more aggressive)
							if (width >= targetCanvasWidth * 0.85 && height >= targetCanvasHeight * 0.85) {
								console.log(`[Vectorizer] Filtered out full-frame background: ${width}x${height}`);
								continue;
							}
							
							// Skip if it's a border box (large rectangle near edges - more aggressive)
							if (width >= targetCanvasWidth * 0.80 && height >= targetCanvasHeight * 0.80 && 
							    (nearLeft || nearRight) && (nearTop || nearBottom)) {
								console.log(`[Vectorizer] Filtered out border box: ${width}x${height} at edges`);
								continue;
							}
							
							// Skip tall thin side bars (more aggressive - thinner threshold)
							if (width <= targetCanvasWidth * 0.05 && height >= targetCanvasHeight * 0.5 && (nearLeft || nearRight)) {
								console.log(`[Vectorizer] Filtered out side bar: ${width}x${height}`);
								continue;
							}
							
							// Skip wide thin top/bottom bars (more aggressive - thinner threshold)
							if (height <= targetCanvasHeight * 0.05 && width >= targetCanvasWidth * 0.5 && (nearTop || nearBottom)) {
								console.log(`[Vectorizer] Filtered out top/bottom bar: ${width}x${height}`);
								continue;
							}
							
							// Skip any rectangle that forms a bounding box (exact canvas dimensions or very close)
							if (Math.abs(width - targetCanvasWidth) < 10 && Math.abs(height - targetCanvasHeight) < 10) {
								console.log(`[Vectorizer] Filtered out bounding box rectangle: ${width}x${height}`);
								continue;
							}
						}
					}
					filteredPaths.push(pathTag);
				}
			}
			
			if (filteredPaths.length === 0) {
				throw new Error('No valid paths found after filtering background shapes');
			}

			// Extract all path data and split by Move commands for smaller segments
			const paths: string[] = [];
			for (const pathTag of filteredPaths) {
				const dMatch = pathTag.match(/d="([^"]*)"/);
				if (dMatch && dMatch[1]) {
					const d = dMatch[1];
					
					// Split d into segments at Move commands to enable strict top-to-bottom drawing
					const segments: string[] = [];
					let current = '';
					for (let i = 0; i < d.length; i++) {
						const ch = d[i];
						if ((ch === 'M' || ch === 'm') && current.trim()) {
							segments.push(current.trim());
							current = ch;
						} else {
							current += ch;
						}
					}
					if (current.trim()) segments.push(current.trim());
					if (segments.length > 0) {
						paths.push(...segments);
					} else {
						paths.push(d);
					}
				}
			}

			if (paths.length === 0) {
				throw new Error('No valid paths extracted');
			}

			console.log(`[Vectorizer] Extracted ${paths.length} paths from image`);

			// Use exact dimensions 1920x1080 as requested (no padding, no extra space)
			const width = 1920;
			const height = 1080;

			// Save SVG file for reference
			const assetsDir = await ensureAssetsDir();
			const svgFilename = `vectorized-${uuidv4()}.svg`;
			const svgPath = path.join(assetsDir, svgFilename);
			
			// Sort paths top-to-bottom, then left-to-right using first Move coordinates
			// Use strict sorting with small tolerance for proper top-to-bottom order
			type Seg = { d: string; x: number; y: number };
			const segs: Seg[] = paths.map((d) => {
				const m = d.match(/^[Mm]\s*([-\d.]+)[,\s]+([-\d.]+)/);
				const x = m ? parseFloat(m[1]) || 0 : 0;
				const y = m ? parseFloat(m[2]) || 0 : 0;
				return { d, x, y };
			});
			segs.sort((a, b) => {
				const yDiff = a.y - b.y;
				// Use strict tolerance (2px) for top-to-bottom ordering
				if (Math.abs(yDiff) > 2) return yDiff;
				// If same Y (within 2px), sort left-to-right
				return a.x - b.x;
			});

			// Create optimized SVG - STROKES ONLY (no fills, no rect, no foreignObject, no background)
			// Use exact viewBox "0 0 1920 1080" as requested, ensure all coordinates are within frame
			const optimizedSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
	<g fill="none" stroke="#000000" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
		${segs.map((s, i) => {
			return `<path d="${s.d}" fill="none" id="path-${i}" vector-effect="non-scaling-stroke"/>`;
		}).join('\n\t\t')}
	</g>
</svg>`;

			await fs.writeFile(svgPath, optimizedSvg, 'utf-8');
			const relativeUrl = assetUrlFromPath(svgPath);
			
			// Use relative URL - Remotion will resolve it correctly
			const svgUrl = relativeUrl;
			
			// Return SVG string content for direct use (avoids fetch issues)
			const finalSvgString = optimizedSvg;

			console.log(`[Vectorizer] Vectorization complete: ${paths.length} paths, saved to ${svgUrl}`);

			return {
				svgPath: relativeUrl,
				width,
				height,
				svgUrl,
				svgString: finalSvgString, // Include SVG content for direct use
			};
		})();

		// Race against timeout
		const timeoutPromise = new Promise<undefined>((_, reject) => {
			setTimeout(() => reject(new Error('Vectorization timeout')), timeoutMs);
		});

		return await Promise.race([vectorizationPromise, timeoutPromise]);
	} catch (error: any) {
		if (error.message === 'Vectorization timeout') {
			console.warn(`[Vectorizer] Vectorization timed out after ${timeoutMs}ms, skipping...`);
		} else {
			console.error('[Vectorizer] Failed to vectorize image:', error.message);
		}
		return undefined;
	}
};

/**
 * Vectorize an image from a URL (downloads first, then vectorizes)
 */
export const vectorizeImageFromUrl = async (imageUrlOrPath: string): Promise<VectorizedImage | undefined> => {
	try {
		let tempImagePath: string | null = null;
		
		// Check if it's a URL (http/https) or a local file path
		if (imageUrlOrPath.startsWith('http://') || imageUrlOrPath.startsWith('https://')) {
			// Download from URL
			console.log(`[Vectorizer] Downloading image from URL: ${imageUrlOrPath}`);
			const axios = (await import('axios')).default;
			const response = await axios.get(imageUrlOrPath, {responseType: 'arraybuffer'});
			
			const assetsDir = await ensureAssetsDir();
			tempImagePath = path.join(assetsDir, `temp-vectorize-${uuidv4()}.png`);
			
			await fs.writeFile(tempImagePath, response.data);
			console.log(`[Vectorizer] Downloaded to: ${tempImagePath}`);
		} else if (imageUrlOrPath.startsWith('/assets/')) {
			// Relative path like /assets/gemini-images/xxx.png - convert to absolute
			const assetsDir = await ensureAssetsDir();
			const relativePath = imageUrlOrPath.replace(/^\/assets\//, '');
			tempImagePath = path.join(assetsDir, relativePath);
			console.log(`[Vectorizer] Using local path: ${tempImagePath}`);
		} else {
			// Assume it's an absolute local file path
			tempImagePath = imageUrlOrPath;
			console.log(`[Vectorizer] Using provided path: ${tempImagePath}`);
		}
		
		const result = await vectorizeImage(tempImagePath);
		
		// Clean up temp file only if we downloaded it
		if (tempImagePath && (imageUrlOrPath.startsWith('http://') || imageUrlOrPath.startsWith('https://'))) {
			try {
				await fs.unlink(tempImagePath);
			} catch {}
		}
		
		return result;
	} catch (error: any) {
		console.error('[Vectorizer] Failed to vectorize image from URL:', error.message);
		return undefined;
	}
};

