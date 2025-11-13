import {Router, Request, Response} from 'express';
import path from 'path';
import {v4 as uuidv4} from 'uuid';
import {generateStructuredJSON} from '../services/gemini-structured';
import {callGeminiImage} from '../services/gemini';
import {generateMotionScene} from '../services/veoService';
import {renderStoryboardVideo} from '../services/remotion-ai-renderer';

const router = Router();

router.post('/generate-video', async (req: Request, res: Response) => {
	const {topic, description = ''} = req.body ?? {};

	if (!topic || typeof topic !== 'string') {
		return res.status(400).json({
			error: 'topic is required',
		});
	}

	try {
		const plan = await generateStructuredJSON(topic, description ?? '');
		const framesWithAssets = await Promise.all(
			plan.frames.map(async (frame) => {
				if (frame.type === 'whiteboard_diagram' && frame.prompt_for_image) {
					const asset = await callGeminiImage(frame.prompt_for_image);
					return {...frame, asset};
				}

				if (frame.type === 'motion_scene' && frame.prompt_for_video) {
					const asset = await generateMotionScene(frame.prompt_for_video);
					return {...frame, asset};
				}

				return frame;
			})
		);

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
		console.error('Failed to generate AI video plan:', error);
		return res.status(500).json({
			error: error instanceof Error ? error.message : 'Failed to generate AI video plan',
		});
	}
});

export default router;


