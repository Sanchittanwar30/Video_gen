import {renderStoryboardVideo} from '../server/services/remotion-ai-renderer';
import {AIVideoData} from '../remotion/src/VideoFromAI';
import path from 'path';
import {promises as fs} from 'fs';

/**
 * Test script to render a video with whiteboard animation
 * This creates a simple test storyboard and renders it to MP4
 */
async function testRender() {
	console.log('🧪 Starting test render with WhiteboardAnimatorPrecise...\n');

	// Use an existing vectorized SVG file for testing
	const assetsDir = path.join(process.cwd(), 'public', 'assets');
	let testSvgUrl: string | undefined;
	let testImageUrl: string | undefined;

	try {
		// Look for vectorized SVG files (these are already processed)
		const vectorizedSvgPath = path.join(assetsDir, 'vectorized-036d41b2-c661-4c51-a9f4-6ca4c743a114.svg');
		try {
			await fs.access(vectorizedSvgPath);
			testSvgUrl = '/assets/vectorized-036d41b2-c661-4c51-a9f4-6ca4c743a114.svg';
			console.log(`✓ Using test SVG: ${testSvgUrl}`);
			
			// Read SVG to get dimensions
			const svgContent = await fs.readFile(vectorizedSvgPath, 'utf-8');
			const widthMatch = svgContent.match(/width="(\d+)"/);
			const heightMatch = svgContent.match(/height="(\d+)"/);
			const viewBoxMatch = svgContent.match(/viewBox="[^"]*(\d+)[^"]*(\d+)"/);
			
			console.log(`  SVG dimensions: ${widthMatch?.[1] || viewBoxMatch?.[1] || '1920'}x${heightMatch?.[1] || viewBoxMatch?.[2] || '1080'}`);
		} catch {
			console.warn('⚠ Test SVG not found, checking for other vectorized SVGs...');
			const files = await fs.readdir(assetsDir);
			const svgFiles = files.filter((f: string) => f.startsWith('vectorized-') && f.endsWith('.svg'));
			if (svgFiles.length > 0) {
				testSvgUrl = `/assets/${svgFiles[0]}`;
				console.log(`✓ Found SVG file: ${testSvgUrl}`);
			}
		}

		// Look for a PNG image as fallback
		const geminiImagesDir = path.join(assetsDir, 'gemini-images');
		try {
			const imageFiles = await fs.readdir(geminiImagesDir);
			const pngFiles = imageFiles.filter((f: string) => f.endsWith('.png'));
			if (pngFiles.length > 0) {
				testImageUrl = `/assets/gemini-images/${pngFiles[0]}`;
				console.log(`✓ Found fallback image: ${testImageUrl}`);
			}
		} catch {
			// No gemini-images directory
		}
	} catch (error) {
		console.warn('⚠ Could not read assets directory:', (error as Error).message);
	}

	if (!testSvgUrl && !testImageUrl) {
		console.error('❌ No test assets found! Please ensure you have SVG or image files in public/assets/');
		console.log('   You can run the API endpoint /api/generate-video to generate assets first.');
		process.exit(1);
	}

	// Read SVG to get dimensions if available
	let svgWidth = 1920;
	let svgHeight = 1080;
	
	if (testSvgUrl) {
		try {
			const svgPath = path.join(process.cwd(), 'public', testSvgUrl.replace(/^\//, ''));
			const svgContent = await fs.readFile(svgPath, 'utf-8');
			const widthMatch = svgContent.match(/width="(\d+)"/);
			const heightMatch = svgContent.match(/height="(\d+)"/);
			const viewBoxMatch = svgContent.match(/viewBox="[^"]*(\d+)[^"]*\s+(\d+)"/);
			
			if (widthMatch && heightMatch) {
				svgWidth = parseInt(widthMatch[1]);
				svgHeight = parseInt(heightMatch[1]);
			} else if (viewBoxMatch) {
				svgWidth = parseInt(viewBoxMatch[1]);
				svgHeight = parseInt(viewBoxMatch[2]);
			}
		} catch (error) {
			console.warn('⚠ Could not read SVG dimensions, using defaults');
		}
	}

	// Create a simple test storyboard
	const testPlan: AIVideoData = {
		title: 'Test Whiteboard Animation - WhiteboardAnimatorPrecise',
		frames: [
			{
				id: 'frame_1',
				type: 'whiteboard_diagram',
				heading: 'Whiteboard Sketch Animation Test',
				text: 'Testing the new fast 3-second reveal animation',
				duration: 18, // 18 seconds total: 3s reveal + 15s hold
				asset: testImageUrl || undefined,
				animate: true,
				vectorized: testSvgUrl ? {
					svgUrl: testSvgUrl,
					width: svgWidth,
					height: svgHeight,
				} : undefined,
				voiceoverUrl: undefined, // No voiceover for test
				voiceoverScript: undefined,
			},
		],
	};

	console.log('\n📋 Test plan:');
	console.log(`  Title: ${testPlan.title}`);
	console.log(`  Frames: ${testPlan.frames.length}`);
	console.log(`  Frame duration: 18 seconds (3s reveal + 15s hold)`);
	console.log(`  Asset: ${testPlan.frames[0].asset || 'None (will show placeholder)'}`);
	console.log(`  SVG: ${testPlan.frames[0].vectorized?.svgUrl || 'None'}`);
	console.log(`  Animation: ${testPlan.frames[0].animate ? 'Enabled' : 'Disabled'}\n`);

	try {
		console.log('🎬 Starting render...\n');
		const outputPath = await renderStoryboardVideo(testPlan);
		console.log(`\n✅ Render complete!`);
		console.log(`📹 Output: ${outputPath}`);
		console.log(`\n💡 You can view the video at: ${outputPath}`);
	} catch (error) {
		console.error('\n❌ Render failed:', error);
		if (error instanceof Error) {
			console.error('Error message:', error.message);
			console.error('Stack:', error.stack);
		}
		process.exit(1);
	}
}

// Run the test
testRender().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});

