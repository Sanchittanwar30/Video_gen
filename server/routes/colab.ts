/**
 * Colab API Routes
 * 
 * Endpoints for managing video rendering jobs on Google Colab
 */

import { Router, Request, Response } from 'express';
import {
	createColabJob,
	getColabJob,
	updateColabJobStatus,
	getPendingJobs,
	getJobPlanPath,
	getJobOutputPath,
} from '../services/colab-job-manager';
import { renderStoryboardVideo } from '../services/remotion-ai-renderer';
import { promises as fs } from 'fs';
import path from 'path';
import { AIVideoData } from '../../remotion/src/VideoFromAI';

const router = Router();

/**
 * POST /api/colab/generate
 * Create a new video generation job for Colab processing
 */
router.post('/generate', async (req: Request, res: Response) => {
	try {
		const { videoPlan, callbackUrl } = req.body;

		if (!videoPlan) {
			return res.status(400).json({
				error: 'videoPlan is required',
			});
		}

		// Validate video plan structure
		if (!videoPlan.frames || !Array.isArray(videoPlan.frames)) {
			return res.status(400).json({
				error: 'videoPlan must have a frames array',
			});
		}

		// Create Colab job
		const job = await createColabJob(videoPlan as AIVideoData, callbackUrl);

		// Return job info with endpoints
		const baseUrl = `${req.protocol}://${req.get('host')}`;
		
		return res.status(202).json({
			jobId: job.jobId,
			status: job.status,
			createdAt: job.createdAt.toISOString(),
			endpoints: {
				status: `${baseUrl}/api/colab/status/${job.jobId}`,
				download: `${baseUrl}/api/colab/download/${job.jobId}`,
				plan: `${baseUrl}/api/colab/plan/${job.jobId}`,
			},
			message: 'Job created. Use Colab notebook to process, or poll status endpoint.',
		});
	} catch (error: any) {
		console.error('Error creating Colab job:', error);
		res.status(500).json({
			error: error.message || 'Failed to create Colab job',
		});
	}
});

/**
 * GET /api/colab/status/:jobId
 * Get the status of a Colab job
 */
router.get('/status/:jobId', async (req: Request, res: Response) => {
	try {
		const { jobId } = req.params;
		const job = await getColabJob(jobId);

		if (!job) {
			return res.status(404).json({
				error: 'Job not found',
			});
		}

		const baseUrl = `${req.protocol}://${req.get('host')}`;
		
		return res.json({
			jobId: job.jobId,
			status: job.status,
			createdAt: job.createdAt.toISOString(),
			startedAt: job.startedAt?.toISOString(),
			completedAt: job.completedAt?.toISOString(),
			error: job.error,
			downloadUrl: job.status === 'completed' 
				? `${baseUrl}/api/colab/download/${job.jobId}`
				: undefined,
		});
	} catch (error: any) {
		console.error('Error getting Colab job status:', error);
		res.status(500).json({
			error: error.message || 'Failed to get job status',
		});
	}
});

/**
 * GET /api/colab/plan/:jobId
 * Get the video plan JSON for a job (for Colab to download)
 */
router.get('/plan/:jobId', async (req: Request, res: Response) => {
	try {
		const { jobId } = req.params;
		const planPath = getJobPlanPath(jobId);

		try {
			await fs.access(planPath);
			const plan = JSON.parse(await fs.readFile(planPath, 'utf-8'));
			
			return res.json(plan);
		} catch {
			return res.status(404).json({
				error: 'Job plan not found',
			});
		}
	} catch (error: any) {
		console.error('Error getting job plan:', error);
		res.status(500).json({
			error: error.message || 'Failed to get job plan',
		});
	}
});

/**
 * GET /api/colab/jobs/pending
 * Get all pending jobs (for Colab to poll)
 */
router.get('/jobs/pending', async (req: Request, res: Response) => {
	try {
		const jobs = await getPendingJobs();
		
		const baseUrl = `${req.protocol}://${req.get('host')}`;
		
		return res.json({
			jobs: jobs.map(job => ({
				jobId: job.jobId,
				createdAt: job.createdAt.toISOString(),
				planUrl: `${baseUrl}/api/colab/plan/${job.jobId}`,
				callbackUrl: job.callbackUrl,
			})),
		});
	} catch (error: any) {
		console.error('Error getting pending jobs:', error);
		res.status(500).json({
			error: error.message || 'Failed to get pending jobs',
		});
	}
});

/**
 * POST /api/colab/callback/:jobId
 * Callback endpoint for Colab to report job completion
 */
router.post('/callback/:jobId', async (req: Request, res: Response) => {
	try {
		const { jobId } = req.params;
		const { status, outputPath, error } = req.body;

		if (!status) {
			return res.status(400).json({
				error: 'status is required',
			});
		}

		const updates: any = {
			status,
		};

		if (status === 'processing' && !req.body.startedAt) {
			updates.startedAt = new Date();
		}

		if (status === 'completed') {
			updates.completedAt = new Date();
			if (outputPath) {
				updates.outputPath = outputPath;
			}
		}

		if (status === 'failed' && error) {
			updates.error = error;
			updates.completedAt = new Date();
		}

		const job = await updateColabJobStatus(jobId, updates);

		if (!job) {
			return res.status(404).json({
				error: 'Job not found',
			});
		}

		// If callback URL is provided, notify it
		if (job.callbackUrl && (status === 'completed' || status === 'failed')) {
			try {
				const axios = require('axios');
				await axios.post(job.callbackUrl, {
					jobId: job.jobId,
					status: job.status,
					outputPath: job.outputPath,
					error: job.error,
				});
			} catch (callbackError) {
				console.warn(`[Colab] Failed to call callback URL: ${callbackError}`);
			}
		}

		return res.json({
			success: true,
			job: {
				jobId: job.jobId,
				status: job.status,
			},
		});
	} catch (error: any) {
		console.error('Error updating Colab job:', error);
		res.status(500).json({
			error: error.message || 'Failed to update job',
		});
	}
});

/**
 * GET /api/colab/download/:jobId
 * Download the rendered video for a completed job
 */
router.get('/download/:jobId', async (req: Request, res: Response) => {
	try {
		const { jobId } = req.params;
		const job = await getColabJob(jobId);

		if (!job) {
			return res.status(404).json({
				error: 'Job not found',
			});
		}

		if (job.status !== 'completed') {
			return res.status(400).json({
				error: `Job is not completed. Current status: ${job.status}`,
			});
		}

		const outputPath = job.outputPath || getJobOutputPath(jobId);

		try {
			await fs.access(outputPath);
			return res.download(outputPath, `video-${jobId}.mp4`);
		} catch {
			return res.status(404).json({
				error: 'Output file not found',
			});
		}
	} catch (error: any) {
		console.error('Error downloading video:', error);
		res.status(500).json({
			error: error.message || 'Failed to download video',
		});
	}
});

/**
 * POST /api/colab/process/:jobId
 * Process a job locally (fallback if Colab is not available)
 * This endpoint can be used to process jobs on the server instead of Colab
 */
router.post('/process/:jobId', async (req: Request, res: Response) => {
	try {
		const { jobId } = req.params;
		const job = await getColabJob(jobId);

		if (!job) {
			return res.status(404).json({
				error: 'Job not found',
			});
		}

		if (job.status !== 'pending') {
			return res.status(400).json({
				error: `Job is not pending. Current status: ${job.status}`,
			});
		}

		// Update status to processing
		await updateColabJobStatus(jobId, {
			status: 'processing',
			startedAt: new Date(),
		});

		// Process in background
		(async () => {
			try {
				const outputPath = await renderStoryboardVideo(job.videoPlan);
				
				// Move output to job directory
				const jobOutputPath = getJobOutputPath(jobId);
				await fs.copyFile(outputPath, jobOutputPath);

				await updateColabJobStatus(jobId, {
					status: 'completed',
					completedAt: new Date(),
					outputPath: jobOutputPath,
				});
			} catch (error: any) {
				await updateColabJobStatus(jobId, {
					status: 'failed',
					error: error.message,
					completedAt: new Date(),
				});
			}
		})();

		return res.json({
			success: true,
			message: 'Job processing started',
			jobId,
		});
	} catch (error: any) {
		console.error('Error processing job:', error);
		res.status(500).json({
			error: error.message || 'Failed to process job',
		});
	}
});

export default router;

