/**
 * Google Colab Service
 * 
 * This service handles communication with Google Colab for heavy video rendering tasks.
 * It can be used as an alternative to local rendering when you want to offload
 * computationally intensive operations to Colab's free GPU/CPU resources.
 */

import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { AIVideoData } from '../../remotion/src/VideoFromAI';

export interface ColabConfig {
	/** Colab notebook URL (if using Colab API) */
	notebookUrl?: string;
	/** Colab API token (if using Colab API) */
	apiToken?: string;
	/** Whether to use Colab for rendering */
	enabled: boolean;
	/** Upload endpoint for video plans */
	uploadEndpoint?: string;
	/** Download endpoint for rendered videos */
	downloadEndpoint?: string;
}

export interface ColabRenderJob {
	jobId: string;
	status: 'pending' | 'processing' | 'completed' | 'failed';
	videoPlan: AIVideoData;
	outputUrl?: string;
	error?: string;
	createdAt: Date;
	completedAt?: Date;
}

/**
 * Upload video plan to Colab and start rendering
 */
export async function renderVideoOnColab(
	plan: AIVideoData,
	config: ColabConfig
): Promise<ColabRenderJob> {
	if (!config.enabled) {
		throw new Error('Colab rendering is not enabled');
	}

	// Create a temporary JSON file with the video plan
	const tempDir = path.join(process.cwd(), 'temp', 'colab-jobs');
	await fs.mkdir(tempDir, { recursive: true });
	
	const jobId = `colab-${Date.now()}`;
	const planPath = path.join(tempDir, `${jobId}-plan.json`);
	await fs.writeFile(planPath, JSON.stringify(plan, null, 2), 'utf-8');

	// If using Colab API (requires Colab Pro or custom setup)
	if (config.apiToken && config.uploadEndpoint) {
		try {
			const response = await axios.post(
				config.uploadEndpoint,
				{
					jobId,
					plan: plan,
				},
				{
					headers: {
						'Authorization': `Bearer ${config.apiToken}`,
						'Content-Type': 'application/json',
					},
				}
			);

			return {
				jobId,
				status: 'pending',
				videoPlan: plan,
				createdAt: new Date(),
			};
		} catch (error: any) {
			throw new Error(`Failed to upload to Colab: ${error.message}`);
		}
	}

	// Manual mode: return instructions for manual upload
	return {
		jobId,
		status: 'pending',
		videoPlan: plan,
		createdAt: new Date(),
	};
}

/**
 * Check status of a Colab render job
 */
export async function checkColabJobStatus(
	jobId: string,
	config: ColabConfig
): Promise<ColabRenderJob> {
	if (!config.enabled) {
		throw new Error('Colab rendering is not enabled');
	}

	// If using Colab API
	if (config.apiToken && config.downloadEndpoint) {
		try {
			const response = await axios.get(
				`${config.downloadEndpoint}/status/${jobId}`,
				{
					headers: {
						'Authorization': `Bearer ${config.apiToken}`,
					},
				}
			);

			return response.data;
		} catch (error: any) {
			throw new Error(`Failed to check Colab job status: ${error.message}`);
		}
	}

	// Manual mode: check local temp directory
	const tempDir = path.join(process.cwd(), 'temp', 'colab-jobs');
	const outputPath = path.join(tempDir, `${jobId}-output.mp4`);
	
	try {
		await fs.access(outputPath);
		return {
			jobId,
			status: 'completed',
			videoPlan: {} as AIVideoData,
			outputUrl: outputPath,
			createdAt: new Date(),
			completedAt: new Date(),
		};
	} catch {
		return {
			jobId,
			status: 'processing',
			videoPlan: {} as AIVideoData,
			createdAt: new Date(),
		};
	}
}

/**
 * Download rendered video from Colab
 */
export async function downloadColabVideo(
	jobId: string,
	outputPath: string,
	config: ColabConfig
): Promise<string> {
	if (!config.enabled) {
		throw new Error('Colab rendering is not enabled');
	}

	// If using Colab API
	if (config.apiToken && config.downloadEndpoint) {
		try {
			const response = await axios.get(
				`${config.downloadEndpoint}/download/${jobId}`,
				{
					headers: {
						'Authorization': `Bearer ${config.apiToken}`,
					},
					responseType: 'arraybuffer',
				}
			);

			await fs.writeFile(outputPath, response.data);
			return outputPath;
		} catch (error: any) {
			throw new Error(`Failed to download from Colab: ${error.message}`);
		}
	}

	// Manual mode: copy from temp directory
	const tempDir = path.join(process.cwd(), 'temp', 'colab-jobs');
	const sourcePath = path.join(tempDir, `${jobId}-output.mp4`);
	
	try {
		await fs.access(sourcePath);
		await fs.copyFile(sourcePath, outputPath);
		return outputPath;
	} catch (error: any) {
		throw new Error(`Output file not found: ${sourcePath}`);
	}
}

/**
 * Get instructions for manual Colab setup
 */
export function getColabInstructions(jobId: string, planPath: string): string {
	return `
# Google Colab Rendering Instructions

## Job ID: ${jobId}

## Steps:

1. **Open Google Colab**: https://colab.research.google.com/

2. **Upload the Colab notebook**:
   - File: colab/Video_Rendering_Colab.ipynb
   - Or create a new notebook and copy the cells

3. **Upload your video plan**:
   - File: ${planPath}
   - Upload it in the notebook's file upload section

4. **Run the notebook cells**:
   - Install dependencies (Node.js, FFmpeg, Chromium)
   - Install project dependencies (npm install)
   - Upload assets if needed
   - Run the render script

5. **Download the output video**:
   - The notebook will download the rendered MP4 file
   - Save it locally and update your job status

## Alternative: Use Colab API (requires setup)

If you set up a Colab API endpoint, you can automate this process.
See colab/colab-service.ts for API integration.
	`.trim();
}

