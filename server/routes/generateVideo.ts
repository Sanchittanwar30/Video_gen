import {Router, Request, Response} from 'express';
import path from 'path';
import {v4 as uuidv4} from 'uuid';
import {generateStructuredJSON} from '../services/gemini-structured';
import {callGeminiImage, callGeminiText} from '../services/gemini';
import {generateMotionScene} from '../services/veoService';
import {vectorizeImageFromUrl} from '../services/imageVectorizer';
import {renderStoryboardVideo} from '../services/remotion-ai-renderer';
import {synthesizeSpeech} from '../services/deepgram';
import {promises as fs} from 'fs';

const router = Router();

router.post('/generate-video', async (req: Request, res: Response) => {
	const rawTopic = req.body?.topic;
	const rawDescription = req.body?.description;
	const topic = typeof rawTopic === 'string' ? rawTopic.trim() : '';
	const description = typeof rawDescription === 'string' ? rawDescription.trim() : '';
	// Enable animation by default, allow disabling via animateDiagrams: false
	const animateDiagrams = req.body?.animateDiagrams !== false;

	if (!topic) {
		return res.status(400).json({
			error: 'topic is required',
		});
	}

	// Set a longer timeout for this endpoint (video generation can take time)
	req.setTimeout(600000); // 10 minutes

	try {
		console.log(`[Generate Video] Starting generation for topic: ${topic}`);
		console.log(`[Generate Video] Animation enabled: ${animateDiagrams}`);
		const plan = await generateStructuredJSON(topic, description ?? '');
		
		// Filter to only sketch-based frames (whiteboard diagrams and motion scenes)
		// Remove text_slide and bullet_slide frames
		const sketchOnlyFrames = plan.frames.filter(
			(frame) => frame.type === 'whiteboard_diagram' || frame.type === 'motion_scene'
		);
		
		console.log(`[Generate Video] Filtered to ${sketchOnlyFrames.length} sketch-based frames (removed ${plan.frames.length - sketchOnlyFrames.length} text slides)`);
		
		// Process frames sequentially to avoid timeout issues and rate limiting
		const framesWithAssets = [];
		for (let index = 0; index < sketchOnlyFrames.length; index++) {
			const frame = sketchOnlyFrames[index];
			let frameWithAssets: any = {...frame};
			
			if (frame.type === 'whiteboard_diagram' && frame.prompt_for_image) {
				console.log(`[Generate Video] Generating image for frame: ${frame.id} (${index + 1}/${sketchOnlyFrames.length})`);
				
				// Enhance the prompt for figure-focused diagrams with minimal text
				const enhancedPrompt = `Create a visual, figure-focused whiteboard diagram. ${frame.prompt_for_image}

Requirements:
- Focus on diagrams, shapes, figures, and visual elements (MINIMAL TEXT - only essential labels if needed)
- Use large, clear diagrams and illustrations instead of text explanations
- Professional whiteboard sketch style with drawings, arrows, and visual connections
- Prioritize visual storytelling through figures, charts, and diagrams
- Avoid text-heavy content - use visual representations instead
- Keep any text labels small and minimal (less than 10% of the image)
- Emphasize geometric shapes, flowcharts, diagrams, and visual concepts
- Make it illustration-heavy and text-light`;
				
				// Add small delay between image generations to avoid rate limiting
				if (index > 0) {
					await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
				}
				
				try {
					const staticImageUrl = await callGeminiImage(enhancedPrompt);
					console.log(`[Generate Video] Image generated: ${staticImageUrl}`);
					
					// Generate voiceover script for this frame
					const voiceoverScript = await generateVoiceoverScript(frame, topic, index, sketchOnlyFrames.length);
					console.log(`[Generate Video] Voiceover script generated for frame ${frame.id}: ${voiceoverScript.substring(0, 100)}...`);
					
					// Generate audio using Deepgram
					try {
						const audioBuffer = await synthesizeSpeech({text: voiceoverScript});
						const audioFilename = `voiceover-${uuidv4()}.mp3`;
						const audioPath = path.join(process.cwd(), 'public', 'assets', 'voiceovers', audioFilename);
						await fs.mkdir(path.dirname(audioPath), {recursive: true});
						await fs.writeFile(audioPath, audioBuffer);
						const voiceoverUrl = `/assets/voiceovers/${audioFilename}`;
						console.log(`[Generate Video] Voiceover generated: ${voiceoverUrl}`);
						frameWithAssets.voiceoverUrl = voiceoverUrl;
						frameWithAssets.voiceoverScript = voiceoverScript;
					} catch (error: any) {
						console.warn(`[Generate Video] Voiceover generation failed for frame ${frame.id}:`, error.message);
					}
					
					// Vectorize image for true line-by-line sketching animation
					if (animateDiagrams) {
						console.log(`[Generate Video] Vectorizing image for sketching animation...`);
						const vectorized = await vectorizeImageFromUrl(staticImageUrl);
						if (vectorized) {
							console.log(`[Generate Video] Vectorization successful: ${vectorized.svgUrl}`);
							frameWithAssets = {
								...frameWithAssets,
								asset: staticImageUrl, // Keep original for fallback
								animate: true,
								vectorized: {
									svgUrl: vectorized.svgUrl,
									width: vectorized.width,
									height: vectorized.height,
								},
							};
						} else {
							console.warn(`[Generate Video] Vectorization failed, using simple animation`);
							frameWithAssets = {...frameWithAssets, asset: staticImageUrl, animate: true};
						}
					} else {
						frameWithAssets = {...frameWithAssets, asset: staticImageUrl, animate: false};
					}
				} catch (error: any) {
					console.error(`[Generate Video] Failed to process frame ${frame.id}:`, error.message);
					// Continue with next frame instead of failing completely
					continue;
				}
			}

			if (frame.type === 'motion_scene' && frame.prompt_for_video) {
				try {
					const asset = await generateMotionScene(frame.prompt_for_video);
					frameWithAssets = {...frameWithAssets, asset};
				} catch (error: any) {
					console.error(`[Generate Video] Failed to generate motion scene for frame ${frame.id}:`, error.message);
				}
			}

			framesWithAssets.push(frameWithAssets);
		}

		const storyboard = {
			title: plan.title,
			frames: framesWithAssets,
		};

		const outputLocation = await renderStoryboardVideo(storyboard);
		const jobId = uuidv4();

		return res.status(200).json({
			jobId,
			title: storyboard.title,
			frames: storyboard.frames,
			videoUrl: `/output/${path.basename(outputLocation)}`,
		});
	} catch (error) {
		console.error('[Generate Video] Failed to generate AI video plan:', error);
		
		// Check if response was already sent
		if (res.headersSent) {
			console.error('[Generate Video] Response already sent, cannot send error');
			return;
		}
		
		const errorMessage = error instanceof Error ? error.message : 'Failed to generate AI video plan';
		const statusCode = errorMessage.includes('503') || errorMessage.includes('overloaded') ? 503 : 500;
		
		return res.status(statusCode).json({
			error: errorMessage,
			details: error instanceof Error ? error.stack : undefined,
		});
	}
});

// Generate voiceover script for a frame
async function generateVoiceoverScript(
	frame: any,
	topic: string,
	frameIndex: number,
	totalFrames: number
): Promise<string> {
	const context = frame.heading || frame.text || frame.prompt_for_image || '';
	
	const prompt = `Generate a concise, educational voiceover script (2-3 sentences, 10-15 seconds when spoken) for a whiteboard diagram frame in a video about "${topic}".

Frame context: ${context}
Frame position: ${frameIndex + 1} of ${totalFrames}

Requirements:
- Clear, engaging, educational tone
- Natural speaking pace
- Explain what the diagram shows
- Connect to the overall topic
- Professional and friendly

Output ONLY the voiceover script text, no labels or formatting.`;

	try {
		const script = await callGeminiText(prompt);
		return script.trim();
	} catch (error) {
		// Fallback script
		return `This diagram illustrates key concepts about ${topic}. Let's explore the details shown here.`;
	}
}

export default router;


