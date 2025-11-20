import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import path from 'path';
import {promises as fs} from 'fs';
import {AIVideoData, calculatePlanDurationInFrames} from '../../remotion/src/VideoFromAI';

const ensureOutputDir = async () => {
	const dir = path.join(process.cwd(), 'output');
	await fs.mkdir(dir, {recursive: true});
	return dir;
};

export const renderStoryboardVideo = async (plan: AIVideoData): Promise<string> => {
	// Pre-process frames: load SVG strings and convert paths
	// IMPORTANT: Load frames sequentially to maintain order and prevent race conditions
	const planWithPublicPaths: AIVideoData = {
		...plan,
		frames: await (async () => {
			const processedFrames = [];
			// Process frames sequentially to maintain order
			for (let i = 0; i < plan.frames.length; i++) {
				const frame = plan.frames[i];
				const processedFrame = await (async () => {
					const updatedFrame = {...frame};

					// Handle voiceover URLs
					if (frame.voiceoverUrl) {
						if (frame.voiceoverUrl.startsWith('http')) {
							// External URL - keep as is, no file check needed
							updatedFrame.voiceoverUrl = frame.voiceoverUrl;
						} else {
							// Handle both /assets/... and assets/... paths
							let publicRelativePath: string;
							if (frame.voiceoverUrl.startsWith('/assets/')) {
								publicRelativePath = frame.voiceoverUrl.replace(/^\//, '');
							} else if (frame.voiceoverUrl.startsWith('assets/')) {
								publicRelativePath = frame.voiceoverUrl;
							} else {
								// Assume it's already relative to public
								publicRelativePath = frame.voiceoverUrl;
							}
							
							const absolutePath = path.join(process.cwd(), 'public', publicRelativePath);
							
							// Verify file exists
							try {
								await fs.access(absolutePath);
								updatedFrame.voiceoverUrl = publicRelativePath; // Use path relative to public directory
							} catch (error) {
								console.warn(`[AI Render] ✗ Voiceover file not found: ${absolutePath}, skipping audio for frame ${frame.id}`);
								updatedFrame.voiceoverUrl = undefined;
							}
						}
					}

					// Pre-load SVG string if vectorized
					// Priority: Use svgString if already provided, otherwise load from file
					if (frame.vectorized && frame.vectorized.svgUrl) {
						// Check if svgString is already available (from generateVideo.ts)
						if ((frame as any).svgString && typeof (frame as any).svgString === 'string') {
							// SVG string already provided, use it directly
							(updatedFrame as any).svgString = (frame as any).svgString;
						} else {
							// Try to load from file
							try {
								const svgPath = frame.vectorized.svgUrl.startsWith('/assets/')
									? path.join(process.cwd(), 'public', frame.vectorized.svgUrl.replace(/^\//, ''))
									: frame.vectorized.svgUrl;
								
								// Check if it's a file path (not HTTP URL)
								if (!svgPath.startsWith('http')) {
									try {
										await fs.access(svgPath);
										const svgString = await fs.readFile(svgPath, 'utf-8');
										// Store SVG string in a custom field that will be passed to component
										(updatedFrame as any).svgString = svgString;
									} catch (error) {
										// SVG file not found - will try to load from URL in component
									}
								}
							} catch (error) {
								// Failed to pre-load SVG - will try to load from URL in component
							}
						}
					} else if ((frame as any).svgString) {
						// SVG string exists but no vectorized object - still use it
						(updatedFrame as any).svgString = (frame as any).svgString;
					}

					return updatedFrame;
				})();
				processedFrames.push(processedFrame);
			}
			return processedFrames;
		})(),
	};

	const serveUrl = await bundle({
		entryPoint: require.resolve('../../src/index.tsx'),
		webpackOverride: (config) => {
			// Disable webpack cache to ensure latest code is used
			if (config.cache) {
				config.cache = false;
			}
			return config;
		},
	});

	const fps = 30;
	const durationInFrames = calculatePlanDurationInFrames(planWithPublicPaths, fps);

	const composition = await selectComposition({
		serveUrl,
		id: 'VideoFromAI',
		inputProps: {plan: planWithPublicPaths},
	});

	const outputDir = await ensureOutputDir();
	const filename = `ai-storyboard-${Date.now()}.mp4`;
	const outputLocation = path.join(outputDir, filename);

	console.log(`[AI Render] Starting render: ${durationInFrames} frames (${(durationInFrames / fps).toFixed(1)}s) at ${fps}fps`);
	console.log(`[AI Render] Output: ${outputLocation}`);
	
	await renderMedia({
		serveUrl,
		codec: 'h264',
		audioCodec: 'aac',
		outputLocation,
		composition: {
			...composition,
			durationInFrames,
			fps,
		},
		inputProps: {plan: planWithPublicPaths},
		// High quality settings for sharp pixels (Full HD)
		crf: 18, // Lower CRF = higher quality (18 is high quality, 23 is default)
		imageFormat: 'jpeg',
		jpegQuality: 95, // High quality JPEG for better pixel clarity
		pixelFormat: 'yuv420p', // Standard pixel format for compatibility
		onProgress: ({progress, renderedFrames, encodedFrames}) => {
			if (progress % 10 === 0 || progress === 100) {
				console.log(`[AI Render] Progress: ${progress.toFixed(1)}% | Rendered: ${renderedFrames}/${durationInFrames} frames | Encoded: ${encodedFrames} frames`);
			}
		},
	});

	const stats = await fs.stat(outputLocation);
	console.log(`[AI Render] ✅ Render complete! File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
	
	return outputLocation;
};


