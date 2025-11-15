import {Router, Request, Response} from 'express';
import {generateVideoFromRequest} from '../services/video-generation';

const router = Router();

/**
 * POST /api/video/generate
 * Create a new video generation job
 */
router.post('/generate', async (req: Request, res: Response) => {
	try {
		const { presentation, topic, template, input } = req.body;

		let requestPayload;

		if (presentation) {
			requestPayload = {
				type: 'presentation' as const,
				payload: presentation,
			};
		} else if (topic) {
			requestPayload = {
				type: 'topic' as const,
				payload: {
					topic,
					durationSeconds: req.body.durationSeconds,
					backgroundMusic: req.body.backgroundMusic,
					notes: req.body.notes,
					language: req.body.language,
				},
			};
		} else if (template && input) {
			requestPayload = {
				type: 'template' as const,
				payload: { template, input },
			};
		} else {
			return res.status(400).json({
				error: 'Provide either topic payload, presentation payload, or template/input payload',
			});
		}

		const result = await generateVideoFromRequest(requestPayload);

		if (!result.success) {
			return res.status(500).json({
				error: result.error ?? 'Video generation failed',
			});
		}

		return res.status(200).json({
			videoUrl: result.videoUrl,
			transcript: result.transcript,
			content: result.content,
		});
	} catch (error: any) {
		console.error('Error generating video:', error);
		res.status(500).json({
			error: error.message ?? 'Unexpected error generating video',
		});
	}
});

export default router;

