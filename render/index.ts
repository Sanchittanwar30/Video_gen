import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import axios from 'axios';
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'fs';
import {join, dirname, extname, resolve} from 'path';

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

const createSvgDataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const createBackgroundDataUrl = (from: string, to: string) =>
  createSvgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#grad)"/></svg>`
  );

const createLogoDataUrl = (text: string) =>
  createSvgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="100%" height="100%" fill="#ffffff"/><text x="50%" y="50%" font-family="Arial, sans-serif" font-size="48" fill="#1f2937" text-anchor="middle" dominant-baseline="middle">${text}</text></svg>`
  );

const DEFAULT_BACKGROUNDS: Record<string, string> = {
  professional: createBackgroundDataUrl('#1f2937', '#0f172a'),
  casual: createBackgroundDataUrl('#2563eb', '#1d4ed8'),
  creative: createBackgroundDataUrl('#8b5cf6', '#7c3aed'),
  minimalist: createBackgroundDataUrl('#111827', '#0f172a'),
  default: createBackgroundDataUrl('#1f2937', '#0f172a'),
};

const FALLBACK_LOGO_DATA_URL = createLogoDataUrl('Your Logo');

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const isDataUrl = (value: string) => value.startsWith('data:');

const contentTypeToExtension = (contentType?: string) => {
  if (!contentType) return '';
  if (contentType.includes('image/png')) return '.png';
  if (contentType.includes('image/jpeg')) return '.jpg';
  if (contentType.includes('image/jpg')) return '.jpg';
  if (contentType.includes('image/svg')) return '.svg';
  if (contentType.includes('image/webp')) return '.webp';
  if (contentType.includes('audio/mpeg')) return '.mp3';
  if (contentType.includes('audio/mp4')) return '.m4a';
  if (contentType.includes('audio/wav')) return '.wav';
  if (contentType.includes('audio/x-wav')) return '.wav';
  return '';
};

const isLikelyImage = (extension: string, contentType?: string) => {
	const lowerExt = extension.toLowerCase();
	if (contentType && contentType.startsWith('image/')) {
		return true;
	}
	return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(lowerExt);
};

const downloadAsset = async (url: string, targetDir: string, key: string): Promise<string> => {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 20000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
      Accept: '*/*',
    },
  });

  let extension = extname(new URL(url).pathname);
  if (extension.includes('?')) {
    extension = extension.split('?')[0];
  }
  if (!extension || extension.length > 5) {
    extension = contentTypeToExtension(response.headers['content-type']);
  }
  if (!extension) {
    extension = '.bin';
  }

  const contentType = response.headers['content-type'] || '';
  const buffer = Buffer.from(response.data);

  if (isLikelyImage(extension, contentType)) {
    const mime = contentType || `image/${extension.replace('.', '') || 'png'}`;
    const base64 = buffer.toString('base64');
    return `data:${mime};base64,${base64}`;
  }

  const filename = `${key}-${Date.now()}${extension || ''}`;
  const absoluteDir = resolve(targetDir);
  if (!existsSync(absoluteDir)) {
    mkdirSync(absoluteDir, {recursive: true});
  }
  const filePath = join(absoluteDir, filename);
  writeFileSync(filePath, buffer);
  return filePath;
};

const prepareInputAssets = async (input: Record<string, any>, jobDir: string) => {
  const result: Record<string, any> = {...input};
  const absoluteJobDir = resolve(jobDir);

  await Promise.all(
    Object.entries(result).map(async ([key, value]) => {
      if (typeof value !== 'string') {
        return;
      }

      if (isDataUrl(value)) {
        return;
      }

      if (isHttpUrl(value)) {
        try {
          const localAsset = await downloadAsset(value, absoluteJobDir, key.toLowerCase());
          result[key] = isDataUrl(localAsset) ? localAsset : `file://${localAsset}`;
        } catch (error) {
          console.warn(`  Failed to download asset for ${key}: ${(error as Error).message}`);
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('logo')) {
            result[key] = FALLBACK_LOGO_DATA_URL;
          } else if (lowerKey.includes('background') || lowerKey.includes('image')) {
            result[key] = DEFAULT_BACKGROUNDS.default;
          } else if (lowerKey.includes('audio') || lowerKey.includes('voiceover')) {
            result[key] = '';
          }
        }
      }
    })
  );

  return result;
};

const shouldStripAvFoundationArgs =
	(process.env.STRIP_AVFOUNDATION_ARGS || '').toLowerCase() === 'true' ||
	process.env.STRIP_AVFOUNDATION_ARGS === '1';

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

	const jobDir = dirname(templatePath);
	input = await prepareInputAssets(input, jobDir);

	// Filter out empty media tracks BEFORE validation to avoid issues
	if (template.tracks && Array.isArray(template.tracks)) {
		const originalTrackCount = template.tracks.length;
		template.tracks = template.tracks.filter((track: any) => {
			if (track.type === 'voiceover') {
				const src = track.src || '';
				const resolvedSrc = src.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) => {
					return input[key] !== undefined ? String(input[key]) : match;
				});
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

	const hasAudioTracks =
		Array.isArray(template.tracks) &&
		template.tracks.some((track: any) => {
			if (track.type !== 'voiceover') {
				return false;
			}
			const src = track.src || '';
			const resolvedSrc = src.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) => {
				return input[key] !== undefined ? String(input[key]) : match;
			});
			return resolvedSrc && resolvedSrc.trim() !== '';
		});

	if (!hasAudioTracks) {
		console.log(`  Note: No valid voiceover audio detected. Rendering without audio track.`);
	}

	const ffmpegExecutable =
		process.env.FFMPEG_BINARY ||
		process.env.REMOTION_FFMPEG_EXECUTABLE ||
		process.env.REMOTION_FFMPEG_BINARY;
	const ffprobeExecutable =
		process.env.FFPROBE_BINARY ||
		process.env.REMOTION_FFPROBE_EXECUTABLE ||
		process.env.REMOTION_FFPROBE_BINARY;

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
		omitAudio: !hasAudioTracks,
		ffmpegOverride: ({args, type}: {args: string[]; type: string}) => {
			if (
				process.platform !== 'darwin' ||
				!shouldStripAvFoundationArgs ||
				type !== 'stitcher'
			) {
				return args;
			}

			const stripLavfi = (currentArgs: string[]) => {
				const result: string[] = [];
				for (let i = 0; i < currentArgs.length; i++) {
					if (
						currentArgs[i] === '-f' &&
						currentArgs[i + 1] === 'lavfi' &&
						currentArgs[i + 2] === '-i' &&
						currentArgs[i + 3]?.startsWith('anullsrc')
					) {
						i += 3;
						continue;
					}
					result.push(currentArgs[i]);
				}
				return result;
			};

			const sanitized = stripLavfi(args);

			if (sanitized.length !== args.length) {
				console.log(
					'  Applied ffmpegOverride: stripped silent audio arguments to avoid AVFoundation issues.'
				);
			}

			return sanitized;
		},
	};

	if (ffmpegExecutable) {
		renderOptions.ffmpegExecutable = ffmpegExecutable;
		console.log(`  Using custom FFmpeg binary: ${ffmpegExecutable}`);
	} else {
		console.log(`  Using Remotion bundled FFmpeg binary.`);
	}

	if (ffprobeExecutable) {
		renderOptions.ffprobeExecutable = ffprobeExecutable;
		console.log(`  Using custom FFprobe binary: ${ffprobeExecutable}`);
	} else {
		console.log(`  Using Remotion bundled FFprobe binary.`);
	}

	await renderMedia(renderOptions).catch((error: any) => {
		// Check if it's the macOS FFmpeg compatibility issue
		if (error.message && error.message.includes('AVCaptureDeviceTypeDeskViewCamera')) {
			throw new Error(
				`FFmpeg compatibility error on macOS. This is a known issue with Remotion's bundled FFmpeg.\n` +
				`Workarounds:\n` +
				`1. Update Remotion: npm update @remotion/renderer @remotion/bundler @remotion/cli remotion\n` +
				`2. Point Remotion to a system-installed FFmpeg (see README)\n` +
				`3. Render from a Linux environment or Docker container\n` +
				`4. Temporarily omit voiceover tracks (set includeAudio=false) when audio isn't required\n` +
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

