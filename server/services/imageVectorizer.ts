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

			// Convert to grayscale and resize for image-focused vectorization
			// Lower resolution = less detail capture, favors larger shapes over text
			const maxDimension = 800; // Slightly lower resolution to reduce text detail capture
			
			// Resize to max dimension while maintaining aspect ratio
			const scale = Math.min(maxDimension / metadata.width!, maxDimension / metadata.height!);
			const targetWidth = Math.round(metadata.width! * scale);
			const targetHeight = Math.round(metadata.height! * scale);
			
			const processedBuffer = await sharp(imageBuffer)
				.resize(targetWidth, targetHeight, {
					fit: 'inside',
					withoutEnlargement: true,
					kernel: 'lanczos3', // High-quality resampling
				})
				.greyscale()
				.normalize({lower: 20, upper: 80}) // Wide contrast range - strongly favors larger figures/diagrams, minimizes text detail
				.png()
				.toBuffer();
			
			console.log(`[Vectorizer] Resized from ${metadata.width}x${metadata.height} to ${targetWidth}x${targetHeight}`);

			// Trace the image to SVG using potrace with settings optimized for images over text
			// Aggressively prioritize figures/diagrams and minimize text detail
			const svgString = await trace(processedBuffer, {
				threshold: 160, // Higher threshold = less detail, strongly favors larger shapes/figures over text
				optCurve: true, // Enable curve optimization for smoother paths
				optTolerance: 0.4, // Curve optimization tolerance
				turdSize: 6, // Filter out many more small shapes (strongly reduces text detail, very figure-focused)
				turnPolicy: 'minority' as string, // Use string literal instead of enum
				alphamax: 1.0,
			});

			// Extract paths from SVG
			const pathMatch = (svgString as string).match(/<path[^>]*d="([^"]*)"[^>]*>/g);
			if (!pathMatch || pathMatch.length === 0) {
				throw new Error('No paths found in vectorized image');
			}

			// Extract all path data and split by Move commands for smaller segments
			const paths: string[] = [];
			for (const pathTag of pathMatch) {
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

			// Get final dimensions
			const finalMetadata = await sharp(processedBuffer).metadata();
			const width = finalMetadata.width || metadata.width!;
			const height = finalMetadata.height || metadata.height!;

			// Save SVG file for reference
			const assetsDir = await ensureAssetsDir();
			const svgFilename = `vectorized-${uuidv4()}.svg`;
			const svgPath = path.join(assetsDir, svgFilename);
			
			// Sort paths top-to-bottom, then left-to-right using first Move coordinates
			type Seg = { d: string; x: number; y: number };
			const segs: Seg[] = paths.map((d) => {
				const m = d.match(/^[Mm]\s*([-\d.]+)[,\s]+([-\d.]+)/);
				const x = m ? parseFloat(m[1]) || 0 : 0;
				const y = m ? parseFloat(m[2]) || 0 : 0;
				return { d, x, y };
			});
			segs.sort((a, b) => {
				const yDiff = a.y - b.y;
				if (Math.abs(yDiff) > 0.01) return yDiff;
				return a.x - b.x;
			});

			// Create optimized SVG - only fill VERY SMALL closed paths (character holes like 'o', 'a')
			// NOT large letter outlines (like 'D', 'A') - keep those outline-only for readability
			const optimizedSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
	<g fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill-rule="evenodd">
		${segs.map((s, i) => {
			// Check if path is closed (ends with Z or z)
			const isClosed = /[Zz]\s*$/.test(s.d.trim());
			if (!isClosed) {
				return `<path d="${s.d}" fill="none" id="path-${i}" vector-effect="non-scaling-stroke"/>`;
			}
			
			// Calculate bounding box to determine if it's a small hole or large shape
			const coords = s.d.match(/[-\d.]+/g)?.map(Number).filter(n => !isNaN(n)) || [];
			if (coords.length < 4) {
				return `<path d="${s.d}" fill="none" id="path-${i}" vector-effect="non-scaling-stroke"/>`;
			}
			
			const xs = coords.filter((_, idx) => idx % 2 === 0);
			const ys = coords.filter((_, idx) => idx % 2 === 1);
			const bboxWidth = Math.max(...xs) - Math.min(...xs);
			const bboxHeight = Math.max(...ys) - Math.min(...ys);
			const area = bboxWidth * bboxHeight;
			
			// Only fill SMALL closed paths (< 2% of SVG area) - these are character interior holes
			// Large closed paths (letter outlines like 'D', 'A') stay outline-only
			// Increased thresholds to catch more character holes for readability
			const maxArea = (width * height) * 0.02;  // 2% of area (was 1%)
			const maxWidth = width * 0.06;  // 6% of width (was 4%)
			const maxHeight = height * 0.06; // 6% of height (was 4%)
			
			const isSmallHole = area < maxArea && bboxWidth < maxWidth && bboxHeight < maxHeight;
			const fillAttr = isSmallHole ? 'fill="#ffffff"' : 'fill="none"';
			
			return `<path d="${s.d}" ${fillAttr} id="path-${i}" vector-effect="non-scaling-stroke"/>`;
		}).join('\n\t\t')}
	</g>
</svg>`;

			await fs.writeFile(svgPath, optimizedSvg, 'utf-8');
			const relativeUrl = assetUrlFromPath(svgPath);
			
			// Use relative URL - Remotion will resolve it correctly
			const svgUrl = relativeUrl;

			console.log(`[Vectorizer] Vectorization complete: ${paths.length} paths, saved to ${svgUrl}`);

			return {
				svgPath: relativeUrl,
				width,
				height,
				svgUrl,
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

