import {Worker, Job} from 'bullmq';
import {config} from '../server/config';
import {VideoJobData} from '../server/queue';
import {renderTemplateToMp4} from '../render/index';
import {getStorageService} from '../server/services/storage';
import {existsSync, unlinkSync, mkdirSync} from 'fs';
import {join, dirname} from 'path';
import axios from 'axios';

// Create Redis connection for worker
import IORedis from 'ioredis';
const connection = new IORedis({
	host: config.redis.host,
	port: config.redis.port,
	password: config.redis.password,
	maxRetriesPerRequest: null,
});

// Initialize storage service
const storage = getStorageService();

/**
 * Video generation worker
 */
const worker = new Worker<VideoJobData>(
	'video-generation',
	async (job: Job<VideoJobData>) => {
		const {jobId, templatePath, inputPath, options} = job.data;

		console.log(`[Worker] Processing job ${jobId}`);

		try {
			// Update progress: Starting
			await job.updateProgress(10);

			// Ensure output directory exists
			const outputDir = config.paths.outputDir;
			if (!existsSync(outputDir)) {
				mkdirSync(outputDir, {recursive: true});
			}

			// Generate output filename
			const outputFilename = `${jobId}.mp4`;
			const outputPath = join(outputDir, outputFilename);

			// Update progress: Rendering
			await job.updateProgress(30);

			console.log(`[Worker] Rendering video for job ${jobId}`);
			console.log(`  Template: ${templatePath}`);
			console.log(`  Input: ${inputPath}`);
			console.log(`  Output: ${outputPath}`);

			// Render video using Remotion
			await renderTemplateToMp4({
				templatePath,
				inputPath,
				outPath: outputPath,
				fps: options?.fps || 30,
				width: options?.width || 1920,
				height: options?.height || 1080,
				duration: options?.duration,
				lowResolution: options?.lowResolution || false,
			});

			// Update progress: Uploading
			await job.updateProgress(80);

			console.log(`[Worker] Video rendered, uploading to storage...`);

			// Upload to cloud storage
			const remotePath = `videos/${jobId}/${outputFilename}`;
			const publicUrl = await storage.uploadFile(outputPath, remotePath);

			// Update progress: Complete
			await job.updateProgress(100);

			console.log(`[Worker] Job ${jobId} completed successfully`);
			console.log(`  Public URL: ${publicUrl}`);

			// Clean up local files
			if (existsSync(outputPath)) {
				unlinkSync(outputPath);
			}

			// Clean up temp files
			const jobDir = dirname(templatePath);
			if (existsSync(jobDir) && jobDir.includes('temp')) {
				// Optionally clean up temp directory
				// unlinkSync(templatePath);
				// unlinkSync(inputPath);
			}

			// Send webhook notification if provided
			if (job.data.webhookUrl) {
				try {
					await axios.post(job.data.webhookUrl, {
						jobId,
						status: 'completed',
						videoUrl: publicUrl,
						completedAt: new Date().toISOString(),
					});
					console.log(`[Worker] Webhook notification sent for job ${jobId}`);
				} catch (webhookError: any) {
					console.error(`[Worker] Failed to send webhook for job ${jobId}:`, webhookError.message);
					// Don't fail the job if webhook fails
				}
			}

			return {
				jobId,
				status: 'completed',
				videoUrl: publicUrl,
				remotePath,
				completedAt: new Date().toISOString(),
			};
		} catch (error: any) {
			console.error(`[Worker] Error processing job ${jobId}:`, error);

			// Send failure webhook if provided
			if (job.data.webhookUrl) {
				try {
					await axios.post(job.data.webhookUrl, {
						jobId,
						status: 'failed',
						error: error.message,
						failedAt: new Date().toISOString(),
					});
				} catch (webhookError) {
					// Ignore webhook errors
				}
			}

			throw error;
		}
	},
	{
		connection,
		concurrency: 1, // Process one video at a time (can be increased)
		limiter: {
			max: 5, // Max 5 jobs per minute
			duration: 60000,
		},
	}
);

// Worker event handlers
worker.on('completed', (job) => {
	console.log(`[Worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
	console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
	console.error('[Worker] Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
	console.log('[Worker] SIGTERM received, closing worker...');
	await worker.close();
	await connection.quit();
	process.exit(0);
});

process.on('SIGINT', async () => {
	console.log('[Worker] SIGINT received, closing worker...');
	await worker.close();
	await connection.quit();
	process.exit(0);
});

console.log('[Worker] Video generation worker started');
console.log(`  Redis: ${config.redis.host}:${config.redis.port}`);
console.log(`  Storage: ${config.storage.provider}`);
console.log(`  Concurrency: 1`);

