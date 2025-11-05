import {renderTemplateToMp4} from '../render/index';
import {join} from 'path';

/**
 * Preview script that renders a low-resolution version for testing
 */
async function preview() {
	const templatePath = join(__dirname, '../templates/promo-01.json');
	const inputPath = join(__dirname, '../inputs/promo-01-input.json');
	const outPath = join(__dirname, '../output/preview-360p.mp4');

	console.log('Rendering preview (360p)...');
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
			width: 640,
			height: 360,
			duration: 300, // 10 seconds at 30fps
		});

		console.log('');
		console.log('Preview render complete! Check output/preview-360p.mp4');
	} catch (error) {
		console.error('Preview render failed:', error);
		process.exit(1);
	}
}

preview();

