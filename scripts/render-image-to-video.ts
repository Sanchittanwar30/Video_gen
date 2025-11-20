import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import path from 'path';
import {readFileSync} from 'fs';

async function renderImageToVideo() {
	const imagePath = path.resolve(process.cwd(), 'public/assets/gemini-images/gemini-image-2ac66607-c693-4cc1-ab21-8c319fdf3884.png');
	const imageBuffer = readFileSync(imagePath);
	const imageDataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
	const outputPath = path.join(process.cwd(), 'output', 'gemini-image-2ac66607-c693-4cc1-ab21-8c319fdf3884.mp4');
	
	console.log('Bundling Remotion project...');
	const serveUrl = await bundle({
		entryPoint: require.resolve('../src/index.tsx'),
	});

	console.log('Selecting composition...');
	const composition = await selectComposition({
		serveUrl,
		id: 'TemplateComposition',
		inputProps: {
			template: {
				timeline: {duration: 150, fps: 30},
				tracks: [
					{
						type: 'background',
						src: '#ffffff',
						startFrame: 0,
						endFrame: 150,
					},
					{
						type: 'image',
						src: imageDataUrl,
						style: {
							x: '50%',
							y: '50%',
							width: '100%',
							height: '100%',
							objectFit: 'contain',
							anchor: 'center',
						},
						startFrame: 0,
						endFrame: 150,
					},
				],
			},
			input: {},
		},
	});

	console.log('Rendering video...');
	await renderMedia({
		serveUrl,
		codec: 'h264',
		outputLocation: outputPath,
		composition: {
			...composition,
			durationInFrames: 150,
			fps: 30,
		},
		inputProps: {
			template: {
				timeline: {duration: 150, fps: 30},
				tracks: [
					{
						type: 'background',
						src: '#ffffff',
						startFrame: 0,
						endFrame: 150,
					},
					{
						type: 'image',
						src: imageDataUrl,
						style: {
							x: '50%',
							y: '50%',
							width: '100%',
							height: '100%',
							objectFit: 'contain',
							anchor: 'center',
						},
						startFrame: 0,
						endFrame: 150,
					},
				],
			},
			input: {},
		},
	});

	console.log(`✅ Video rendered: ${outputPath}`);
}

renderImageToVideo().catch(console.error);

