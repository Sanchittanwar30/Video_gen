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
      "heading": "optional string for context",
      "duration": 4
    },
    {
      "id": "frame_2",
      "type": "whiteboard_diagram",
      "prompt_for_image": "A clear educational whiteboard diagram explaining [specific aspect of topic] in detail. Use geometric shapes, flowcharts, and visual connections to show relationships and processes. Include essential labels (less than 10% text). Make it informative and directly related to the topic.",
      "heading": "optional string for context",
      "duration": 4
    }
    // Maximum 5 frames total - generate 1-5 frames based on topic complexity
  ]
}

EXAMPLE of good prompt_for_image:
"A clear educational whiteboard diagram explaining [specific concept from topic] using geometric shapes, flowcharts, and visual connections. Show [specific relationships, processes, or structures relevant to the topic]. Include essential labels (less than 10% text) that help explain the concept. Make it informative and directly related to the topic - avoid abstract or decorative elements."

IMPORTANT: Each prompt_for_image must be specific to the topic and create a meaningful educational diagram. Avoid generic descriptions. Focus on creating diagrams that clearly explain the concept being taught.

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

		// Ensure whiteboard diagrams have detailed prompts
		let prompt_for_image = frame.prompt_for_image;
		if (type === 'whiteboard_diagram' && prompt_for_image) {
			// Enhance prompt if it's too short or lacks detail
			const promptLength = prompt_for_image.length;
			if (promptLength < 100) {
				console.warn(`[Structured Plan] Frame ${frame.id} has short prompt (${promptLength} chars), may need enhancement`);
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


