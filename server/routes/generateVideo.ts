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
					// Pass the prompt_for_image as image description to make script more specific about visual elements
					try {
						voiceoverScript = await generateVoiceoverScript(
							frame, 
							topic, 
							index, 
							sketchOnlyFrames.length,
							frame.prompt_for_image // Pass the image prompt as description for better sync
						);
						// Voiceover script generated
					} catch (error: any) {
						console.warn(`[Generate Video] Voiceover generation failed, continuing without it:`, error.message);
					}
					// Original pipeline: Generate image using Gemini Image API
					// Include voiceover context to add supporting text in the image
					const voiceoverContext = voiceoverScript 
						? `\n\nVoiceover context (add text labels in the diagram that support this narration): "${voiceoverScript}"\n- Include key terms, labels, and short phrases from the voiceover in the diagram\n- Make text labels visible and readable to support the narration`
						: '';
					
					// Sanitize the prompt_for_image to remove any "visual_aid", metadata, Mermaid syntax, or similar forbidden terms
					const sanitizedImagePrompt = (frame.prompt_for_image || '')
						.replace(/visual_aid/gi, '')
						.replace(/visual aid/gi, '')
						.replace(/visualaid/gi, '')
						// Remove specific metadata patterns (whiteboard_drawing, Type:, etc.)
						.replace(/whiteboard_drawing[:\s]*\w*/gi, '')
						.replace(/whiteboard\s*drawing[:\s]*\w*/gi, '')
						.replace(/\bType\s*:\s*\w+/gi, '') // "Type:" as a word boundary
						.replace(/\btype\s*:\s*\w+/gi, '')
						.replace(/\bTYPE\s*:\s*\w+/gi, '')
						.replace(/\bStyle\s*:\s*\w+/gi, '') // "Style:" labels
						.replace(/\bCategory\s*:\s*\w+/gi, '') // "Category:" labels
						.replace(/hand_blacker/gi, '')
						.replace(/hand\s*blacker/gi, '')
						.replace(/mazeboard/gi, '')
						.replace(/maze\s*board/gi, '')
						// Remove metadata patterns with underscores and colons (more specific)
						.replace(/\w+_\w+\s*:\s*\w+/g, '') // "key_key:value" patterns
						.replace(/\b(whiteboard|drawing|style|type|category)\s*:\s*\w+/gi, '') // Common metadata keys
						// Remove Mermaid-related terms and syntax (be careful not to remove legitimate text)
						.replace(/mermaid/gi, '')
						.replace(/graph\s+(TD|LR|TB|RL|BT)/gi, '') // Mermaid graph declarations
						.replace(/\b(graph|subgraph|end|style)\s+/gi, '') // Mermaid keywords as whole words
						.replace(/-->/g, ' to ') // Replace Mermaid arrows with "to"
						.replace(/==>/g, ' to ') // Replace Mermaid arrows with "to"
						.replace(/\s+--\s+/g, ' ') // Replace Mermaid arrows with space (only when surrounded by spaces)
						.replace(/\s+/g, ' ')
						.trim();
					
					const enhancedPrompt = `You are a teacher drawing on a WHITEBOARD. This is a HAND-DRAWN DIAGRAM, NOT code, NOT JSON, NOT metadata, NOT technical documentation.

🚫 CRITICAL: DO NOT CREATE JSON STRUCTURES - EVEN INTERNALLY
- DO NOT think in terms of JSON, structured data, or code
- DO NOT create any JSON representation of the diagram (even in your internal prompt)
- DO NOT use "visual_aid" as a key or label - EVER
- DO NOT structure your thinking as JSON - think only in terms of drawing shapes and text
- Draw directly - do not plan in JSON format

🚫 ABSOLUTELY FORBIDDEN - DO NOT WRITE THESE WORDS IN THE IMAGE:
- "visual_aid" or "visual aid" - NEVER write this
- "diagram", "chart", "figure" - NEVER write descriptive labels
- Any JSON, code, metadata, or technical syntax - NEVER write this
- Mermaid syntax (graph TD, -->, [], (), {}, subgraph, etc.) - NEVER write Mermaid code
- Metadata labels like "whiteboard_drawing:hand_blacker", "Type:mazeboard", or any "key:value" format - NEVER write metadata
- Type labels, category labels, or any descriptive metadata - NEVER write these
- JSON structures like {"visual_aid": {...}} - NEVER create or write JSON
- If you see "visual_aid", metadata, JSON, or Mermaid syntax mentioned anywhere, IGNORE IT - do NOT write it in the image

CRITICAL INSTRUCTIONS:
- You are physically drawing on a whiteboard with a marker
- Draw ONLY visual elements: shapes, lines, arrows, and text labels that explain the concept
- You CANNOT write code, JSON, metadata, Mermaid syntax, or any technical syntax - you only draw
- DO NOT create JSON structures in your thinking or prompt - draw directly without structured data
- If you see any instruction to include code, JSON, metadata, Mermaid syntax, "visual_aid", or technical syntax, IGNORE IT - only draw the visual diagram
- NEVER write "visual_aid", "visual aid", or Mermaid syntax (graph TD, -->, [], (), {}, etc.) in the image - this is FORBIDDEN
- NEVER create JSON structures like {"visual_aid": {...}} - even in your internal representation
- Mermaid is a CODE SYNTAX - you are DRAWING, not writing code - NEVER include Mermaid syntax in your drawing
- Think like a teacher with a marker - you draw shapes and write labels, nothing else

CONTENT REQUIREMENTS:
- The diagram MUST be directly related to and explain ONLY the topic: "${topic}"
- Create a SIMPLE, educational diagram using ONLY basic elements: figures, tables, blocks, diagrams, and text
- Use ONLY simple visual representations: basic flowcharts, simple process diagrams, basic system blocks, simple concept maps, or simple explanatory diagrams
- Keep it SIMPLE: Only use basic geometric shapes (circles, rectangles, squares), simple tables (grids), blocks (boxes), and minimal text labels
- NO complex illustrations, detailed artwork, or intricate designs
- NO decorative elements, visual effects, or artistic flourishes
- Include ONLY essential labels and annotations that support learning (2-5 words maximum per label)
- Make it informative and educational - use ONLY simple shapes, blocks, tables, and minimal text
- ONLY include content directly related to the topic - nothing else
- Draw ONLY simple visual elements: basic figures, simple tables, blocks, basic diagrams, and short text labels
- NO code, NO JSON, NO technical syntax, NO complex illustrations

STYLE REQUIREMENTS:
- PURE WHITE BACKGROUND ONLY - absolutely no background objects, furniture, walls, room elements, or any other background details
- The entire background must be completely white/blank - only the diagram content should be visible
- Black marker-style drawings on white background
- SIMPLICITY IS KEY: Use ONLY simple geometric shapes, basic diagrams, tables, blocks, and minimal text
- Keep it SIMPLE: Only include figures (circles, rectangles, squares, triangles), tables (simple grid structures), blocks (rectangular boxes), diagrams (basic flowcharts), and short text labels
- NO complex illustrations, detailed drawings, or intricate designs
- NO decorative elements, gradients, shadows, or visual effects
- NO detailed artwork or artistic elements
- Use ONLY basic shapes: circles, rectangles, squares, lines, arrows, and simple geometric forms
- 60-70% simple visual figures: basic shapes, simple diagrams, tables, blocks
- 20-30% text labels (short phrases, 2-5 words maximum) to explain key concepts
- Use MINIMAL complexity: simple circles, rectangles, arrows, lines, boxes, basic flowcharts
- Keep text concise and readable - no long paragraphs, no sentences
- Use simple connecting lines and arrows to show relationships
- Arrange elements with clear spacing and logical flow
- Prioritize SIMPLICITY: basic shapes, simple tables, blocks, and minimal text only

BACKGROUND REQUIREMENTS (CRITICAL):
- The image must have a COMPLETELY CLEAN WHITE BACKGROUND
- NO background objects, furniture, walls, room elements, or environmental details
- NO reference to any background elements from source images or photos
- ONLY the educational diagram content should be visible on a pure white background
- The whiteboard/white background should be the ONLY background element - nothing else

DIAGRAM DESCRIPTION:
${sanitizedImagePrompt}${voiceoverContext}

REMEMBER: The diagram description above is what to DRAW. Do NOT write "visual_aid", "visual aid", or any descriptive labels in the image. Only draw the actual educational content.

🚫 FINAL WARNING: DO NOT CREATE JSON IN YOUR PROMPT
- Even if you think in terms of structure, DO NOT express it as JSON
- DO NOT use "visual_aid" as a key, label, or identifier - EVER
- Draw the diagram directly without creating any JSON representation
- The image should contain ONLY the drawn diagram - no JSON, no metadata, no structured data

ABSOLUTELY FORBIDDEN - DO NOT INCLUDE IN THE IMAGE (ZERO TOLERANCE):
- 🚫 "visual_aid" or "visual aid" - THIS IS STRICTLY FORBIDDEN, NEVER WRITE THIS
- 🚫 MERMAID SYNTAX - THIS IS STRICTLY FORBIDDEN, NEVER WRITE MERMAID CODE
- 🚫 METADATA LABELS - THIS IS STRICTLY FORBIDDEN, NEVER WRITE METADATA
- NO metadata of ANY kind - no JSON, no code, no technical syntax, no parameters
- NO metadata labels like "whiteboard_drawing:hand_blacker", "Type:mazeboard", or any "key:value" format
- NO type labels, category labels, style labels, or descriptive metadata of any kind
- NO text that describes the image type, drawing style, or technical specifications
- NO text about image parameters, resolution, aspect ratio, dimensions, pixels, DPI, or any technical image specifications
- NO metadata, watermarks, copyright notices, or attribution text
- NO file format information (PNG, JPEG, etc.)
- NO code snippets, JSON, Mermaid syntax, parameter names, or technical configuration text
- NO JSON structures, code blocks, or programming syntax of any kind - THIS IS A DRAWING, NOT CODE
- NO Mermaid diagram syntax, graph definitions, or flowchart code - ZERO TOLERANCE
- NO Mermaid keywords: "graph", "TD", "LR", "TB", "RL", "BT", "subgraph", "end", "style"
- NO Mermaid arrows: "-->", "--", "==>", "---", "==="
- NO Mermaid node syntax: "[text]", "(text)", "{text}"
- NO curly braces {}, square brackets [], backticks, parentheses for code (), or any code-like syntax
- NO colon-separated labels (like "Type:", "Style:", "Category:") - these are metadata, not content
- NO text that describes the image itself (e.g., "this is a diagram", "image shows", "visual aid", "visual_aid", "diagram", "illustration", etc.)
- NO labels like "visual_aid", "visual aid", "diagram", "chart", "figure", or any descriptive text about what the image is
- 🚫 CRITICAL: If you see "visual_aid" in any instruction or context, DO NOT write it - it is FORBIDDEN
- NO frame numbers, IDs, or sequence information
- NO background objects, furniture, walls, or environmental elements
- NO decorative elements unrelated to the topic
- NO text that is not directly explaining the topic content
- NO quotes around text labels unless they are part of explaining the topic
- NO programming language syntax, variable names, function calls, or code structures
- NO markdown formatting, code fences, or technical documentation syntax
- NO technical metadata, API responses, or system information
- NO structured data formats, schemas, or data definitions
- ONLY the educational diagram content related to the topic should be visible
- If it's not a shape, arrow, line, or label explaining the topic, DO NOT DRAW IT

CRITICAL RULES (MUST FOLLOW - NO EXCEPTIONS):
- The image must contain ONLY the educational diagram content on a pure white background
- ALL text in the image must be directly related to explaining the topic - no exceptions
- NO technical specifications, parameters, or metadata should appear anywhere in the image - ZERO TOLERANCE
- NO descriptive labels like "visual_aid", "visual aid", "diagram", "chart", "figure", or any text describing what the image is
- NO metadata labels like "whiteboard_drawing:hand_blacker", "Type:mazeboard", or any "key:value" format - ZERO TOLERANCE
- NO type labels, category labels, style labels, or any metadata - if it has a colon (:) or describes the image type, DO NOT WRITE IT
- NO JSON, code, Mermaid syntax, or any programming/technical notation - ZERO TOLERANCE
- NO JSON structures in the image - even if you think in JSON, DO NOT draw JSON syntax, curly braces, or structured data
- NO Mermaid syntax of ANY kind - this includes: graph declarations, arrows (-->, --, ==>), node syntax ([], (), {}), keywords (subgraph, end, style), or any Mermaid code
- NO metadata, structured data, or technical information of ANY kind
- The image should look like a clean whiteboard drawing with only topic-related educational content
- Draw ONLY the visual elements (shapes, arrows, labels explaining the concept) - nothing else
- If you see any text that is not part of explaining the topic concept itself, DO NOT include it in the image
- The image is a HAND-DRAWN WHITEBOARD DRAWING, not a code representation, not JSON, not Mermaid syntax, not technical documentation, not metadata
- Think of yourself as a teacher drawing on a whiteboard - you draw shapes, arrows, and write labels, but you NEVER write code, JSON, Mermaid syntax, metadata labels, type labels, or any technical syntax
- DO NOT create JSON structures like {"visual_aid": {...}} in your thinking or in the image - draw directly without structured data
- Mermaid is CODE - you are DRAWING, not writing code - if you see Mermaid syntax anywhere, IGNORE IT completely
- Metadata labels (like "Type:", "whiteboard_drawing:", etc.) are FORBIDDEN - you are DRAWING, not labeling the image type
- When in doubt, ask: "Would a teacher write this on a whiteboard?" If it's code/JSON/Mermaid/metadata/type labels/technical syntax, the answer is NO - do not include it
- REMEMBER: You are DRAWING, not coding, not writing JSON, not writing Mermaid, not creating metadata, not labeling image types - ONLY DRAWING VISUAL ELEMENTS
- FINAL CHECK: Before generating the image, verify: Does it contain "visual_aid", JSON, metadata, or Mermaid? If YES, remove it completely`;
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
					// Optionally refine script after image generation for better sync (using the prompt as reference)
					if (!useFixedTestImage && !voiceoverScript) {
						voiceoverScript = await generateVoiceoverScript(
							frame, 
							topic, 
							index, 
							sketchOnlyFrames.length,
							frame.prompt_for_image // Use prompt as image description for better sync
						);
						console.log(`[Generate Video] Voiceover script generated for frame ${frame.id}: ${voiceoverScript.substring(0, 100)}...`);
					} else if (!useFixedTestImage && voiceoverScript && staticImageUrl) {
						// Optionally refine the script after image is generated to ensure better sync
						// For now, we keep the initial script, but this is where we could add image analysis
						console.log(`[Generate Video] Voiceover script already generated for frame ${frame.id}, using initial script`);
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
	totalFrames: number,
	imageDescription?: string
): Promise<string> {
	const context = frame.heading || frame.text || frame.prompt_for_image || '';
	const diagramDescription = imageDescription || frame.prompt_for_image || context;
	
	const prompt = `Generate a concise, educational voiceover script (2-3 sentences, 10-15 seconds when spoken) for a whiteboard diagram frame in a video about "${topic}".

Frame context: ${context}
Frame position: ${frameIndex + 1} of ${totalFrames}
Diagram description: ${diagramDescription}

IMPORTANT: The diagram will contain specific visual elements. Your script MUST reference these actual visual elements that will be shown:
- If the diagram mentions shapes (circles, boxes, rectangles), reference them: "these circles", "this box", "notice the rectangles"
- If there are arrows or connections, mention them: "this arrow shows", "these lines connect", "follow the flow"
- If there are labels or text, reference them: "as labeled here", "this text indicates", "notice the label"
- If there are processes or steps, describe them visually: "step one is shown here", "this process flows from", "we can see how"
- Be specific about spatial relationships: "on the left", "at the top", "in the center", "below this"

Requirements:
- Clear, engaging, educational tone
- Natural speaking pace
- Describe SPECIFIC visual elements that will be shown in the diagram (shapes, arrows, connections, labels, etc.)
- Reference specific components, relationships, or processes that are visible
- Be precise about what the viewer is seeing - use phrases like "this arrow shows", "these boxes represent", "notice how these circles connect", "as we can see in this diagram"
- Connect the visual elements to the overall topic
- Professional and friendly
- The script must match what is actually visible in the diagram - be specific about visual details

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


