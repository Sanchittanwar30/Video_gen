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
	const planWithPublicPaths: AIVideoData = {
		...plan,
		frames: await Promise.all(
			plan.frames.map(async (frame) => {
				const updatedFrame = {...frame};

				// Handle voiceover URLs
				if (frame.voiceoverUrl && frame.voiceoverUrl.startsWith('/assets/')) {
					// Convert /assets/voiceovers/... to assets/voiceovers/... (relative to public dir)
					const publicRelativePath = frame.voiceoverUrl.replace(/^\//, '');
					const absolutePath = path.join(process.cwd(), 'public', publicRelativePath);
					
					// Verify file exists
					try {
						await fs.access(absolutePath);
						console.log(`[AI Render] Using voiceover: ${publicRelativePath} (relative to public dir)`);
						updatedFrame.voiceoverUrl = publicRelativePath; // Use path relative to public directory
					} catch (error) {
						console.warn(`[AI Render] Voiceover file not found: ${absolutePath}, skipping audio for frame ${frame.id}`);
						updatedFrame.voiceoverUrl = undefined;
					}
				}

				// Pre-load SVG string if vectorized
				if (frame.vectorized && frame.vectorized.svgUrl) {
					try {
						const svgPath = frame.vectorized.svgUrl.startsWith('/assets/')
							? path.join(process.cwd(), 'public', frame.vectorized.svgUrl.replace(/^\//, ''))
							: frame.vectorized.svgUrl;
						
						// Check if it's a file path (not HTTP URL)
						if (!svgPath.startsWith('http')) {
							try {
								await fs.access(svgPath);
								const svgString = await fs.readFile(svgPath, 'utf-8');
								console.log(`[AI Render] Pre-loaded SVG for frame ${frame.id}: ${svgPath.substring(svgPath.lastIndexOf(path.sep) + 1)}`);
								// Store SVG string in a custom field that will be passed to component
								(updatedFrame as any).svgString = svgString;
							} catch (error) {
								console.warn(`[AI Render] SVG file not found: ${svgPath}, frame will try to load from URL`);
							}
						}
					} catch (error) {
						console.warn(`[AI Render] Failed to pre-load SVG for frame ${frame.id}:`, (error as Error).message);
					}
				}

				return updatedFrame;
			})
		),
	};

	const serveUrl = await bundle({
		entryPoint: require.resolve('../../src/index.tsx'),
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


