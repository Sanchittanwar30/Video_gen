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

			// Convert to grayscale and resize for quality (higher resolution = better detail)
			const maxDimension = 1000; // Higher resolution for better quality
			
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
				.normalize({lower: 5, upper: 95}) // Improve contrast for better tracing (wider range)
				.png()
				.toBuffer();
			
			console.log(`[Vectorizer] Resized from ${metadata.width}x${metadata.height} to ${targetWidth}x${targetHeight}`);

			// Trace the image to SVG using potrace with quality settings
			// Optimized for maximum detail and path count for smooth animation
			const svgString = await trace(processedBuffer, {
				threshold: 120, // Lower threshold = more detail and more paths (was 140)
				optCurve: true, // Enable curve optimization for smoother paths
				optTolerance: 0.4, // Curve optimization tolerance
				turdSize: 1, // Keep even more small shapes = more paths for better animation (was 2)
				turnPolicy: potrace.Potrace.TURNPOLICY_MINORITY,
				alphamax: 1.0,
			});

			// Extract paths from SVG
			const pathMatch = svgString.match(/<path[^>]*d="([^"]*)"[^>]*>/g);
			if (!pathMatch || pathMatch.length === 0) {
				throw new Error('No paths found in vectorized image');
			}

			// Extract all path data
			const paths: string[] = [];
			for (const pathTag of pathMatch) {
				const dMatch = pathTag.match(/d="([^"]*)"/);
				if (dMatch && dMatch[1]) {
					paths.push(dMatch[1]);
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
			
			// Create optimized SVG with all paths
			const optimizedSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
	<g fill="none" stroke="#000000" stroke-width="2">
		${paths.map((d, i) => `<path d="${d}" id="path-${i}"/>`).join('\n\t\t')}
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

