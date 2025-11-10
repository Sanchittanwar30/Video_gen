import {Router, Request, Response} from 'express';
import {generateVideoFromRequest} from '../services/video-generation';

const router = Router();

/**
 * POST /api/video/generate
 * Create a new video generation job
 */
router.post('/generate', async (req: Request, res: Response) => {
	try {
		const {template, input, options, transcript, presentation, topic} = req.body;

		if (!topic && !presentation && (!template || !input)) {
			return res.status(400).json({
				error: 'Provide either topic, presentation payload, or template/input payload',
			});
		}

		const result = await generateVideoFromRequest({
			template,
			input,
			options,
			transcript,
			presentation,
			topic,
		});

		res.status(200).json({
			jobId: result.jobId,
			status: 'completed',
			videoUrl: result.videoUrl,
			transcriptUrl: result.transcriptUrl,
			remotePath: result.remotePath,
		});
	} catch (error: any) {
		console.error('Error creating video job:', error);
		res.status(500).json({
			error: 'Failed to create video generation job',
			message: error.message,
		});
	}
});

export default router;

