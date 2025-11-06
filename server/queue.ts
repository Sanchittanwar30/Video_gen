import {Queue, QueueEvents} from 'bullmq';
import {config} from './config';
import IORedis from 'ioredis';

// Create Redis connection
const connection = new IORedis({
	host: config.redis.host,
	port: config.redis.port,
	password: config.redis.password,
	maxRetriesPerRequest: null,
});

// Video generation job queue
export const videoQueue = new Queue('video-generation', {
	connection,
	defaultJobOptions: {
		attempts: 3,
		backoff: {
			type: 'exponential',
			delay: 2000,
		},
		removeOnComplete: {
			age: 24 * 3600, // Keep completed jobs for 24 hours
			count: 1000,
		},
		removeOnFail: {
			age: 7 * 24 * 3600, // Keep failed jobs for 7 days
		},
	},
});

// Queue events for tracking job progress
export const videoQueueEvents = new QueueEvents('video-generation', {
	connection,
});

// Job status types
export enum JobStatus {
	WAITING = 'waiting',
	ACTIVE = 'active',
	COMPLETED = 'completed',
	FAILED = 'failed',
	DELAYED = 'delayed',
	PAUSED = 'paused',
}

// Video generation job data interface
export interface VideoJobData {
	jobId: string;
	templatePath: string;
	inputPath: string;
	template: any;
	input: Record<string, any>;
	outputPath?: string;
	options?: {
		fps?: number;
		width?: number;
		height?: number;
		duration?: number;
		lowResolution?: boolean;
	};
	userId?: string;
	webhookUrl?: string;
}

// Helper function to add job to queue
export async function addVideoJob(data: VideoJobData) {
	const job = await videoQueue.add('render-video', data, {
		jobId: data.jobId,
	});
	return job;
}

// Helper function to get job status
export async function getJobStatus(jobId: string) {
	const job = await videoQueue.getJob(jobId);
	if (!job) {
		return null;
	}

	const state = await job.getState();
	const progress = job.progress as number;
	const returnvalue = job.returnvalue;
	const failedReason = job.failedReason;

	return {
		jobId,
		status: state,
		progress,
		result: returnvalue,
		error: failedReason,
		createdAt: job.timestamp,
		processedAt: job.processedOn,
		finishedAt: job.finishedOn,
	};
}

// Helper function to cancel job
export async function cancelJob(jobId: string) {
	const job = await videoQueue.getJob(jobId);
	if (job) {
		await job.remove();
		return true;
	}
	return false;
}

