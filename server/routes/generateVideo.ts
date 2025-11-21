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

// WebSocket progress helper
let wsServer: any = null;
const getWsServer = () => {
	if (!wsServer) {
		try {
			wsServer = require('../index').wsServer;
		} catch (e) {
			// WebSocket server not available
		}
	}
	return wsServer;
};

const sendProgress = (jobId: string, phase: string, percentage: number, message?: string, step?: number, totalSteps?: number) => {
	const ws = getWsServer();
	if (ws) {
		ws.broadcast({
			type: 'progress',
			jobId,
			phase,
			percentage,
			message,
			step,
			totalSteps,
		});
	}
};

// Helper function to process frames - extracted to avoid TypeScript parser issues with very long try blocks
async function processFrames(
	sketchOnlyFrames: any[],
	plan: any,
	topic: string,
	description: string,
	useFixedTestImage: boolean,
	fixedTestImages: string[],
	animateDiagrams: boolean,
	jobId?: string
): Promise<any[]> {
	const framesWithAssets = [];
	for (let index = 0; index < sketchOnlyFrames.length; index++) {
		const frame = sketchOnlyFrames[index];
		
		// Send progress for each frame
		if (jobId) {
			const frameProgress = 25 + Math.floor((index / sketchOnlyFrames.length) * 45);
			sendProgress(jobId, index < sketchOnlyFrames.length / 2 ? 'images' : 'voiceover', 
				frameProgress, 
				`Processing frame ${index + 1} of ${sketchOnlyFrames.length}...`,
				index + 1,
				sketchOnlyFrames.length
			);
		}
		
		let frameWithAssets: any = {...frame};
		
		if (frame.type === 'whiteboard_diagram' && frame.prompt_for_image) {
			// Processing frame
			
			let voiceoverScript = '';
			let staticImageUrl: string | undefined;
			
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
				
				// ULTRA-AGGRESSIVE sanitization - remove ALL instances of forbidden terms
				// Extract words from topic and description for spelling reference
				const extractWordsForSpelling = (text: string): string[] => {
					if (!text) return [];
					// Extract all words (alphanumeric sequences) and filter out very short words
					const words = text.match(/\b[a-zA-Z]{3,}\b/g) || [];
					// Remove duplicates and sort
					return [...new Set(words.map(w => w.toLowerCase()))].sort();
				};
				
				const topicWords = extractWordsForSpelling(topic);
				const descriptionWords = extractWordsForSpelling(description || '');
				const allReferenceWords = [...new Set([...topicWords, ...descriptionWords])];
				const spellingReference = allReferenceWords.length > 0 
					? `\n\n📚 SPELLING REFERENCE - Use EXACT spellings from these words found in the topic/description:\n${allReferenceWords.slice(0, 50).join(', ')}${allReferenceWords.length > 50 ? ` (and ${allReferenceWords.length - 50} more words)` : ''}\n- If any word appears in the diagram, it MUST match the spelling above EXACTLY\n- Copy the spelling character-by-character from the reference above\n`
					: '';
				
				// This is the final defense before sending to Imagen
				let sanitizedImagePrompt = (frame.prompt_for_image || '')
					// Remove ALL code blocks first (JSON, Mermaid, markdown, etc.) - be EXTREMELY aggressive
					.replace(/```mermaid[\s\S]*?```/gi, '') // Remove Mermaid code blocks FIRST (most common)
					.replace(/```[\s\S]*?```/gi, '') // Remove ALL other code blocks
					.replace(/`[^`]*`/g, '') // Remove inline code
					.replace(/`+/g, '') // Remove any remaining backticks
					// Remove Mermaid code blocks without backticks (multiline patterns)
					.replace(/mermaid\s*\n[\s\S]*?graph[\s\S]*?end/gi, '') // Mermaid without backticks
					.replace(/graph\s+(TD|LR|TB|RL|BT|DT)[\s\S]*?end/gi, '') // Graph blocks
					// Remove JSON structures - catch all variations
					.replace(/\{[\s\S]*?"visual_aid"[\s\S]*?\}/gi, '')
					.replace(/\{[\s\S]*?"visual[\s\S]*?aid"[\s\S]*?\}/gi, '') // Catch split variations
					.replace(/\{[\s\S]*?"mermaid"[\s\S]*?\}/gi, '') // Remove JSON with mermaid
					.replace(/\{[\s\S]*?"drawing_[^}]*\}/gi, '')
					.replace(/\{[\s\S]*?"type"[^}]*\}/gi, '')
					.replace(/\{[\s\S]*?\}/g, '') // Remove ANY remaining JSON objects
					// Remove arrays
					.replace(/\[[\s\S]*?"visual_aid"[\s\S]*?\]/gi, '')
					.replace(/\[[\s\S]*?"mermaid"[\s\S]*?\]/gi, '') // Remove arrays with mermaid
					.replace(/\[[\s\S]*?\]/g, '') // Remove ANY remaining arrays
					// Remove FORBIDDEN WORDS completely - all case variations and word boundaries
					.replace(/\bvisual_aid\b/gi, '')
					.replace(/\bvisual\s+aid\b/gi, '')
					.replace(/\bvisualaid\b/gi, '')
					.replace(/\bcontent\s+aid\b/gi, '') // Remove "content aid"
					.replace(/\bcontent_aid\b/gi, '') // Remove "content_aid"
					.replace(/\bcontentaid\b/gi, '') // Remove "contentaid"
					.replace(/\bmermaid\b/gi, '') // Remove mermaid completely
					.replace(/\bmer\s*maid\b/gi, '') // Catch split variations
					.replace(/\bdiagram\b/gi, '') // Remove "diagram" as a label word
					.replace(/\bchart\b/gi, '') // Remove "chart" as a label word
					.replace(/\bfigure\b/gi, '') // Remove "figure" as a label word
					// Remove metadata patterns - be VERY aggressive with colon-separated patterns
					.replace(/whiteboard_drawing[:\s]*\w*/gi, '')
					.replace(/whiteboard\s*drawing[:\s]*\w*/gi, '')
					.replace(/drawing_instructions/gi, '')
					.replace(/drawing_elements/gi, '')
					.replace(/hand_blacker/gi, '')
					.replace(/hand\s*blacker/gi, '')
					.replace(/mazeboard/gi, '')
					.replace(/maze\s*board/gi, '')
					// Remove ALL "type :" patterns - very aggressive (catch any spacing)
					.replace(/\btype\s*:\s*[^\n\r,;.]+/gi, '') // Remove "type : anything" (until newline, comma, semicolon, period)
					.replace(/\bType\s*:\s*[^\n\r,;.]+/gi, '') // Case variations
					.replace(/\bTYPE\s*:\s*[^\n\r,;.]+/gi, '')
					.replace(/\btype\s*:\s*white[^\n\r,;.]+/gi, '') // "type : white..." patterns
					.replace(/\btype\s*:\s*black[^\n\r,;.]+/gi, '') // "type : black..." patterns
					.replace(/\btype\s*:\s*box/gi, '') // "type : box"
					.replace(/\btype\s*:\s*marker/gi, '') // "type : marker"
					.replace(/\btype\s*:\s*whiteboard/gi, '') // "type : whiteboard"
					.replace(/\bStyle\s*:\s*[^\n\r,;.]+/gi, '')
					.replace(/\bstyle\s*:\s*[^\n\r,;.]+/gi, '')
					.replace(/\bCategory\s*:\s*[^\n\r,;.]+/gi, '')
					.replace(/\bcategory\s*:\s*[^\n\r,;.]+/gi, '')
					// Remove "content aid :" patterns
					.replace(/\bcontent\s+aid\s*:\s*[^\n\r,;.]+/gi, '')
					.replace(/\bcontent_aid\s*:\s*[^\n\r,;.]+/gi, '')
					// Remove Mermaid syntax - be EXTREMELY aggressive
					.replace(/graph\s+(TD|LR|TB|RL|BT|DT)/gi, '')
					.replace(/\bgraph\b/gi, '') // Remove standalone "graph" word
					.replace(/subgraph\s+\w+/gi, '') // Remove "subgraph LIFO", "subgraph FIFO", etc.
					.replace(/subgraph/gi, '')
					.replace(/\bend\b/gi, '') // Remove "end" keyword (Mermaid subgraph end)
					.replace(/-->/g, ' to ')
					.replace(/==>/g, ' to ')
					.replace(/---/g, ' ')
					.replace(/===/g, ' ')
					.replace(/--/g, ' ')
					// Remove Mermaid node syntax patterns BEFORE removing brackets
					.replace(/\w+\[[^\]]+\]/g, '') // A[Stack], B[text], etc.
					.replace(/\w+\(\([^)]+\)\)/g, '') // B(( )), C((text)), etc.
					.replace(/\w+\{[^}]+\}/g, '') // D{text}, etc.
					.replace(/\w+\([^)]+\)/g, '') // E(text), etc.
					// Remove Mermaid style definitions
					.replace(/style\s+\w+\s+fill[^\n]+/gi, '') // "style A fill:#fff,stroke:#000..."
					.replace(/style\s+\w+\s+stroke[^\n]+/gi, '') // "style A stroke:#000..."
					.replace(/fill:\s*#[0-9a-fA-F]+/gi, '') // fill:#fff, fill:#000
					.replace(/stroke:\s*#[0-9a-fA-F]+/gi, '') // stroke:#000
					.replace(/stroke-width:\s*\d+px/gi, '') // stroke-width:2px
					.replace(/rx:\s*\d+px/gi, '') // rx:5px
					.replace(/ry:\s*\d+px/gi, '') // ry:5px
					.replace(/rx:\s*\d+/gi, '') // rx:5
					.replace(/ry:\s*\d+/gi, '') // ry:5
					// Remove common Mermaid subgraph names
					.replace(/\bLIFO\b/gi, '')
					.replace(/\bFIFO\b/gi, '')
					.replace(/\bSTACK\b/gi, '')
					.replace(/\bQUEUE\b/gi, '')
					// Now remove brackets/parentheses (but be careful not to remove legitimate text)
					.replace(/\[/g, '')
					.replace(/\]/g, '')
					.replace(/\(/g, '')
					.replace(/\)/g, '')
					.replace(/\{/g, '')
					.replace(/\}/g, '')
					// Remove phrases containing forbidden terms
					.replace(/using\s+mermaid/gi, '')
					.replace(/mermaid\s+diagram/gi, '')
					.replace(/mermaid\s+syntax/gi, '')
					.replace(/mermaid\s+code/gi, '')
					.replace(/mermaid\s+graph/gi, '')
					.replace(/mermaid\s+flowchart/gi, '')
					.replace(/create\s+a\s+visual\s+aid/gi, '')
					.replace(/visual\s+aid\s+showing/gi, '')
					.replace(/visual\s+aid\s+for/gi, '')
					.replace(/create\s+a\s+diagram/gi, 'draw shapes')
					.replace(/create\s+a\s+chart/gi, 'draw shapes')
					// Remove Mermaid-specific phrases
					.replace(/draw\s+a\s+mermaid/gi, 'draw shapes')
					.replace(/create\s+a\s+mermaid/gi, 'draw shapes')
					.replace(/use\s+mermaid/gi, '')
					.replace(/with\s+mermaid/gi, '')
					// Remove metadata patterns - catch ALL colon-separated metadata
					.replace(/\w+_\w+\s*:\s*[^\n\r,;.]+/g, '') // "key_key:value" patterns (extended to catch full phrases)
					.replace(/\b(whiteboard|drawing|style|type|category|content\s+aid|content_aid)\s*:\s*[^\n\r,;.]+/gi, '')
					// Remove specific problematic patterns
					.replace(/\btype\s*:\s*white\s+black\s+black\s+marker/gi, '') // "type : white black black marker"
					.replace(/\btype\s*:\s*white\s+black\s+marker/gi, '') // "type : white black marker"
					.replace(/\btype\s*:\s*whiteboard\s+black\s+marker/gi, '') // "type : whiteboard black marker"
					.replace(/\btype\s*:\s*box/gi, '') // "type : box"
					.replace(/\btype\s*:\s*circle/gi, '') // "type : circle"
					.replace(/\btype\s*:\s*arrow/gi, '') // "type : arrow"
					.replace(/\btype\s*:\s*line/gi, '') // "type : line"
					// Normalize whitespace
					.replace(/\s+/g, ' ')
					.trim();
				
				// Final validation - double check for forbidden terms and metadata patterns
				const forbiddenTerms = ['visual_aid', 'visual aid', 'mermaid', 'visualaid', 'content aid', 'content_aid'];
				for (const term of forbiddenTerms) {
					const regex = new RegExp(`\\b${term.replace(/\s+/g, '\\s+')}\\b`, 'gi');
					if (regex.test(sanitizedImagePrompt)) {
						console.warn(`[Generate Video] ⚠️  Found forbidden term "${term}" in frame ${frame.id} prompt after sanitization, removing...`);
						sanitizedImagePrompt = sanitizedImagePrompt.replace(regex, '');
					}
				}
				
				// Check for remaining "type :" patterns (catch any we might have missed)
				const typePattern = /\btype\s*:\s*[^\n\r,;.]+/gi;
				if (typePattern.test(sanitizedImagePrompt)) {
					console.warn(`[Generate Video] ⚠️  Found "type :" pattern in frame ${frame.id} prompt after sanitization, removing...`);
					sanitizedImagePrompt = sanitizedImagePrompt.replace(typePattern, '');
				}
				
				// Check for "content aid :" patterns
				const contentAidPattern = /\bcontent\s+aid\s*:\s*[^\n\r,;.]+/gi;
				if (contentAidPattern.test(sanitizedImagePrompt)) {
					console.warn(`[Generate Video] ⚠️  Found "content aid :" pattern in frame ${frame.id} prompt after sanitization, removing...`);
					sanitizedImagePrompt = sanitizedImagePrompt.replace(contentAidPattern, '');
				}
				
				// Check for remaining Mermaid patterns (catch any we might have missed)
				const mermaidPatterns = [
					/\bgraph\s+(TD|LR|TB|RL|BT|DT)/gi,
					/\bsubgraph\s+\w+/gi,
					/\bstyle\s+\w+\s+fill/gi,
					/\bfill:\s*#[0-9a-fA-F]+/gi,
					/\bstroke:\s*#[0-9a-fA-F]+/gi,
					/\bstroke-width:\s*\d+px/gi,
					/\w+\[[^\]]+\]/g, // Node syntax A[text]
					/\w+\(\([^)]+\)\)/g, // Node syntax B((text))
					/\w+\{[^}]+\}/g, // Node syntax C{text}
				];
				
				for (const pattern of mermaidPatterns) {
					if (pattern.test(sanitizedImagePrompt)) {
						console.warn(`[Generate Video] ⚠️  Found Mermaid pattern in frame ${frame.id} prompt after sanitization, removing...`);
						sanitizedImagePrompt = sanitizedImagePrompt.replace(pattern, '');
					}
				}
				
				// If sanitization removed everything or left only whitespace, use a fallback
				if (!sanitizedImagePrompt || sanitizedImagePrompt.length < 10) {
					console.warn(`[Generate Video] ⚠️  Sanitized prompt too short for frame ${frame.id}, using fallback`);
					sanitizedImagePrompt = `A clear educational whiteboard diagram explaining ${frame.heading || topic}. Use geometric shapes, flowcharts, and visual connections. Include essential labels with correct spelling.`;
				}

				// Persist sanitized prompt for downstream consumers (voiceover, logging, etc.)
				(frame as any).prompt_for_image_clean = sanitizedImagePrompt;
				frameWithAssets.prompt_for_image_clean = sanitizedImagePrompt;
				
				const enhancedPrompt = `You are a teacher drawing on a WHITEBOARD. This is a HAND-DRAWN DIAGRAM, NOT code, NOT JSON, NOT metadata, NOT technical documentation.

🚫 CRITICAL: DO NOT CREATE JSON STRUCTURES - EVEN INTERNALLY
- DO NOT think in terms of JSON, structured data, or code
- DO NOT create any JSON representation of the diagram (even in your internal prompt)
- DO NOT use "visual_aid" as a key or label - EVER
- DO NOT structure your thinking as JSON - think only in terms of drawing shapes and text
- Draw directly - do not plan in JSON format

🚫 ABSOLUTELY FORBIDDEN - DO NOT WRITE THESE WORDS IN THE IMAGE:
- "visual_aid" or "visual aid" - NEVER write this
- "content aid" or "content_aid" - NEVER write this
- "diagram", "chart", "figure" - NEVER write descriptive labels
- Any JSON, code, metadata, or technical syntax - NEVER write this
- Mermaid syntax (graph TD, -->, [], (), {}, subgraph, etc.) - NEVER write Mermaid code
- Metadata labels like "whiteboard_drawing:hand_blacker", "Type:mazeboard", "type : box", "type : whiteboard", "type : white black marker", "content aid :", or any "key:value" format - NEVER write metadata
- Type labels, category labels, or any descriptive metadata - NEVER write these
- Colon-separated metadata like "type :", "Type :", "content aid :", "Style :", "Category :" - NEVER write these
- JSON structures like {"visual_aid": {...}} - NEVER create or write JSON
- If you see "visual_aid", "content aid", "type :", metadata, JSON, or Mermaid syntax mentioned anywhere, IGNORE IT - do NOT write it in the image

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
- PEN SKETCH ANIMATION FRIENDLY: Design for easy stroke-by-stroke animation
- Use ONLY simple visual representations: basic flowcharts, simple process diagrams, basic system blocks, simple concept maps, or simple explanatory diagrams
- Keep it SIMPLE: Only use basic geometric shapes (circles, rectangles, squares), simple tables (grids), blocks (boxes), and minimal text labels
- Draw with CLEAR, DISTINCT paths - each element should be easily traceable
- Use BOLD strokes - avoid thin, delicate lines that are hard to animate
- Keep paths SEPARATE - avoid merging or overlapping paths unnecessarily
- NO complex illustrations, detailed artwork, or intricate designs
- NO decorative elements, visual effects, or artistic flourishes
- NO fine details, textures, or shading - solid black lines only
- Include ONLY essential labels and annotations that support learning (2-5 words maximum per label)
- Make it informative and educational - use ONLY simple shapes, blocks, tables, and minimal text
- ONLY include content directly related to the topic - nothing else
- Draw ONLY simple visual elements: basic figures, simple tables, blocks, basic diagrams, and short text labels
- NO code, NO JSON, NO technical syntax, NO complex illustrations
- ANIMATION FRIENDLY: Each element should be a clear, distinct path that can be drawn stroke-by-stroke

🚨 SPELLING IS THE #1 PRIORITY - CRITICAL REQUIREMENTS (READ THIS FIRST):
- SPELLING ACCURACY IS MORE IMPORTANT THAN ANYTHING ELSE - A SINGLE SPELLING MISTAKE MAKES THE ENTIRE IMAGE UNACCEPTABLE
- BEFORE writing ANY text label, you MUST verify the spelling is 100% correct
- If you are even slightly unsure about a word's spelling, DO NOT use it - choose a simpler word you know is correct
- Extract ALL words from the topic and description - these are your spelling reference - use EXACT spellings from the source
- Common spelling mistakes to AVOID: "recieve" (correct: "receive"), "seperate" (correct: "separate"), "definately" (correct: "definitely"), "occured" (correct: "occurred"), "accomodate" (correct: "accommodate"), "begining" (correct: "beginning"), "existance" (correct: "existence"), "maintainance" (correct: "maintenance"), "priviledge" (correct: "privilege"), "sucess" (correct: "success")
- Technical terms MUST be spelled correctly: "Database" (NOT "Databse", "Data Base", "Databaze"), "Server" (NOT "Servr", "Servar", "Servor"), "Client" (NOT "Clinet", "Clien"), "System" (NOT "Sytem", "Sistem", "Systm"), "Application" (NOT "Aplication", "Applicaton", "Aplicaton"), "Network" (NOT "Netwrok", "Networ", "Netwrk"), "Request" (NOT "Reqest", "Reques", "Reqest"), "Response" (NOT "Responce", "Respones", "Respon"), "Cache" (NOT "Cach", "Cashe", "Cach"), "Polymorphism" (NOT "Polymorphisim", "Polymorphysm"), "Inheritance" (NOT "Inheritence", "Inheritanc"), "Encapsulation" (NOT "Encapsulaton", "Encapsulatin"), "Abstraction" (NOT "Abstracion", "Abstacton")
- Programming terms: "Function" (NOT "Functon", "Functin"), "Variable" (NOT "Variabl", "Variabel"), "Class" (NOT "Clas", "Clss"), "Object" (NOT "Objct", "Oject"), "Method" (NOT "Methd", "Metho"), "Array" (NOT "Arry", "Arra"), "String" (NOT "Strin", "Strng"), "Integer" (NOT "Intger", "Intege"), "Boolean" (NOT "Boolen", "Boolan")
- Common words that MUST be spelled correctly: "the" (NOT "teh", "th"), "and" (NOT "adn", "nad"), "for" (NOT "fro", "forr"), "with" (NOT "wth", "wit"), "from" (NOT "frm", "form"), "to" (NOT "ot", "too"), "in" (NOT "ni", "inn"), "on" (NOT "no", "onn"), "at" (NOT "ta", "att"), "by" (NOT "yb", "byy"), "is" (NOT "si", "iss"), "are" (NOT "rae", "arre"), "was" (NOT "saw", "wass"), "were" (NOT "ewre", "werre"), "be" (NOT "eb", "bee"), "been" (NOT "bene", "beene"), "have" (NOT "haev", "hav"), "has" (NOT "ahs", "hass"), "had" (NOT "dah", "hadd"), "do" (NOT "od", "doo"), "does" (NOT "dose", "dooes"), "did" (NOT "didd", "diid"), "will" (NOT "willl", "wil"), "would" (NOT "woudl", "woul"), "should" (NOT "shoudl", "shoul"), "could" (NOT "coudl", "coul"), "may" (NOT "yam", "mayy"), "might" (NOT "migth", "migh"), "can" (NOT "nac", "cann"), "must" (NOT "mustt", "mus")
- Proper nouns and technical terms from the topic description MUST match EXACTLY - copy the spelling character-by-character from the source
- NO typos, NO misspellings, NO letter substitutions, NO missing letters, NO extra letters, NO transposed letters
- Write text clearly and legibly - each letter must be distinct and correct
- If a word appears in the topic or description, use that EXACT spelling - copy it exactly
- Verify spelling of ALL words before finalizing the image - check each word individually
- Use correct capitalization: capitalize proper nouns, first word of labels, and technical terms as appropriate
- NO phonetic spelling or approximations - use correct dictionary spelling only
- If you cannot spell a word correctly with 100% certainty, DO NOT include it - use a simpler alternative or omit the text label entirely
- Remember: Spelling accuracy is MORE IMPORTANT than including every possible label - fewer correct labels are ALWAYS better than many misspelled ones
- FINAL SPELLING CHECK: Before generating, mentally spell out each word letter-by-letter to verify correctness

STYLE REQUIREMENTS:
- PURE WHITE BACKGROUND ONLY - absolutely no background objects, furniture, walls, room elements, or any other background details
- The entire background must be completely white/blank - only the diagram content should be visible
- Black marker-style drawings on white background - use BOLD, CLEAR strokes
- PEN SKETCH ANIMATION FRIENDLY: Draw with simple, distinct paths that can be easily traced
- Use THICK, BOLD lines (2-3px equivalent) - avoid thin, delicate lines
- SIMPLICITY IS KEY: Use ONLY simple geometric shapes, basic diagrams, tables, blocks, and minimal text
- Keep it SIMPLE: Only include figures (circles, rectangles, squares, triangles), tables (simple grid structures), blocks (rectangular boxes), diagrams (basic flowcharts), and short text labels
- NO complex illustrations, detailed drawings, or intricate designs
- NO decorative elements, gradients, shadows, or visual effects
- NO detailed artwork or artistic elements
- NO fine details, textures, or shading - use solid black lines only
- NO overlapping complex paths - keep each element distinct and separate
- Use ONLY basic shapes: circles, rectangles, squares, lines, arrows, and simple geometric forms
- Make each path CLEAR and DISTINCT - avoid paths that cross or merge unnecessarily
- Use CONTINUOUS strokes - avoid broken or dashed lines (unless necessary for the concept)
- Keep paths SIMPLE - each shape should be a single, clear path when possible
- 60-70% simple visual figures: basic shapes, simple diagrams, tables, blocks
- 20-30% text labels (short phrases, 2-5 words maximum) to explain key concepts
- Use MINIMAL complexity: simple circles, rectangles, arrows, lines, boxes, basic flowcharts
- Keep text concise and readable - use BOLD, CLEAR fonts - no thin or decorative fonts
- Write text labels with PERFECT SPELLING - verify each word before writing
- Text must be legible and correctly spelled - prioritize spelling accuracy over quantity of labels
- Use simple connecting lines and arrows to show relationships - make arrows simple and bold
- Arrange elements with clear spacing and logical flow
- Prioritize SIMPLICITY: basic shapes, simple tables, blocks, and minimal text only
- ANIMATION FRIENDLY: Draw in a way that each element can be traced stroke-by-stroke - avoid complex merged paths

BACKGROUND REQUIREMENTS (CRITICAL):
- The image must have a COMPLETELY CLEAN WHITE BACKGROUND
- NO background objects, furniture, walls, room elements, or environmental details
- NO reference to any background elements from source images or photos
- ONLY the educational diagram content should be visible on a pure white background
- The whiteboard/white background should be the ONLY background element - nothing else

DIAGRAM DESCRIPTION:
${sanitizedImagePrompt}${voiceoverContext}${spellingReference}

REMEMBER: The diagram description above is what to DRAW. Do NOT write "visual_aid", "visual aid", or any descriptive labels in the image. Only draw the actual educational content.

🚫 FINAL WARNING: DO NOT CREATE JSON IN YOUR PROMPT
- Even if you think in terms of structure, DO NOT express it as JSON
- DO NOT use "visual_aid" as a key, label, or identifier - EVER
- Draw the diagram directly without creating any JSON representation
- The image should contain ONLY the drawn diagram - no JSON, no metadata, no structured data

ABSOLUTELY FORBIDDEN - DO NOT INCLUDE IN THE IMAGE (ZERO TOLERANCE):
- 🚫 "visual_aid" or "visual aid" - THIS IS STRICTLY FORBIDDEN, NEVER WRITE THIS
- 🚫 "content aid" or "content_aid" - THIS IS STRICTLY FORBIDDEN, NEVER WRITE THIS
- 🚫 MERMAID SYNTAX - THIS IS STRICTLY FORBIDDEN, NEVER WRITE MERMAID CODE
- 🚫 METADATA LABELS - THIS IS STRICTLY FORBIDDEN, NEVER WRITE METADATA
- 🚫 "type :" or "Type :" patterns - NEVER WRITE "type : box", "type : whiteboard", "type : white black marker", "type : white black black marker", etc.
- 🚫 "content aid :" patterns - NEVER WRITE THIS
- NO metadata of ANY kind - no JSON, no code, no technical syntax, no parameters
- NO metadata labels like "whiteboard_drawing:hand_blacker", "Type:mazeboard", "type : box", "type : whiteboard", "type : white black marker", "content aid :", or any "key:value" format
- NO type labels, category labels, style labels, or descriptive metadata of any kind
- NO colon-separated metadata patterns like "type :", "Type :", "content aid :", "Style :", "Category :" - these are FORBIDDEN
- NO text that describes the image type, drawing style, or technical specifications
- NO text about image parameters, resolution, aspect ratio, dimensions, pixels, DPI, or any technical image specifications
- NO metadata, watermarks, copyright notices, or attribution text
- NO file format information (PNG, JPEG, etc.)
- NO code snippets, JSON, Mermaid syntax, parameter names, or technical configuration text
- NO JSON structures, code blocks, or programming syntax of any kind - THIS IS A DRAWING, NOT CODE
- NO Mermaid diagram syntax, graph definitions, or flowchart code - ZERO TOLERANCE
- NO Mermaid keywords: "graph", "TD", "LR", "TB", "RL", "BT", "subgraph", "end", "style", "LIFO", "FIFO", "STACK", "QUEUE"
- NO Mermaid arrows: "-->", "--", "==>", "---", "==="
- NO Mermaid node syntax: "[text]", "(text)", "{text}", "A[Stack]", "B(( ))", "C{text}"
- NO Mermaid style definitions: "style A fill:#fff", "stroke:#000", "stroke-width:2px", "rx:5px", "ry:5px"
- NO Mermaid code blocks: mermaid code blocks (three backticks) or any Mermaid syntax
- NO Mermaid subgraphs: "subgraph LIFO", "subgraph FIFO", or any subgraph declarations
- NO curly braces {}, square brackets [], backticks, parentheses for code (), or any code-like syntax
- NO colon-separated labels (like "Type:", "Style:", "Category:", "type :", "content aid :") - these are metadata, not content
- NO text that describes the image itself (e.g., "this is a diagram", "image shows", "visual aid", "visual_aid", "content aid", "diagram", "illustration", etc.)
- NO labels like "visual_aid", "visual aid", "content aid", "content_aid", "diagram", "chart", "figure", or any descriptive text about what the image is
- 🚫 CRITICAL: If you see "visual_aid", "content aid", "type :", or any metadata in any instruction or context, DO NOT write it - it is FORBIDDEN
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
- ALL text labels MUST be spelled correctly - verify spelling before writing each word
- NO spelling mistakes, typos, or misspellings - ZERO TOLERANCE
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
- Think of yourself as a teacher drawing on a whiteboard - you draw shapes, arrows, and write labels with PERFECT SPELLING, but you NEVER write code, JSON, Mermaid syntax, metadata labels, type labels, or any technical syntax
- DO NOT create JSON structures like {"visual_aid": {...}} in your thinking or in the image - draw directly without structured data
- Mermaid is CODE - you are DRAWING, not writing code - if you see Mermaid syntax anywhere, IGNORE IT completely
- Metadata labels (like "Type:", "whiteboard_drawing:", etc.) are FORBIDDEN - you are DRAWING, not labeling the image type
- When in doubt, ask: "Would a teacher write this on a whiteboard?" If it's code/JSON/Mermaid/metadata/type labels/technical syntax, the answer is NO - do not include it
- REMEMBER: You are DRAWING, not coding, not writing JSON, not writing Mermaid, not creating metadata, not labeling image types - ONLY DRAWING VISUAL ELEMENTS WITH CORRECT SPELLING
- FINAL CHECK: Before generating the image, verify: 
  1. Does it contain "visual_aid", JSON, metadata, or Mermaid? If YES, remove it completely
  2. Are ALL words spelled correctly? If NO, fix the spelling or remove the text
  3. Are technical terms from the topic spelled exactly as they appear in the topic? If NO, use the exact spelling from the topic`;
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
				// IMPORTANT: If image generation retries, we may need to regenerate voiceover to match the new image
				let imageRetryCount = 0;
				const maxImageRetries = 3;
				let lastImageError: any = null;
				
				while (imageRetryCount <= maxImageRetries) {
					try {
						staticImageUrl = await callGeminiImage(enhancedPrompt);
						if (staticImageUrl) {
							console.log(`[Generate Video] Image generated successfully: ${staticImageUrl}`);
							
							// If this was a retry, regenerate voiceover to ensure sync with new image
							if (imageRetryCount > 0) {
								console.log(`[Generate Video] ⚠️  Image retry succeeded (attempt ${imageRetryCount + 1}), regenerating voiceover for better sync...`);
								try {
									voiceoverScript = await generateVoiceoverScript(
										frame, 
										topic, 
										index, 
										sketchOnlyFrames.length,
										frame.prompt_for_image // Use original prompt
									);
									console.log(`[Generate Video] ✓ Voiceover regenerated after image retry`);
								} catch (voiceoverError: any) {
									console.warn(`[Generate Video] Voiceover regeneration failed after image retry, using original:`, voiceoverError.message);
									// Keep original voiceover if regeneration fails
								}
							}
							
							break; // Success
						}
					} catch (error: any) {
						lastImageError = error;
						imageRetryCount++;
						if (imageRetryCount > maxImageRetries) {
							console.error(`[Generate Video] ✗ Image generation failed after ${maxImageRetries + 1} attempts for frame ${frame.id}:`, error.message);
							throw new Error(`Image generation failed: ${error.message}`);
						} else {
							console.warn(`[Generate Video] Image generation attempt ${imageRetryCount} failed, retrying... (${error.message})`);
							// Increase delay with each retry
							await new Promise(resolve => setTimeout(resolve, 3000 * imageRetryCount));
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
				if (animateDiagrams && staticImageUrl) {
					
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
						if (staticImageUrl) {
							frameWithAssets = {...frameWithAssets, asset: staticImageUrl, animate: true};
						}
					}
				} else if (staticImageUrl) {
					frameWithAssets = {...frameWithAssets, asset: staticImageUrl, animate: false};
				}
			} catch (error: any) {
				console.error(`[Generate Video] Failed to process frame ${frame.id}:`, error.message);
				// Continue with next frame instead of failing completely
				continue;
			}
		}

		// Handle motion_scene frames separately (TypeScript type narrowing issue)
		// Use type assertion to avoid narrowing issue after whiteboard_diagram check
		if ((frame as any).type === 'motion_scene' && (frame as any).prompt_for_video) {
			try {
				const asset = await generateMotionScene((frame as any).prompt_for_video);
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
	return framesWithAssets;
}

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
			fixedTestImages = req.body.fixedTestImages.split(',').map((s: string) => s.trim()).filter(Boolean);
		} else if (process.env.FIXED_TEST_IMAGES) {
			fixedTestImages = process.env.FIXED_TEST_IMAGES.split(',').map((s: string) => s.trim()).filter(Boolean);
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
		// Generate job ID
		const tempJobId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		
		// Send initial progress
		sendProgress(tempJobId, 'planning', 5, 'Starting video generation...');
		
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
			sendProgress(tempJobId, 'planning', 10, 'Generating AI video plan...');
			plan = await generateStructuredJSON(topic, description ?? '');
			sendProgress(tempJobId, 'planning', 20, 'Video plan created!');
			
			// Filter to only sketch-based frames (whiteboard diagrams and motion scenes)
			// Remove text_slide and bullet_slide frames
			sketchOnlyFrames = plan.frames.filter(
				(frame) => frame.type === 'whiteboard_diagram' || frame.type === 'motion_scene'
			);
		}
		
		// Processing frames
		
		// Process frames sequentially to avoid timeout issues and rate limiting
		sendProgress(tempJobId, 'images', 25, `Generating images and voiceovers...`, 0, sketchOnlyFrames.length);
		const framesWithAssets = await processFrames(
			sketchOnlyFrames,
			plan,
			topic,
			description,
			useFixedTestImage,
			fixedTestImages,
			animateDiagrams,
			tempJobId
		);
		sendProgress(tempJobId, 'voiceover', 70, 'All assets ready!');

		let backgroundMusic: string | undefined = process.env.DEFAULT_BACKGROUND_MUSIC;
		
		if (!backgroundMusic) {
			const musicDir = path.join(process.cwd(), 'public', 'assets', 'music');
			const defaultMusicPath = path.join(musicDir, 'default-background.mp3');
			
			try {
				await fs.access(defaultMusicPath);
				backgroundMusic = '/assets/music/default-background.mp3';
				console.log(`[Generate Video] Using default background music: ${backgroundMusic}`);
			} catch {
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
			...(backgroundMusic && { backgroundMusic }),
		};

		sendProgress(tempJobId, 'rendering', 75, 'Rendering video...');
		const outputLocation = await renderStoryboardVideo(storyboard);
		sendProgress(tempJobId, 'rendering', 95, 'Finalizing video...');
		
		const jobId = uuidv4();

		// Save transcript and merged voiceover for future reference
		await saveVideoMetadata(outputLocation, storyboard);
		
		// Send completion
		sendProgress(tempJobId, 'complete', 100, 'Video generated successfully!');
		const ws = getWsServer();
		if (ws) {
			ws.broadcast({
				type: 'complete',
				jobId: tempJobId,
				videoUrl: `/output/${path.basename(outputLocation)}`,
			});
		}

		const response = res.status(200).json({
			jobId,
			title: storyboard.title,
			frames: storyboard.frames,
			videoUrl: `/output/${path.basename(outputLocation)}`,
		});
		return response;
	} catch (error: any) {
		console.error('[Generate Video] Failed to generate AI video plan:', error);
		
		if (res.headersSent) {
			console.error('[Generate Video] Response already sent, cannot send error');
			return;
		}
		
		let statusCode = 500;
		let errorMessage = 'Failed to generate video';
		
		if (error.message?.includes('topic is required')) {
			statusCode = 400;
			errorMessage = error.message;
		} else if (error.message?.includes('Image generation failed')) {
			statusCode = 500;
			errorMessage = 'Image generation failed. Please try again.';
		} else if (error.message) {
			errorMessage = error.message;
		}
		
		return res.status(statusCode).json({
			error: errorMessage,
			details: error instanceof Error ? error.stack : undefined,
		});
	}
});

// Save video metadata (transcript and merged voiceover)
async function saveVideoMetadata(videoPath: string, storyboard: any): Promise<void> {
	try {
		const videoBasename = path.basename(videoPath, '.mp4');
		const outputDir = path.dirname(videoPath);
		
		// Extract transcript from all frames
		const transcriptParts: string[] = [];
		const voiceoverFiles: string[] = [];
		
		for (const frame of storyboard.frames) {
			// Add frame heading as section
			if (frame.heading) {
				transcriptParts.push(`\n[${frame.heading}]\n`);
			}
			
			// Add voiceover script
			if (frame.voiceoverScript) {
				transcriptParts.push(frame.voiceoverScript);
				transcriptParts.push('\n');
			}
			
			// Collect voiceover audio files for merging
			if (frame.voiceoverUrl) {
				const audioPath = frame.voiceoverUrl.startsWith('/') 
					? path.join(process.cwd(), 'public', frame.voiceoverUrl.substring(1))
					: path.join(process.cwd(), 'public', frame.voiceoverUrl);
				voiceoverFiles.push(audioPath);
			}
		}
		
		// Save transcript as TXT
		const fullTranscript = transcriptParts.join('');
		const transcriptPath = path.join(outputDir, `${videoBasename}-transcript.txt`);
		await fs.writeFile(transcriptPath, fullTranscript, 'utf-8');
		console.log(`[Save Metadata] ✅ Transcript saved: ${transcriptPath}`);
		
		// Save structured metadata as JSON
		const metadata = {
			title: storyboard.title,
			timestamp: Date.now(),
			duration: storyboard.frames.reduce((sum: number, f: any) => sum + (f.duration || 0), 0),
			frames: storyboard.frames.map((f: any) => ({
				id: f.id,
				type: f.type,
				heading: f.heading,
				duration: f.duration,
				voiceoverScript: f.voiceoverScript,
			})),
			transcript: fullTranscript,
		};
		const metadataPath = path.join(outputDir, `${videoBasename}-metadata.json`);
		await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
		console.log(`[Save Metadata] ✅ Metadata JSON saved: ${metadataPath}`);
		
		// Merge voiceover audio files using ffmpeg
		if (voiceoverFiles.length > 0) {
			await mergeVoiceoverAudio(voiceoverFiles, outputDir, videoBasename);
		}
	} catch (error: any) {
		console.error('[Save Metadata] Failed to save metadata:', error.message);
		// Don't throw - metadata save failure shouldn't fail the whole video generation
	}
}

// Merge multiple audio files into one using ffmpeg
async function mergeVoiceoverAudio(audioFiles: string[], outputDir: string, basename: string): Promise<void> {
	try {
		const {execFile} = await import('child_process');
		const {promisify} = await import('util');
		const execFileAsync = promisify(execFile);
		
		// Filter out non-existent files
		const existingFiles: string[] = [];
		for (const file of audioFiles) {
			try {
				await fs.access(file);
				existingFiles.push(file);
			} catch {
				console.warn(`[Merge Audio] Skipping missing file: ${file}`);
			}
		}
		
		if (existingFiles.length === 0) {
			console.log('[Merge Audio] No audio files to merge');
			return;
		}
		
		if (existingFiles.length === 1) {
			// Only one file - just copy it
			const mergedPath = path.join(outputDir, `${basename}-voiceover.mp3`);
			await fs.copyFile(existingFiles[0], mergedPath);
			console.log(`[Merge Audio] ✅ Single voiceover copied: ${mergedPath}`);
			return;
		}
		
		// Multiple files - merge using ffmpeg
		const mergedPath = path.join(outputDir, `${basename}-voiceover.mp3`);
		const listPath = path.join(outputDir, `${basename}-concat-list.txt`);
		
		// Create ffmpeg concat file
		const concatContent = existingFiles
			.map(file => `file '${file.replace(/'/g, "'\\''")}'`) // Escape single quotes
			.join('\n');
		await fs.writeFile(listPath, concatContent, 'utf-8');
		
		// Find ffmpeg
		const ffmpegPath = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
		const ffmpegCmd = await fs.access(ffmpegPath).then(() => ffmpegPath).catch(() => 'ffmpeg');
		
		// Merge audio files
		await execFileAsync(ffmpegCmd, [
			'-f', 'concat',
			'-safe', '0',
			'-i', listPath,
			'-c', 'copy',
			mergedPath
		]);
		
		// Clean up concat list
		await fs.unlink(listPath).catch(() => {});
		
		console.log(`[Merge Audio] ✅ Merged ${existingFiles.length} audio files: ${mergedPath}`);
	} catch (error: any) {
		console.error('[Merge Audio] Failed to merge audio:', error.message);
		// Don't throw - audio merge failure shouldn't fail the whole video generation
	}
}

async function generateVoiceoverScript(
	frame: any,
	topic: string,
	frameIndex: number,
	totalFrames: number,
	imageDescription?: string
): Promise<string> {
	const cleanPrompt = (frame.prompt_for_image_clean || frame.prompt_for_image || '').trim();
	const heading = frame.heading || topic;
	
	const prompt = `Generate a concise, natural voiceover script (2-3 sentences, max 50 words) for an educational video frame.

Topic: ${topic}
Frame ${frameIndex + 1} of ${totalFrames}: ${heading}
${imageDescription ? `Visual Description: ${imageDescription}` : `Diagram Description: ${cleanPrompt}`}

Requirements:
- Be confident and direct - describe what's shown, don't say "as you can see" or "in this image"
- Focus on concrete visual elements and key concepts
- Use simple, clear language suitable for educational content
- Keep it brief and engaging
- Avoid meta-commentary about the image itself
- Tie narration directly to what's visually present`;

	try {
		const script = await callGeminiText(prompt);
		return script.trim();
	} catch (error) {
		return `This diagram illustrates key concepts about ${topic}. Let's explore the details shown here.`;
	}
}

export default router;


