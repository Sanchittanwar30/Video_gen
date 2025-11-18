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
	
	// Use fixed test images for animation testing (set via env var or request body)
	const useFixedTestImage = process.env.USE_FIXED_TEST_IMAGE === 'true' || req.body?.useFixedTestImage === true;
	
	// Support multiple fixed test images - can be specified via env var (comma-separated) or request body (array)
	let fixedTestImages: string[] = [];
	if (useFixedTestImage) {
		if (req.body?.fixedTestImages && Array.isArray(req.body.fixedTestImages)) {
			fixedTestImages = req.body.fixedTestImages;
		} else if (req.body?.fixedTestImages && typeof req.body.fixedTestImages === 'string') {
			fixedTestImages = req.body.fixedTestImages.split(',').map(s => s.trim()).filter(Boolean);
		} else if (process.env.FIXED_TEST_IMAGES) {
			fixedTestImages = process.env.FIXED_TEST_IMAGES.split(',').map(s => s.trim()).filter(Boolean);
		} else {
			// Default: use some existing images for testing
			fixedTestImages = [
				'/assets/gemini-images/gemini-image-ce4821c2-18de-4ba9-a9a5-efd4d3c91171.png',
				'/assets/gemini-images/gemini-image-da0e9111-e044-4bd1-b7fe-e3371b209214.png',
				'/assets/gemini-images/gemini-image-909dde41-8254-4b6a-8789-67a2497b5745.png',
			];
		}
	}

	if (!topic) {
		return res.status(400).json({
			error: 'topic is required',
		});
	}

	// Set a longer timeout for this endpoint (video generation can take time)
	req.setTimeout(600000); // 10 minutes

	try {
		// Starting generation
		if (useFixedTestImage) {
			console.log(`[Generate Video] ⚠️  FIXED TEST IMAGE MODE ENABLED - Skipping all Gemini API calls`);
			console.log(`[Generate Video] Using ${fixedTestImages.length} fixed test image(s):`, fixedTestImages);
		}
		
		let plan;
		let sketchOnlyFrames;
		
		if (useFixedTestImage) {
			// Skip Gemini API - create a simple mock plan for fixed images
			const numFrames = fixedTestImages.length > 0 ? fixedTestImages.length : 3;
			plan = {
				title: topic || 'Test Video',
				frames: Array.from({length: numFrames}, (_, i) => ({
					id: `frame_${i + 1}`,
					type: 'whiteboard_diagram' as const,
					prompt_for_image: `Test diagram ${i + 1}`,
					heading: `Frame ${i + 1}`,
					duration: 8, // Default 8 seconds per frame
				})),
			};
			sketchOnlyFrames = plan.frames;
			console.log(`[Generate Video] Fixed test image mode: Created ${sketchOnlyFrames.length} frame(s) without Gemini API calls`);
		} else {
			// Normal mode: use Gemini to generate plan
			plan = await generateStructuredJSON(topic, description ?? '');
			
			// Filter to only sketch-based frames (whiteboard diagrams and motion scenes)
			// Remove text_slide and bullet_slide frames
			sketchOnlyFrames = plan.frames.filter(
				(frame) => frame.type === 'whiteboard_diagram' || frame.type === 'motion_scene'
			);
		}
		
		// Processing frames
		
		// Process frames sequentially to avoid timeout issues and rate limiting
		const framesWithAssets = [];
		for (let index = 0; index < sketchOnlyFrames.length; index++) {
			const frame = sketchOnlyFrames[index];
			let frameWithAssets: any = {...frame};
			
			if (frame.type === 'whiteboard_diagram' && frame.prompt_for_image) {
				// Processing frame
				
				let voiceoverScript = '';
				let staticImageUrl: string;
				
				if (useFixedTestImage) {
					// Skip voiceover generation in fixed test image mode, but add test subtitles
					voiceoverScript = `This is frame ${index + 1} of ${sketchOnlyFrames.length}. The diagram shows important concepts and visual elements that help explain the topic.`; // Test subtitle text
					console.log(`[Generate Video] Fixed test mode: Skipping voiceover generation, using test subtitle: "${voiceoverScript}"`);
					// Use fixed test images - cycle through the array
					if (fixedTestImages.length === 0) {
						throw new Error('Fixed test image mode enabled but no images provided');
					}
					// Cycle through images: use image at index % array length
					const imageIndex = index % fixedTestImages.length;
					staticImageUrl = fixedTestImages[imageIndex];
					console.log(`[Generate Video] Using fixed test image ${imageIndex + 1}/${fixedTestImages.length}: ${staticImageUrl}`);
				} else {
					// Generate voiceover script FIRST to inform image generation with supporting text
					try {
						voiceoverScript = await generateVoiceoverScript(frame, topic, index, sketchOnlyFrames.length);
						// Voiceover script generated
					} catch (error: any) {
						console.warn(`[Generate Video] Voiceover generation failed, continuing without it:`, error.message);
					}
					// Original pipeline: Generate image using Gemini Image API
					// Include voiceover context to add supporting text in the image
					const voiceoverContext = voiceoverScript 
						? `\n\nVoiceover context (add text labels in the diagram that support this narration): "${voiceoverScript}"\n- Include key terms, labels, and short phrases from the voiceover in the diagram\n- Make text labels visible and readable to support the narration`
						: '';
					
					const enhancedPrompt = `Create an EDUCATIONAL whiteboard diagram that clearly explains the topic.

CONTENT REQUIREMENTS:
- The diagram MUST be directly related to and explain the topic: "${topic}"
- Create a meaningful, educational diagram that helps viewers understand the concept
- Use clear visual representations: flowcharts, process diagrams, system architectures, concept maps, or explanatory diagrams
- Include relevant labels and annotations that support learning
- Make it informative and educational - avoid abstract or decorative elements

STYLE REQUIREMENTS:
- White background with black marker-style drawings
- 60-70% visual figures, shapes, diagrams, and geometric elements
- 20-30% text labels (short phrases, 2-5 words) to explain key concepts
- Use moderate complexity: circles, rectangles, arrows, lines, boxes, simple flowcharts
- Keep text concise and readable - no long paragraphs
- Use connecting lines and arrows to show relationships
- Arrange elements with clear spacing and logical flow
- Prioritize visual communication with supporting text labels

DIAGRAM DESCRIPTION:
${frame.prompt_for_image}${voiceoverContext}

CRITICAL: Do NOT include any text about resolution, aspect ratio, dimensions, or technical specifications in the image. The image should contain ONLY the educational diagram content - no metadata, no technical details, no resolution information.`;
					// Add delay between API calls to prevent rate limiting (503 errors)
					// Longer delay for later frames to avoid overwhelming the API
					const baseDelay = 3000; // 3 seconds base delay
					const frameDelay = index * 1000; // Additional 1 second per frame
					const totalDelay = baseDelay + frameDelay;
					if (index > 0) {
						await new Promise(resolve => setTimeout(resolve, totalDelay));
					} else {
						// Even first frame gets a small delay to avoid immediate burst
						await new Promise(resolve => setTimeout(resolve, 1000));
					}
					
					// Generate image with retry logic
					let imageRetryCount = 0;
					const maxImageRetries = 3;
					while (imageRetryCount <= maxImageRetries) {
						try {
							staticImageUrl = await callGeminiImage(enhancedPrompt);
							if (staticImageUrl) {
								console.log(`[Generate Video] Image generated successfully: ${staticImageUrl}`);
								break; // Success
							}
						} catch (error: any) {
							imageRetryCount++;
							if (imageRetryCount > maxImageRetries) {
								console.error(`[Generate Video] ✗ Image generation failed after ${maxImageRetries + 1} attempts for frame ${frame.id}:`, error.message);
								throw new Error(`Image generation failed: ${error.message}`);
							} else {
								console.warn(`[Generate Video] Image generation attempt ${imageRetryCount} failed, retrying... (${error.message})`);
								await new Promise(resolve => setTimeout(resolve, 2000 * imageRetryCount));
							}
						}
					}
					// Image generated
				}
				
				try {
					// Use the already-generated voiceover script, or regenerate if it failed (skip in fixed test mode)
					if (!useFixedTestImage && !voiceoverScript) {
						voiceoverScript = await generateVoiceoverScript(frame, topic, index, sketchOnlyFrames.length);
						console.log(`[Generate Video] Voiceover script generated for frame ${frame.id}: ${voiceoverScript.substring(0, 100)}...`);
					}
					
					// Always set voiceoverScript on frameWithAssets if we have it (for subtitles)
					if (voiceoverScript) {
						frameWithAssets.voiceoverScript = voiceoverScript;
					}
					
					// Generate audio using Deepgram (skip in fixed test mode, but keep subtitle text)
					let voiceoverUrl: string | undefined;
					if (!useFixedTestImage && voiceoverScript) {
						try {
							const audioBuffer = await synthesizeSpeech({text: voiceoverScript});
							const audioFilename = `voiceover-${uuidv4()}.mp3`;
							const audioPath = path.join(process.cwd(), 'public', 'assets', 'voiceovers', audioFilename);
							await fs.mkdir(path.dirname(audioPath), {recursive: true});
							await fs.writeFile(audioPath, audioBuffer);
							voiceoverUrl = `/assets/voiceovers/${audioFilename}`;
						
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
								// Frame duration calculated from audio
							}
						} catch (error) {
							console.warn(`[Generate Video] Could not parse audio duration, using default:`, (error as Error).message);
							// Fallback: estimate from script length (average ~150 words/min = 2.5 words/sec)
							const wordCount = voiceoverScript.split(/\s+/).length;
							const estimatedDuration = Math.max(6, Math.ceil((wordCount / 2.5) * 1.3));
							frameWithAssets.duration = estimatedDuration;
							// Estimated duration from script
						}
						
							frameWithAssets.voiceoverUrl = voiceoverUrl;
						} catch (error: any) {
							console.error(`[Generate Video] ✗ Voiceover generation failed for frame ${frame.id}:`, error.message);
							console.error(`[Generate Video] Error details:`, error.stack || error);
							// Continue without voiceover - don't fail the entire video
							// But keep the subtitle text even if audio generation fails
						}
					} else if (useFixedTestImage) {
						// Fixed test mode: Set subtitle text but no audio file
						// Ensure voiceoverScript is set (it should already be set above, but double-check)
						if (voiceoverScript && !frameWithAssets.voiceoverScript) {
							frameWithAssets.voiceoverScript = voiceoverScript;
						}
						console.log(`[Generate Video] Test subtitle added for frame ${frame.id}: "${frameWithAssets.voiceoverScript || voiceoverScript}"`);
						// Set a default duration for test frames
						if (!frameWithAssets.duration) {
							frameWithAssets.duration = 6; // Default 6 seconds for test frames
						}
					}
					
					// Vectorize image for sketching animation (CRITICAL: ensures proper SVG generation)
					if (animateDiagrams) {
						
						let vectorizedImage;
						let retryCount = 0;
						const maxRetries = 3; // Increased retries for better success rate
						
						// Retry vectorization with improved settings if it fails
						while (retryCount <= maxRetries) {
							try {
								// Add delay before vectorization to ensure image is fully available
								if (retryCount > 0) {
									await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
								}
								
								vectorizedImage = await vectorizeImageFromUrl(staticImageUrl);
								if (vectorizedImage && vectorizedImage.svgUrl && vectorizedImage.svgString) {
									// Validate SVG string has actual paths and proper structure
									const pathCount = (vectorizedImage.svgString.match(/<path/g) || []).length;
									const hasViewBox = vectorizedImage.svgString.includes('viewBox');
									const hasWhiteBackground = vectorizedImage.svgString.includes('fill="#ffffff"') || vectorizedImage.svgString.includes("fill='#ffffff'");
									
									if (pathCount > 0 && hasViewBox) {
										console.log(`[Generate Video] ✓ Vectorization successful: ${pathCount} paths extracted, viewBox present, white background: ${hasWhiteBackground}`);
										break; // Success, exit retry loop
									} else {
										throw new Error(`Vectorization returned invalid SVG: ${pathCount} paths, viewBox: ${hasViewBox}`);
									}
								} else {
									throw new Error('Vectorization returned invalid result (missing svgUrl or svgString)');
								}
							} catch (error: any) {
								retryCount++;
								if (retryCount > maxRetries) {
									console.error(`[Generate Video] ✗ Vectorization failed after ${maxRetries + 1} attempts:`, error.message);
									// Don't fail completely - use fallback animation
									vectorizedImage = undefined;
								} else {
									console.warn(`[Generate Video] Vectorization attempt ${retryCount} failed, retrying... (${error.message})`);
								}
							}
						}
						
						if (vectorizedImage && vectorizedImage.svgUrl && vectorizedImage.svgString) {
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
							// Frame configured with SVG animation
						} else {
							console.error(`[Generate Video] ✗ CRITICAL: Vectorization failed for frame ${frame.id} - sketching animation will not work properly`);
							console.error(`[Generate Video] Falling back to simple fade animation (no sketching)`);
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

			// Debug: Log subtitle status before pushing
			if (useFixedTestImage) {
				console.log(`[Generate Video] Frame ${frame.id} subtitle status:`, {
					hasVoiceoverScript: !!frameWithAssets.voiceoverScript,
					voiceoverScript: frameWithAssets.voiceoverScript?.substring(0, 50) + '...',
					hasVoiceoverUrl: !!frameWithAssets.voiceoverUrl
				});
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


