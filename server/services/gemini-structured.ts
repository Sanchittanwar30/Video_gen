import {callGeminiText} from './gemini';

export type StructuredFrameType =
	| 'whiteboard_diagram'
	| 'text_slide'
	| 'bullet_slide'
	| 'motion_scene';

export interface StructuredFrame {
	id: string;
	type: StructuredFrameType;
	prompt_for_image?: string;
	prompt_for_video?: string;
	heading?: string;
	text?: string;
	bullets?: string[];
	duration?: number;
	asset?: string;
}

export interface StructuredVideoPlan {
	title: string;
	frames: StructuredFrame[];
}

const PROMPT_TEMPLATE = `You are an AI that outputs STRICT valid JSON for educational whiteboard-style videos.

IMPORTANT: Generate an appropriate number of whiteboard diagram frames based on the topic complexity and content. Do NOT include text_slide or bullet_slide frames.
Only use: "whiteboard_diagram" frame type.

CRITICAL REQUIREMENTS:
- Generate up to 5 whiteboard diagram frames maximum (flexible: 1-5 frames based on topic complexity)
- Each frame must be VISUAL and FIGURE-FOCUSED with minimal text
- First frame: Introduction/overview using diagrams and figures
- Subsequent frames: Progressively detailed explanations using visual diagrams and shapes
- Focus on diagrams, shapes, figures, flowcharts, and visual elements
- MINIMAL TEXT - only essential labels if needed (less than 10% text)
- Prioritize geometric shapes, visual connections, and diagrammatic representations
- Make each sketch illustration-heavy and text-light
- Break down complex topics into multiple frames if needed to ensure clarity
- Generate the appropriate number of frames for the topic (simple topics may need fewer frames, complex topics may need more)

Given topic + description, output:
{
  "title": "string",
  "frames": [
    {
      "id": "frame_1",
      "type": "whiteboard_diagram",
      "prompt_for_image": "A clear educational whiteboard diagram explaining [specific concept from topic] - introduction/overview. Use geometric shapes, flowcharts, and visual connections to show the main concept. Include essential labels (less than 10% text). Make it informative and directly related to the topic.",
      "heading": "CRITICAL: Must be directly related to the input topic. Use a concise, topic-specific heading that describes what this frame explains (e.g., 'Introduction to [topic]', 'Understanding [key concept]', '[Topic] Overview'). Do NOT use generic titles like 'Frame 1' or random unrelated titles.",
      "duration": 4
    },
    {
      "id": "frame_2",
      "type": "whiteboard_diagram",
      "prompt_for_image": "A clear educational whiteboard diagram explaining [specific aspect of topic] in detail. Use geometric shapes, flowcharts, and visual connections to show relationships and processes. Include essential labels (less than 10% text). Make it informative and directly related to the topic.",
      "heading": "CRITICAL: Must be directly related to the input topic. Use a concise, topic-specific heading that describes what this frame explains. Do NOT use generic titles like 'Frame 2' or random unrelated titles.",
      "duration": 4
    }
    // Maximum 5 frames total - generate 1-5 frames based on topic complexity
  ]
}

EXAMPLE of good prompt_for_image:
"A clear educational whiteboard diagram explaining [specific concept from topic] using geometric shapes, flowcharts, and visual connections. Show [specific relationships, processes, or structures relevant to the topic]. Include essential labels (less than 10% text) that help explain the concept. Make it informative and directly related to the topic - avoid abstract or decorative elements. ALL text labels must be spelled correctly with zero tolerance for spelling mistakes."

IMPORTANT: Each prompt_for_image must be specific to the topic and create a meaningful educational diagram. Avoid generic descriptions. Focus on creating diagrams that clearly explain the concept being taught.

CRITICAL: The prompt_for_image should describe what to DRAW, not what to LABEL. Do NOT include any text in the prompt that suggests adding labels like "visual_aid", "visual aid", "diagram", "chart", or any descriptive text about what the image is. Only describe the actual educational content to be drawn.

🚫 ABSOLUTELY FORBIDDEN - THESE WORDS MUST NEVER APPEAR IN prompt_for_image:
- "visual_aid" - FORBIDDEN WORD, NEVER USE
- "visual aid" - FORBIDDEN PHRASE, NEVER USE
- "content aid" or "content_aid" - FORBIDDEN WORDS, NEVER USE
- "mermaid" - FORBIDDEN WORD, NEVER USE (this is code syntax, not drawing)
- "diagram" - FORBIDDEN as a label (you can say "draw shapes" but not "draw a diagram")
- "chart" - FORBIDDEN as a label
- "figure" - FORBIDDEN as a label
- "type :" or "Type :" - FORBIDDEN PATTERN, NEVER USE (e.g., "type : box", "type : whiteboard", "type : white black marker")
- "content aid :" - FORBIDDEN PATTERN, NEVER USE
- Any JSON structures, code blocks, or metadata syntax
- Any Mermaid syntax (graph TD, -->, [], (), etc.) - Mermaid is CODE, not drawing
- Any "Type:", "type :", "Style:", "Category:", "content aid :" or key:value metadata - FORBIDDEN
- Any backticks, code fences, or technical syntax
- Any structured data formats or schemas

CRITICAL INSTRUCTION: When generating prompt_for_image, imagine you are a teacher telling another teacher what to draw on a whiteboard. Use ONLY simple, direct instructions like:
- "Draw a rectangle with the text 'Object' inside it"
- "Draw three circles connected by arrows"
- "Draw a flowchart with boxes labeled 'Start', 'Process', 'End'"

DO NOT use phrases like:
- "Create a visual aid showing..." ❌
- "Draw a mermaid diagram..." ❌
- "Generate a diagram of type..." ❌
- "Use mermaid syntax to..." ❌

ONLY use phrases like:
- "Draw shapes showing..." ✅
- "Create a flowchart with..." ✅
- "Draw boxes and arrows representing..." ✅

The prompt_for_image must be a simple, plain English sentence describing ONLY the visual elements to draw. Example: "Draw a rectangle labeled 'Object' with three arrows pointing to shapes labeled 'Square', 'Circle', and 'Triangle'."

SPELLING REQUIREMENT: When describing text labels to include, emphasize that ALL words must be spelled correctly. Use exact spellings from the topic description. If technical terms are mentioned, use their exact spelling.

Focus on visual storytelling through DIAGRAMS, FIGURES, and SHAPES. Generate 1-5 figure-focused whiteboard diagram frames with minimal text that explain the topic visually. Generate the appropriate number of frames based on topic complexity - simple topics may need 1-2 frames, complex topics may need up to 5 frames.
The JSON must be valid. No prose or markdown.`;

const validatePlan = (plan: StructuredVideoPlan): StructuredVideoPlan => {
	if (!plan || typeof plan !== 'object') {
		throw new Error('Structured plan response invalid');
	}

	if (typeof plan.title !== 'string' || !plan.title.trim()) {
		throw new Error('Structured plan missing title');
	}

	if (!Array.isArray(plan.frames) || !plan.frames.length) {
		throw new Error('Structured plan must include frames');
	}

	const validatedFrames = plan.frames.map((frame, index) => {
		if (!frame || typeof frame !== 'object') {
			throw new Error(`Frame at index ${index} is invalid`);
		}

		const type = frame.type as StructuredFrameType;
		if (
			!['whiteboard_diagram', 'text_slide', 'bullet_slide', 'motion_scene'].includes(type)
		) {
			throw new Error(`Frame type for ${frame.id ?? `index ${index}`} is invalid`);
		}

		const duration = Number.isFinite(frame.duration) ? Number(frame.duration) : 4;

		// Ensure whiteboard diagrams have detailed prompts and sanitize them
		let prompt_for_image = frame.prompt_for_image;
		if (type === 'whiteboard_diagram' && prompt_for_image) {
			// ULTRA-AGGRESSIVE sanitization to remove ALL metadata, JSON, code blocks, Mermaid, visual_aid, etc.
			// This is the final defense - remove these terms completely
			prompt_for_image = prompt_for_image
				// Remove code blocks (JSON, markdown, Mermaid, etc.) - be EXTREMELY aggressive
				.replace(/```mermaid[\s\S]*?```/gi, '') // Remove Mermaid code blocks FIRST (most common)
				.replace(/```[\s\S]*?```/gi, '') // Remove ALL other code blocks
				.replace(/`[^`]*`/g, '') // Remove inline code
				// Remove Mermaid code blocks without backticks (multiline patterns)
				.replace(/mermaid\s*\n[\s\S]*?graph[\s\S]*?end/gi, '') // Mermaid without backticks
				.replace(/graph\s+(TD|LR|TB|RL|BT|DT)[\s\S]*?end/gi, '') // Graph blocks
				// Remove JSON structures - catch all variations
				.replace(/\{[\s\S]*?"visual_aid"[\s\S]*?\}/gi, '')
				.replace(/\{[\s\S]*?"visual[\s\S]*?aid"[\s\S]*?\}/gi, '') // Catch split variations
				.replace(/\{[\s\S]*?"drawing_[\s\S]*?\}/gi, '')
				.replace(/\{[\s\S]*?"type"[\s\S]*?\}/gi, '')
				.replace(/\{[\s\S]*?"style"[\s\S]*?\}/gi, '')
				.replace(/\{[\s\S]*?"mermaid"[\s\S]*?\}/gi, '') // Remove JSON with mermaid
				.replace(/\{[\s\S]*?\}/g, '') // Remove ANY remaining JSON objects
				// Remove arrays with metadata
				.replace(/\[[\s\S]*?"visual_aid"[\s\S]*?\]/gi, '')
				.replace(/\[[\s\S]*?"mermaid"[\s\S]*?\]/gi, '') // Remove arrays with mermaid
				.replace(/\[[\s\S]*?\]/g, '') // Remove ANY remaining arrays
				// Remove FORBIDDEN WORDS completely - case insensitive, all variations
				.replace(/\bvisual_aid\b/gi, '')
				.replace(/\bvisual\s+aid\b/gi, '')
				.replace(/\bvisualaid\b/gi, '')
				.replace(/\bcontent\s+aid\b/gi, '') // Remove "content aid"
				.replace(/\bcontent_aid\b/gi, '') // Remove "content_aid"
				.replace(/\bcontentaid\b/gi, '') // Remove "contentaid"
				.replace(/\bmermaid\b/gi, '') // Remove mermaid completely
				.replace(/\bmer\s*maid\b/gi, '') // Catch split variations
				.replace(/drawing_instructions/gi, '')
				.replace(/drawing_elements/gi, '')
				.replace(/whiteboard_drawing/gi, '')
				// Remove Mermaid syntax patterns - be EXTREMELY aggressive
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
				// Now remove brackets/parentheses
				.replace(/\[/g, '')
				.replace(/\]/g, '')
				.replace(/\(/g, '')
				.replace(/\)/g, '')
				.replace(/\{/g, '')
				.replace(/\}/g, '')
				// Remove backticks completely
				.replace(/`+/g, '')
				// Remove metadata patterns with colons - be VERY aggressive
				.replace(/\btype\s*:\s*[^\n\r,;.]+/gi, '') // Remove "type : anything" (until newline, comma, semicolon, period)
				.replace(/\bType\s*:\s*[^\n\r,;.]+/gi, '') // Case variations
				.replace(/\bTYPE\s*:\s*[^\n\r,;.]+/gi, '')
				.replace(/\btype\s*:\s*white[^\n\r,;.]+/gi, '') // "type : white..." patterns
				.replace(/\btype\s*:\s*black[^\n\r,;.]+/gi, '') // "type : black..." patterns
				.replace(/\btype\s*:\s*box/gi, '') // "type : box"
				.replace(/\btype\s*:\s*marker/gi, '') // "type : marker"
				.replace(/\btype\s*:\s*whiteboard/gi, '') // "type : whiteboard"
				.replace(/\b(Style|Category|style|category)\s*:\s*[^\n\r,;.]+/gi, '')
				.replace(/\bcontent\s+aid\s*:\s*[^\n\r,;.]+/gi, '') // "content aid :" patterns
				.replace(/\bcontent_aid\s*:\s*[^\n\r,;.]+/gi, '')
				.replace(/\w+_\w+\s*:\s*[^\n\r,;.]+/g, '') // key_key:value patterns (extended)
				// Remove specific problematic patterns
				.replace(/\btype\s*:\s*white\s+black\s+black\s+marker/gi, '') // "type : white black black marker"
				.replace(/\btype\s*:\s*white\s+black\s+marker/gi, '') // "type : white black marker"
				.replace(/\btype\s*:\s*whiteboard\s+black\s+marker/gi, '') // "type : whiteboard black marker"
				// Remove phrases that might contain these terms
				.replace(/using\s+mermaid/gi, '')
				.replace(/mermaid\s+diagram/gi, '')
				.replace(/mermaid\s+syntax/gi, '')
				.replace(/mermaid\s+code/gi, '')
				.replace(/create\s+a\s+visual\s+aid/gi, '')
				.replace(/visual\s+aid\s+showing/gi, '')
				.replace(/visual\s+aid\s+for/gi, '')
				// Normalize whitespace
				.replace(/\s+/g, ' ')
				.trim();
			
			// Final validation - if prompt still contains forbidden terms, log warning and remove them
			const forbiddenTerms = ['visual_aid', 'visual aid', 'mermaid', 'visualaid', 'content aid', 'content_aid'];
			for (const term of forbiddenTerms) {
				if (new RegExp(`\\b${term.replace(/\s+/g, '\\s+')}\\b`, 'gi').test(prompt_for_image)) {
					console.warn(`[Structured Plan] ⚠️  Found forbidden term "${term}" in frame ${frame.id} prompt after sanitization, removing...`);
					prompt_for_image = prompt_for_image.replace(new RegExp(`\\b${term.replace(/\s+/g, '\\s+')}\\b`, 'gi'), '');
				}
			}
			
			// Check for remaining "type :" patterns
			const typePattern = /\btype\s*:\s*[^\n\r,;.]+/gi;
			if (typePattern.test(prompt_for_image)) {
				console.warn(`[Structured Plan] ⚠️  Found "type :" pattern in frame ${frame.id} prompt after sanitization, removing...`);
				prompt_for_image = prompt_for_image.replace(typePattern, '');
			}
			
			// Check for "content aid :" patterns
			const contentAidPattern = /\bcontent\s+aid\s*:\s*[^\n\r,;.]+/gi;
			if (contentAidPattern.test(prompt_for_image)) {
				console.warn(`[Structured Plan] ⚠️  Found "content aid :" pattern in frame ${frame.id} prompt after sanitization, removing...`);
				prompt_for_image = prompt_for_image.replace(contentAidPattern, '');
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
				if (pattern.test(prompt_for_image)) {
					console.warn(`[Structured Plan] ⚠️  Found Mermaid pattern in frame ${frame.id} prompt after sanitization, removing...`);
					prompt_for_image = prompt_for_image.replace(pattern, '');
				}
			}
			
			// Validate prompt quality
			const promptLength = prompt_for_image.length;
			if (promptLength < 50) {
				console.warn(`[Structured Plan] ⚠️  Frame ${frame.id} has very short prompt (${promptLength} chars) after sanitization`);
			}
			
			// Check for metadata patterns that shouldn't be in the prompt
			const hasMetadata = /Type\s*:|type\s*:|Style\s*:|Category\s*:|content\s+aid\s*:|content_aid\s*:|whiteboard_drawing|visual_aid|visual\s+aid|mermaid|drawing_instructions|drawing_elements/i.test(prompt_for_image);
			if (hasMetadata) {
				console.warn(`[Structured Plan] ⚠️  Frame ${frame.id} prompt may contain metadata patterns, attempting to clean...`);
				prompt_for_image = prompt_for_image
					.replace(/\bType\s*:\s*\w+/gi, '')
					.replace(/\bStyle\s*:\s*\w+/gi, '')
					.replace(/\bCategory\s*:\s*\w+/gi, '')
					.replace(/whiteboard_drawing[:\s]*\w*/gi, '')
					.trim();
			}
		}

		return {
			id: frame.id ?? `frame_${index + 1}`,
			type,
			prompt_for_image: prompt_for_image,
			prompt_for_video: frame.prompt_for_video,
			heading: frame.heading,
			text: frame.text,
			bullets: Array.isArray(frame.bullets) ? frame.bullets : [],
			duration: duration > 0 ? duration : 4,
		};
	});

	// Validate frame count for whiteboard diagrams (should be at least 1, maximum 5)
	const whiteboardFrames = validatedFrames.filter(f => f.type === 'whiteboard_diagram');
	if (whiteboardFrames.length === 0) {
		console.warn(`[Structured Plan] No whiteboard diagram frames generated. At least one frame is required.`);
		throw new Error('Structured plan must include at least one whiteboard_diagram frame');
	}
	
	// Limit to maximum 5 whiteboard diagram frames
	if (whiteboardFrames.length > 5) {
		console.warn(`[Structured Plan] Generated ${whiteboardFrames.length} whiteboard frames, limiting to 5 frames maximum.`);
		// Keep only first 5 whiteboard frames, remove the rest
		let whiteboardCount = 0;
		const limitedFrames = validatedFrames.filter(frame => {
			if (frame.type === 'whiteboard_diagram') {
				whiteboardCount++;
				return whiteboardCount <= 5;
			}
			return true; // Keep non-whiteboard frames
		});
		validatedFrames.length = 0;
		validatedFrames.push(...limitedFrames);
	}
	
	const finalWhiteboardFrames = validatedFrames.filter(f => f.type === 'whiteboard_diagram');
	console.log(`[Structured Plan] Generated ${finalWhiteboardFrames.length} whiteboard diagram frame(s) (limited to 5 maximum).`);

	return {
		title: plan.title.trim(),
		frames: validatedFrames,
	};
};

export const generateStructuredJSON = async (
	topic: string,
	description: string
): Promise<StructuredVideoPlan> => {
	try {
		const response = await callGeminiText(
			`${PROMPT_TEMPLATE}

Topic: ${topic}
${description ? `Description: ${description}` : ''}

CRITICAL: Generate 1-5 figure-focused whiteboard diagram frames based on topic complexity. Each prompt_for_image must emphasize diagrams, shapes, figures, and visual elements. MINIMAL TEXT - only essential labels if needed (less than 10% text). Focus on geometric shapes, flowcharts, and visual connections. Generate the appropriate number of frames for the topic - simple topics may need fewer frames, complex topics may need up to 5 frames.`.trim()
		);
		const plan = JSON.parse(response) as StructuredVideoPlan;
		return validatePlan(plan);
	} catch (error) {
		// Retry once with explicit reminder
		const retryPrompt = `${PROMPT_TEMPLATE}

Topic: ${topic}
${description ? `Description: ${description}` : ''}

CRITICAL: Generate 1-5 figure-focused whiteboard diagram frames based on topic complexity. Each prompt_for_image must emphasize diagrams, shapes, figures, and visual elements. MINIMAL TEXT - only essential labels if needed (less than 10% text). Focus on geometric shapes, flowcharts, and visual connections. Generate the appropriate number of frames for the topic - simple topics may need fewer frames, complex topics may need up to 5 frames.

IMPORTANT: Respond with ONLY valid JSON. No commentary.`.trim();

		const response = await callGeminiText(retryPrompt);

		const plan = JSON.parse(response) as StructuredVideoPlan;
		return validatePlan(plan);
	}
};


