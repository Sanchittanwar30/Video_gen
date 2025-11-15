/**
 * Colab Job Manager
 * 
 * Manages video rendering jobs that are processed on Google Colab.
 * Jobs are stored locally and can be accessed by Colab notebooks.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { AIVideoData } from '../../remotion/src/VideoFromAI';

export interface ColabJob {
	jobId: string;
	status: 'pending' | 'processing' | 'completed' | 'failed';
	videoPlan: AIVideoData;
	createdAt: Date;
	startedAt?: Date;
	completedAt?: Date;
	outputPath?: string;
	error?: string;
	callbackUrl?: string;
}

const JOBS_DIR = path.join(process.cwd(), 'temp', 'colab-jobs');
const JOBS_METADATA_FILE = path.join(JOBS_DIR, 'jobs.json');

// Ensure jobs directory exists
const ensureJobsDir = async () => {
	await fs.mkdir(JOBS_DIR, { recursive: true });
};

// Load jobs metadata
const loadJobs = async (): Promise<Map<string, ColabJob>> => {
	await ensureJobsDir();
	try {
		const data = await fs.readFile(JOBS_METADATA_FILE, 'utf-8');
		const jobsArray = JSON.parse(data) as ColabJob[];
		return new Map(jobsArray.map(job => [job.jobId, {
			...job,
			createdAt: new Date(job.createdAt),
			startedAt: job.startedAt ? new Date(job.startedAt) : undefined,
			completedAt: job.completedAt ? new Date(job.completedAt) : undefined,
		}]));
	} catch {
		return new Map();
	}
};

// Save jobs metadata
const saveJobs = async (jobs: Map<string, ColabJob>) => {
	await ensureJobsDir();
	const jobsArray = Array.from(jobs.values());
	await fs.writeFile(JOBS_METADATA_FILE, JSON.stringify(jobsArray, null, 2), 'utf-8');
};

/**
 * Create a new Colab job
 */
export async function createColabJob(
	videoPlan: AIVideoData,
	callbackUrl?: string
): Promise<ColabJob> {
	await ensureJobsDir();
	
	const jobId = `colab-${Date.now()}-${Math.random().toString(36).substring(7)}`;
	const job: ColabJob = {
		jobId,
		status: 'pending',
		videoPlan,
		createdAt: new Date(),
		callbackUrl,
	};

	// Save job metadata
	const jobs = await loadJobs();
	jobs.set(jobId, job);
	await saveJobs(jobs);

	// Save video plan JSON file
	const planPath = path.join(JOBS_DIR, `${jobId}-plan.json`);
	await fs.writeFile(planPath, JSON.stringify(videoPlan, null, 2), 'utf-8');

	// Create a status file for Colab to update
	const statusPath = path.join(JOBS_DIR, `${jobId}-status.json`);
	await fs.writeFile(statusPath, JSON.stringify({ status: 'pending' }, null, 2), 'utf-8');

	console.log(`[Colab Job] Created job ${jobId}`);
	return job;
}

/**
 * Get job status
 */
export async function getColabJob(jobId: string): Promise<ColabJob | null> {
	const jobs = await loadJobs();
	return jobs.get(jobId) || null;
}

/**
 * Update job status (called by Colab or internal processes)
 */
export async function updateColabJobStatus(
	jobId: string,
	updates: Partial<Pick<ColabJob, 'status' | 'outputPath' | 'error' | 'startedAt' | 'completedAt'>>
): Promise<ColabJob | null> {
	const jobs = await loadJobs();
	const job = jobs.get(jobId);
	
	if (!job) {
		return null;
	}

	const updatedJob: ColabJob = {
		...job,
		...updates,
	};

	jobs.set(jobId, updatedJob);
	await saveJobs(jobs);

	// Update status file for Colab
	const statusPath = path.join(JOBS_DIR, `${jobId}-status.json`);
	await fs.writeFile(statusPath, JSON.stringify({
		status: updatedJob.status,
		outputPath: updatedJob.outputPath,
		error: updatedJob.error,
	}, null, 2), 'utf-8');

	console.log(`[Colab Job] Updated job ${jobId}: ${updatedJob.status}`);
	return updatedJob;
}

/**
 * Get pending jobs (for Colab to poll)
 */
export async function getPendingJobs(): Promise<ColabJob[]> {
	const jobs = await loadJobs();
	return Array.from(jobs.values()).filter(job => job.status === 'pending');
}

/**
 * Get job plan file path
 */
export function getJobPlanPath(jobId: string): string {
	return path.join(JOBS_DIR, `${jobId}-plan.json`);
}

/**
 * Get job output path
 */
export function getJobOutputPath(jobId: string): string {
	return path.join(JOBS_DIR, `${jobId}-output.mp4`);
}

/**
 * Clean up old jobs (older than 24 hours)
 */
export async function cleanupOldJobs(): Promise<number> {
	const jobs = await loadJobs();
	const now = Date.now();
	const maxAge = 24 * 60 * 60 * 1000; // 24 hours
	let cleaned = 0;

	for (const [jobId, job] of jobs.entries()) {
		const age = now - job.createdAt.getTime();
		if (age > maxAge) {
			// Delete job files
			try {
				const planPath = getJobPlanPath(jobId);
				const outputPath = getJobOutputPath(jobId);
				const statusPath = path.join(JOBS_DIR, `${jobId}-status.json`);
				
				await Promise.all([
					fs.unlink(planPath).catch(() => {}),
					fs.unlink(outputPath).catch(() => {}),
					fs.unlink(statusPath).catch(() => {}),
				]);
				
				jobs.delete(jobId);
				cleaned++;
			} catch (error) {
				console.warn(`[Colab Job] Failed to cleanup job ${jobId}:`, error);
			}
		}
	}

	if (cleaned > 0) {
		await saveJobs(jobs);
		console.log(`[Colab Job] Cleaned up ${cleaned} old jobs`);
	}

	return cleaned;
}

