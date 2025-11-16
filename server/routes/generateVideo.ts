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
	
	// Use fixed test image for comparison (set via env var or request body)
	const useFixedTestImage = process.env.USE_FIXED_TEST_IMAGE === 'true' || req.body?.useFixedTestImage === true;
	const FIXED_TEST_IMAGE = '/assets/gemini-images/gemini-image-9497fa46-6503-4a42-a0e6-583b305f332e.png';

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
		if (useFixedTestImage) {
			console.log(`[Generate Video] ⚠️  FIXED TEST IMAGE MODE ENABLED - Using: ${FIXED_TEST_IMAGE}`);
		}
		const plan = await generateStructuredJSON(topic, description ?? '');
		
		// Filter to only sketch-based frames (whiteboard diagrams and motion scenes)
		// Remove text_slide and bullet_slide frames
		let sketchOnlyFrames = plan.frames.filter(
			(frame) => frame.type === 'whiteboard_diagram' || frame.type === 'motion_scene'
		);
		
		// When using fixed test image, limit to only one diagram
		if (useFixedTestImage) {
			sketchOnlyFrames = sketchOnlyFrames.slice(0, 1);
			console.log(`[Generate Video] Fixed test image mode: Limiting to 1 diagram only`);
		}
		
		console.log(`[Generate Video] Filtered to ${sketchOnlyFrames.length} sketch-based frames (removed ${plan.frames.length - sketchOnlyFrames.length} text slides)`);
		
		// Process frames sequentially to avoid timeout issues and rate limiting
		const framesWithAssets = [];
		for (let index = 0; index < sketchOnlyFrames.length; index++) {
			const frame = sketchOnlyFrames[index];
			let frameWithAssets: any = {...frame};
			
			if (frame.type === 'whiteboard_diagram' && frame.prompt_for_image) {
				console.log(`[Generate Video] Processing frame: ${frame.id} (${index + 1}/${sketchOnlyFrames.length})`);
				
				// Generate voiceover script FIRST to inform image generation with supporting text
				let voiceoverScript = '';
				try {
					voiceoverScript = await generateVoiceoverScript(frame, topic, index, sketchOnlyFrames.length);
					console.log(`[Generate Video] Voiceover script generated: ${voiceoverScript.substring(0, 100)}...`);
				} catch (error: any) {
					console.warn(`[Generate Video] Voiceover generation failed, continuing without it:`, error.message);
				}
				
				let staticImageUrl: string;
				
				if (useFixedTestImage) {
					// Use fixed test image for comparison (legacy mode)
					staticImageUrl = FIXED_TEST_IMAGE;
					console.log(`[Generate Video] Using fixed test image: ${staticImageUrl}`);
				} else {
					// Original pipeline: Generate image using Gemini Image API
					// Include voiceover context to add supporting text in the image
					const voiceoverContext = voiceoverScript 
						? `\n\nVoiceover context (add text labels in the diagram that support this narration): "${voiceoverScript}"\n- Include key terms, labels, and short phrases from the voiceover in the diagram\n- Make text labels visible and readable to support the narration`
						: '';
					
					const enhancedPrompt = `Create a WIDE rectangular whiteboard diagram in 16:9 landscape aspect ratio (1920x1080 dimensions). 
					- Include 5-6 main components/elements with clear connections and relationships
					- Make figures LARGE and prominent (50-55% of frame should be figures, 30-35% text/labels, 10-15% supporting details)
					- Add descriptive text labels throughout the diagram that support the voiceover narration
					- Include key terms, labels, annotations, and short phrases that match what will be explained
					- Add connecting lines, arrows, and clear visual relationships between elements
					- Use clear, readable text labels (short phrases, key terms, not paragraphs)
					- Arrange 5-6 elements horizontally across the width with clear spacing
					- Keep composition organized and detailed for better understanding
					- Fill most of the WIDTH, minimize top/bottom margins
					${frame.prompt_for_image}${voiceoverContext}`;
					if (index > 0) {
						await new Promise(resolve => setTimeout(resolve, 2000));
					}
					staticImageUrl = await callGeminiImage(enhancedPrompt);
					console.log(`[Generate Video] Image generated: ${staticImageUrl}`);
				}
				
				try {
					// Use the already-generated voiceover script, or regenerate if it failed
					if (!voiceoverScript) {
						voiceoverScript = await generateVoiceoverScript(frame, topic, index, sketchOnlyFrames.length);
						console.log(`[Generate Video] Voiceover script generated for frame ${frame.id}: ${voiceoverScript.substring(0, 100)}...`);
					}
					
					// Generate audio using Deepgram
					try {
						console.log(`[Generate Video] Generating voiceover for frame ${frame.id}...`);
						const audioBuffer = await synthesizeSpeech({text: voiceoverScript});
						const audioFilename = `voiceover-${uuidv4()}.mp3`;
						const audioPath = path.join(process.cwd(), 'public', 'assets', 'voiceovers', audioFilename);
						await fs.mkdir(path.dirname(audioPath), {recursive: true});
						await fs.writeFile(audioPath, audioBuffer);
						const voiceoverUrl = `/assets/voiceovers/${audioFilename}`;
						console.log(`[Generate Video] ✓ Voiceover generated successfully: ${voiceoverUrl} (${(audioBuffer.length / 1024).toFixed(2)} KB)`);
						
						// Calculate duration from audio file (flexible timing based on content)
						let audioDurationSeconds: number | undefined;
						try {
							const {parseBuffer} = await import('music-metadata');
							const metadata = await parseBuffer(audioBuffer, {mimeType: 'audio/mpeg'});
							audioDurationSeconds = metadata.format.duration;
							if (audioDurationSeconds) {
								// Add padding: 20% for sketch animation + 10% buffer
								const totalDuration = audioDurationSeconds * 1.3;
								frameWithAssets.duration = Math.max(6, Math.ceil(totalDuration)); // Minimum 6 seconds
								console.log(`[Generate Video] Audio duration: ${audioDurationSeconds.toFixed(2)}s → Frame duration: ${frameWithAssets.duration}s`);
							}
						} catch (error) {
							console.warn(`[Generate Video] Could not parse audio duration, using default:`, (error as Error).message);
							// Fallback: estimate from script length (average ~150 words/min = 2.5 words/sec)
							const wordCount = voiceoverScript.split(/\s+/).length;
							const estimatedDuration = Math.max(6, Math.ceil((wordCount / 2.5) * 1.3));
							frameWithAssets.duration = estimatedDuration;
							console.log(`[Generate Video] Estimated duration from script (${wordCount} words): ${estimatedDuration}s`);
						}
						
						frameWithAssets.voiceoverUrl = voiceoverUrl;
						frameWithAssets.voiceoverScript = voiceoverScript;
					} catch (error: any) {
						console.error(`[Generate Video] ✗ Voiceover generation failed for frame ${frame.id}:`, error.message);
						console.error(`[Generate Video] Error details:`, error.stack || error);
						// Continue without voiceover - don't fail the entire video
					}
					
					// Vectorize image for sketching animation (original pipeline)
					if (animateDiagrams) {
						console.log(`[Generate Video] Vectorizing image for sketching animation...`);
						const vectorizedImage = await vectorizeImageFromUrl(staticImageUrl);
						if (vectorizedImage) {
							console.log(`[Generate Video] Vectorization successful: ${vectorizedImage.svgUrl}`);
							frameWithAssets = {
								...frameWithAssets,
								asset: staticImageUrl, // Keep original for fallback
								animate: true,
								vectorized: {
									svgUrl: vectorizedImage.svgUrl,
									width: vectorizedImage.width,
									height: vectorizedImage.height,
								},
								// Store SVG string for direct use (ensures sketching starts immediately)
								svgString: vectorizedImage.svgString,
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

		// Add background music (optional - only if file exists or URL is provided)
		// Place your background music file at: public/assets/music/default-background.mp3
		// Or set DEFAULT_BACKGROUND_MUSIC env var to a custom path/URL
		// For free background music, use royalty-free sources like Pixabay, Bensound, or YouTube Audio Library
		// If not set, video will render without background music (no errors)
		let backgroundMusic: string | undefined = process.env.DEFAULT_BACKGROUND_MUSIC;
		
		// Check if default file exists if no env var is set
		if (!backgroundMusic) {
			const musicDir = path.join(process.cwd(), 'public', 'assets', 'music');
			const defaultMusicPath = path.join(musicDir, 'default-background.mp3');
			
			// Check for default-background.mp3 first
			try {
				await fs.access(defaultMusicPath);
				backgroundMusic = '/assets/music/default-background.mp3'; // File exists, use it
				console.log(`[Generate Video] Using default background music: ${backgroundMusic}`);
			} catch {
				// If default-background.mp3 doesn't exist, look for any .mp3 file in the music directory
				try {
					const musicFiles = await fs.readdir(musicDir);
					const mp3File = musicFiles.find(f => f.toLowerCase().endsWith('.mp3'));
					if (mp3File) {
						backgroundMusic = `/assets/music/${mp3File}`;
						console.log(`[Generate Video] Using background music file found: ${backgroundMusic}`);
					} else {
						console.log(`[Generate Video] No background music file found - video will render without background music`);
						backgroundMusic = undefined;
					}
				} catch (dirError) {
					// Music directory doesn't exist or can't be read
					console.log(`[Generate Video] Music directory not accessible - video will render without background music`);
					backgroundMusic = undefined;
				}
			}
		} else {
			console.log(`[Generate Video] Using background music from env var: ${backgroundMusic}`);
		}
		
		const storyboard = {
			title: plan.title,
			frames: framesWithAssets,
			...(backgroundMusic && { backgroundMusic }), // Only include if music is available
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


