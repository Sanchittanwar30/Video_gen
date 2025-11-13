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

Given topic + description, output:
{
  "title": "string",
  "frames": [
    {
      "id": "frame_1",
      "type": "whiteboard_diagram" | "text_slide" | "bullet_slide" | "motion_scene",
      "prompt_for_image": "ONLY for whiteboard_diagram frames — a detailed whiteboard sketch description",
      "prompt_for_video": "ONLY for motion_scene — a detailed Veo prompt",
      "heading": "string",
      "text": "string",
      "bullets": [],
      "duration": 4
    }
  ]
}

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

		return {
			id: frame.id ?? `frame_${index + 1}`,
			type,
			prompt_for_image: frame.prompt_for_image,
			prompt_for_video: frame.prompt_for_video,
			heading: frame.heading,
			text: frame.text,
			bullets: Array.isArray(frame.bullets) ? frame.bullets : [],
			duration: duration > 0 ? duration : 4,
		};
	});

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
Description: ${description}`.trim()
		);
		const plan = JSON.parse(response) as StructuredVideoPlan;
		return validatePlan(plan);
	} catch (error) {
		// Retry once with explicit reminder
		const retryPrompt = `${PROMPT_TEMPLATE}

Topic: ${topic}
Description: ${description}

IMPORTANT: Respond with ONLY valid JSON. No commentary.`.trim();

		const response = await callGeminiText(retryPrompt);

		const plan = JSON.parse(response) as StructuredVideoPlan;
		return validatePlan(plan);
	}
};


