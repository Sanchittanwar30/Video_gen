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
	const serveUrl = await bundle({
		entryPoint: require.resolve('../../src/index.tsx'),
	});

	const fps = 30;
	const durationInFrames = calculatePlanDurationInFrames(plan, fps);

	const composition = await selectComposition({
		serveUrl,
		id: 'VideoFromAI',
		inputProps: {plan},
	});

	const outputDir = await ensureOutputDir();
	const filename = `ai-storyboard-${Date.now()}.mp4`;
	const outputLocation = path.join(outputDir, filename);

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
		inputProps: {plan},
		onProgress: ({progress}) => {
			if (progress % 10 === 0 || progress === 100) {
				console.log(`[AI Render] Progress: ${progress.toFixed(1)}%`);
			}
		},
	});

	return outputLocation;
};


