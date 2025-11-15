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

IMPORTANT: Generate EXACTLY 2 whiteboard diagram frames. Do NOT include text_slide or bullet_slide frames.
Only use: "whiteboard_diagram" frame type.

CRITICAL REQUIREMENTS:
- Generate EXACTLY 2 whiteboard diagram frames (no more, no less)
- Each frame must be VISUAL and FIGURE-FOCUSED with minimal text
- First frame: Introduction/overview using diagrams and figures
- Second frame: Detailed explanation using visual diagrams and shapes
- Focus on diagrams, shapes, figures, flowcharts, and visual elements
- MINIMAL TEXT - only essential labels if needed (less than 10% text)
- Prioritize geometric shapes, visual connections, and diagrammatic representations
- Make each sketch illustration-heavy and text-light

Given topic + description, output:
{
  "title": "string",
  "frames": [
    {
      "id": "frame_1",
      "type": "whiteboard_diagram",
      "prompt_for_image": "VISUAL description for first whiteboard diagram. Focus on: diagrams, shapes, figures, flowcharts, visual elements. MINIMAL TEXT - only essential labels if needed. Emphasize geometric shapes, visual connections, and diagrammatic representations. Keep text less than 10% of the image. This is the introduction/overview frame.",
      "heading": "optional string for context",
      "duration": 4
    },
    {
      "id": "frame_2",
      "type": "whiteboard_diagram",
      "prompt_for_image": "VISUAL description for second whiteboard diagram. Focus on: diagrams, shapes, figures, flowcharts, visual elements. MINIMAL TEXT - only essential labels if needed. Emphasize geometric shapes, visual connections, and diagrammatic representations. Keep text less than 10% of the image. This is the detailed explanation frame.",
      "heading": "optional string for context",
      "duration": 4
    }
  ]
}

EXAMPLE of good prompt_for_image:
"A visual whiteboard diagram showing [concept] using [geometric shapes/diagrams/flowcharts]. Include: [visual elements like circles, boxes, arrows connecting shapes]. MINIMAL TEXT - only essential labels if needed (less than 10% text). Focus on visual storytelling through diagrams and figures rather than text."

Focus on visual storytelling through DIAGRAMS, FIGURES, and SHAPES. Generate EXACTLY 2 figure-focused whiteboard diagram frames with minimal text that explain the topic visually.
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

	// Validate frame count for whiteboard diagrams (should be exactly 2)
	const whiteboardFrames = validatedFrames.filter(f => f.type === 'whiteboard_diagram');
	if (whiteboardFrames.length !== 2) {
		console.warn(`[Structured Plan] Generated ${whiteboardFrames.length} whiteboard diagram frames. Expected exactly 2.`);
		// If we have more than 2, take only the first 2
		if (whiteboardFrames.length > 2) {
			const otherFrames = validatedFrames.filter(f => f.type !== 'whiteboard_diagram');
			const firstTwoWhiteboard = whiteboardFrames.slice(0, 2);
			return {
				title: plan.title.trim(),
				frames: [...firstTwoWhiteboard, ...otherFrames],
			};
		}
	}

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

CRITICAL: Generate EXACTLY 2 figure-focused whiteboard diagram frames. Each prompt_for_image must emphasize diagrams, shapes, figures, and visual elements. MINIMAL TEXT - only essential labels if needed (less than 10% text). Focus on geometric shapes, flowcharts, and visual connections.`.trim()
		);
		const plan = JSON.parse(response) as StructuredVideoPlan;
		return validatePlan(plan);
	} catch (error) {
		// Retry once with explicit reminder
		const retryPrompt = `${PROMPT_TEMPLATE}

Topic: ${topic}
${description ? `Description: ${description}` : ''}

CRITICAL: Generate EXACTLY 2 figure-focused whiteboard diagram frames. Each prompt_for_image must emphasize diagrams, shapes, figures, and visual elements. MINIMAL TEXT - only essential labels if needed (less than 10% text). Focus on geometric shapes, flowcharts, and visual connections.

IMPORTANT: Respond with ONLY valid JSON. No commentary.`.trim();

		const response = await callGeminiText(retryPrompt);

		const plan = JSON.parse(response) as StructuredVideoPlan;
		return validatePlan(plan);
	}
};


