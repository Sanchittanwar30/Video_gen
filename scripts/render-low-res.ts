import {renderTemplateToMp4} from '../render/index';
import {join} from 'path';

/**
 * Low-resolution render script to avoid FFmpeg issues on macOS
 */
async function renderLowRes() {
	const args = process.argv.slice(2);
	
	if (args.length < 3) {
		console.error('Usage: ts-node scripts/render-low-res.ts <templatePath> <inputPath> <outPath>');
		process.exit(1);
	}

	const [templatePath, inputPath, outPath] = args;

	console.log('Rendering with low resolution (720p) to avoid FFmpeg issues...');
	console.log('Template:', templatePath);
	console.log('Input:', inputPath);
	console.log('Output:', outPath);
	console.log('');

	try {
		await renderTemplateToMp4({
			templatePath,
			inputPath,
			outPath,
			fps: 30,
			width: 1280,
			height: 720,
			lowResolution: true,
		});

		console.log('');
		console.log('Low-res render complete!');
	} catch (error) {
		console.error('Render failed:', error);
		process.exit(1);
	}
}

renderLowRes();

