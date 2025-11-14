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
- Each frame must be DETAILED and EDUCATIONAL with rich context
- First frame: Introduction/overview of the topic
- Second frame: Detailed explanation or deeper dive
- Include labels, arrows, annotations, and visual elements
- Make each sketch comprehensive and informative

Given topic + description, output:
{
  "title": "string",
  "frames": [
    {
      "id": "frame_1",
      "type": "whiteboard_diagram",
      "prompt_for_image": "DETAILED description for first whiteboard diagram. Must include: specific elements to draw, labels, arrows, annotations, relationships, visual hierarchy. Be comprehensive and educational. This is the introduction/overview frame.",
      "heading": "optional string for context",
      "duration": 4
    },
    {
      "id": "frame_2",
      "type": "whiteboard_diagram",
      "prompt_for_image": "DETAILED description for second whiteboard diagram. Must include: specific elements to draw, labels, arrows, annotations, relationships, visual hierarchy. Be comprehensive and educational. This is the detailed explanation frame.",
      "heading": "optional string for context",
      "duration": 4
    }
  ]
}

EXAMPLE of good prompt_for_image:
"A detailed whiteboard diagram showing [concept]. Include: [specific elements], labeled with [labels], connected by arrows showing [relationships]. Add annotations explaining [details]. Use visual hierarchy with [elements] in the center and [supporting elements] around it."

Focus on visual storytelling through DETAILED, HIGH-QUALITY sketches. Generate EXACTLY 2 comprehensive whiteboard diagram frames that explain the topic.
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

CRITICAL: Generate EXACTLY 2 detailed whiteboard diagram frames. Each prompt_for_image must be comprehensive (at least 150+ characters) with specific visual elements, labels, arrows, and annotations.`.trim()
		);
		const plan = JSON.parse(response) as StructuredVideoPlan;
		return validatePlan(plan);
	} catch (error) {
		// Retry once with explicit reminder
		const retryPrompt = `${PROMPT_TEMPLATE}

Topic: ${topic}
${description ? `Description: ${description}` : ''}

CRITICAL: Generate EXACTLY 2 detailed whiteboard diagram frames. Each prompt_for_image must be comprehensive (at least 150+ characters) with specific visual elements, labels, arrows, and annotations.

IMPORTANT: Respond with ONLY valid JSON. No commentary.`.trim();

		const response = await callGeminiText(retryPrompt);

		const plan = JSON.parse(response) as StructuredVideoPlan;
		return validatePlan(plan);
	}
};


