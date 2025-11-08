import {Router, Request, Response} from 'express';
import {addVideoJob, getJobStatus, cancelJob} from '../queue';
import {v4 as uuidv4} from 'uuid';
import {writeFileSync, existsSync, mkdirSync} from 'fs';
import {join} from 'path';
import {config} from '../config';

const router = Router();

/**
 * POST /api/video/generate
 * Create a new video generation job
 */
router.post('/generate', async (req: Request, res: Response) => {
	try {
		const {template, input, options, webhookUrl, userId, transcript} = req.body;

		if (!template || !input) {
			return res.status(400).json({
				error: 'Template and input are required',
			});
		}

		// Generate unique job ID
		const jobId = uuidv4();

		// Create temp directory for this job
		const jobDir = join(config.paths.tempDir, jobId);
		if (!existsSync(jobDir)) {
			mkdirSync(jobDir, {recursive: true});
		}

		// Save template and input to temp files
		const templatePath = join(jobDir, 'template.json');
		const inputPath = join(jobDir, 'input.json');

		writeFileSync(templatePath, JSON.stringify(template, null, 2));
		writeFileSync(inputPath, JSON.stringify(input, null, 2));

		// Add job to queue
		const job = await addVideoJob({
			jobId,
			templatePath,
			inputPath,
			template,
			input,
			options: options || {},
			transcript,
			userId,
			webhookUrl,
		});

		res.status(202).json({
			jobId: job.id,
			status: 'queued',
			message: 'Video generation job created',
			estimatedTime: '2-5 minutes', // Rough estimate
		});
	} catch (error: any) {
		console.error('Error creating video job:', error);
		res.status(500).json({
			error: 'Failed to create video generation job',
			message: error.message,
		});
	}
});

/**
 * GET /api/video/status/:jobId
 * Get status of a video generation job
 */
router.get('/status/:jobId', async (req: Request, res: Response) => {
	try {
		const {jobId} = req.params;
		const status = await getJobStatus(jobId);

		if (!status) {
			return res.status(404).json({
				error: 'Job not found',
			});
		}

		res.json(status);
	} catch (error: any) {
		console.error('Error getting job status:', error);
		res.status(500).json({
			error: 'Failed to get job status',
			message: error.message,
		});
	}
});

/**
 * DELETE /api/video/cancel/:jobId
 * Cancel a video generation job
 */
router.delete('/cancel/:jobId', async (req: Request, res: Response) => {
	try {
		const {jobId} = req.params;
		const cancelled = await cancelJob(jobId);

		if (!cancelled) {
			return res.status(404).json({
				error: 'Job not found or already completed',
			});
		}

		res.json({
			message: 'Job cancelled successfully',
			jobId,
		});
	} catch (error: any) {
		console.error('Error cancelling job:', error);
		res.status(500).json({
			error: 'Failed to cancel job',
			message: error.message,
		});
	}
});

/**
 * GET /api/video/list
 * List recent video generation jobs (optional - for admin)
 */
router.get('/list', async (req: Request, res: Response) => {
	try {
		// This would require storing job metadata in a database
		// For now, return a simple message
		res.json({
			message: 'Job listing requires database storage',
			hint: 'Implement job history storage for production use',
		});
	} catch (error: any) {
		console.error('Error listing jobs:', error);
		res.status(500).json({
			error: 'Failed to list jobs',
			message: error.message,
		});
	}
});

export default router;

