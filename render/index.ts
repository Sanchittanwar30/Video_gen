import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {existsSync, readFileSync} from 'fs';
import {join} from 'path';

/**
 * Interface for render options
 */
export interface RenderTemplateOptions {
	templatePath: string;
	inputPath: string;
	outPath: string;
	fps?: number;
	width?: number;
	height?: number;
	duration?: number;
	lowResolution?: boolean; // Use lower resolution to avoid FFmpeg issues
}

/**
 * Extracts placeholder keys from a template string
 */
function extractPlaceholders(value: any, placeholders: Set<string>): void {
	if (typeof value === 'string') {
		const matches = value.matchAll(/\{\{(\w+)\}\}/g);
		for (const match of matches) {
			placeholders.add(match[1]);
		}
	} else if (typeof value === 'object' && value !== null) {
		for (const key in value) {
			extractPlaceholders(value[key], placeholders);
		}
	}
}

/**
 * Validates that all placeholders in template are present in input
 */
function validatePlaceholders(
	template: any,
	input: Record<string, any>
): void {
	const requiredPlaceholders = new Set<string>();
	extractPlaceholders(template, requiredPlaceholders);

	const missing: string[] = [];
	for (const placeholder of requiredPlaceholders) {
		if (!(placeholder in input)) {
			missing.push(placeholder);
		}
	}

	if (missing.length > 0) {
		throw new Error(
			`Missing required placeholders in input: ${missing.join(', ')}`
		);
	}
}

/**
 * Renders a template to MP4 using Remotion
 */
export async function renderTemplateToMp4(
	options: RenderTemplateOptions
): Promise<void> {
	const {
		templatePath,
		inputPath,
		outPath,
		fps = 30,
		width: requestedWidth = 1920,
		height: requestedHeight = 1080,
		duration,
		lowResolution = false,
	} = options;

	// Use lower resolution if requested (helps avoid FFmpeg issues on macOS)
	const width = lowResolution ? 1280 : requestedWidth;
	const height = lowResolution ? 720 : requestedHeight;
	
	if (lowResolution) {
		console.log(`  Using low resolution mode: ${width}x${height}`);
	}

	// Validate input files exist
	if (!existsSync(templatePath)) {
		throw new Error(`Template file not found: ${templatePath}`);
	}

	if (!existsSync(inputPath)) {
		throw new Error(`Input file not found: ${inputPath}`);
	}

	// Load template and input
	let template: any;
	let input: Record<string, any>;

	try {
		const templateContent = readFileSync(templatePath, 'utf-8');
		template = JSON.parse(templateContent);
	} catch (error) {
		throw new Error(`Failed to parse template file: ${error}`);
	}

	try {
		const inputContent = readFileSync(inputPath, 'utf-8');
		input = JSON.parse(inputContent);
	} catch (error) {
		throw new Error(`Failed to parse input file: ${error}`);
	}

	// Filter out empty audio/image tracks BEFORE validation to avoid issues
	// We need to remove these tracks early so they don't cause problems
	if (template.tracks && Array.isArray(template.tracks)) {
		const originalTrackCount = template.tracks.length;
		template.tracks = template.tracks.filter((track: any) => {
			if (track.type === 'voiceover') {
				const src = track.src || '';
				const resolvedSrc = src.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) => {
					return input[key] !== undefined ? String(input[key]) : match;
				});
				// Remove empty or invalid audio tracks
				if (!resolvedSrc || resolvedSrc.trim() === '') {
					console.log(`  Filtering out empty voiceover track`);
					return false;
				}
			}
			if (track.type === 'image') {
				const src = track.src || '';
				const resolvedSrc = src.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) => {
					return input[key] !== undefined ? String(input[key]) : match;
				});
				// Remove empty image tracks
				if (!resolvedSrc || resolvedSrc.trim() === '') {
					console.log(`  Filtering out empty image track`);
					return false;
				}
			}
			return true;
		});
		const filteredTrackCount = template.tracks.length;
		if (originalTrackCount !== filteredTrackCount) {
			console.log(`  Filtered ${originalTrackCount - filteredTrackCount} empty track(s) from template`);
		}
	}

	// Validate placeholders (after filtering, so we don't validate removed tracks)
	validatePlaceholders(template, input);

	// Determine duration from template or options
	const finalDuration =
		duration ||
		(template.timeline?.duration ? template.timeline.duration : 300);
	const finalFps = fps || template.timeline?.fps || 30;

	console.log(`Bundling Remotion project...`);
	const bundled = await bundle({
		entryPoint: join(__dirname, '../src/index.tsx'),
		webpackOverride: (config) => config,
	});

	console.log(`Selecting composition...`);
	const composition = await selectComposition({
		serveUrl: bundled,
		id: 'TemplateComposition',
		inputProps: {
			template,
			input,
		},
		// Override dimensions if provided
		...(width && height
			? {
					width,
					height,
				}
			: {}),
	});

	console.log(`Rendering video...`);
	console.log(`  Composition: ${composition.id}`);
	console.log(`  Duration: ${finalDuration} frames (${(finalDuration / finalFps).toFixed(2)}s)`);
	console.log(`  Resolution: ${composition.width}x${composition.height}`);
	console.log(`  FPS: ${finalFps}`);
	console.log(`  Output: ${outPath}`);

	// Check if there are any valid audio tracks
	const hasAudioTracks = template.tracks && template.tracks.some((track: any) => {
		if (track.type === 'voiceover') {
			const src = track.src || '';
			const resolvedSrc = src.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) => {
				return input[key] !== undefined ? String(input[key]) : match;
			});
			return resolvedSrc && resolvedSrc.trim() !== '';
		}
		return false;
	});

	if (!hasAudioTracks) {
		console.log(`  Note: No audio tracks detected. Rendering video-only (audio may still be processed by Remotion).`);
	}

	// Try to use lower quality settings to potentially avoid FFmpeg issues
	// Also try using different codec options
	const renderOptions: any = {
		composition: {
			...composition,
			durationInFrames: finalDuration,
			fps: finalFps,
		},
		serveUrl: bundled,
		codec: 'h264',
		outputLocation: outPath,
		inputProps: {
			template,
			input,
		},
		onProgress: ({progress}: {progress: number}) => {
			if (progress % 10 === 0 || progress === 100) {
				console.log(`  Progress: ${progress.toFixed(1)}%`);
			}
		},
		// Use lower quality to reduce processing load
		crf: 23,
		videoBitrate: null,
		audioBitrate: null,
		// Try to configure audio processing
		...(hasAudioTracks ? {} : {
			// Attempt to skip audio processing when no audio tracks
			// Note: Remotion may still try to create silent audio
		}),
	};

	await renderMedia(renderOptions).catch((error: any) => {
		// Check if it's the macOS FFmpeg compatibility issue
		if (error.message && error.message.includes('AVCaptureDeviceTypeDeskViewCamera')) {
			throw new Error(
				`FFmpeg compatibility error on macOS. This is a known issue with Remotion's bundled FFmpeg.\n` +
				`Workarounds:\n` +
				`1. Update Remotion: npm update @remotion/renderer @remotion/bundler @remotion/cli remotion\n` +
				`2. Use local audio files instead of remote URLs\n` +
				`3. Remove all voiceover tracks from your template\n` +
				`4. Try rendering on a different system or use Docker\n\n` +
				`Original error: ${error.message}`
			);
		}
		throw error;
	});

	console.log(`Render complete! Output saved to: ${outPath}`);
}

/**
 * CLI entry point for direct execution
 */
if (require.main === module) {
	const args = process.argv.slice(2);

	if (args.length < 3) {
		console.error('Usage: node render/index.js <templatePath> <inputPath> <outPath> [fps] [width] [height] [duration]');
		process.exit(1);
	}

	const [templatePath, inputPath, outPath, fpsStr, widthStr, heightStr, durationStr] = args;

	renderTemplateToMp4({
		templatePath,
		inputPath,
		outPath,
		fps: fpsStr ? parseInt(fpsStr, 10) : undefined,
		width: widthStr ? parseInt(widthStr, 10) : undefined,
		height: heightStr ? parseInt(heightStr, 10) : undefined,
		duration: durationStr ? parseInt(durationStr, 10) : undefined,
	})
		.then(() => {
			process.exit(0);
		})
		.catch((error) => {
			console.error('Render failed:', error);
			process.exit(1);
		});
}

