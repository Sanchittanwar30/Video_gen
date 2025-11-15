/**
 * Example: Using Colab API Endpoints
 * 
 * This script demonstrates how to use the Colab API to offload
 * video rendering to Google Colab.
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Example video plan
const videoPlan = {
	frames: [
		{
			id: 'frame-1',
			type: 'whiteboard_diagram',
			duration: 18,
			text: 'Introduction to Machine Learning',
			animate: true,
			vectorized: {
				svgUrl: '/assets/vectorized/ml-intro.svg',
			},
			voiceoverUrl: '/assets/voiceovers/frame-1.mp3',
		},
		{
			id: 'frame-2',
			type: 'whiteboard_diagram',
			duration: 20,
			text: 'Neural Networks Explained',
			animate: true,
			vectorized: {
				svgUrl: '/assets/vectorized/neural-networks.svg',
			},
			voiceoverUrl: '/assets/voiceovers/frame-2.mp3',
		},
	],
};

/**
 * Create a Colab job and wait for completion
 */
async function createAndWaitForJob(videoPlan: any, callbackUrl?: string) {
	try {
		// Step 1: Create job
		console.log('Creating Colab job...');
		const createResponse = await axios.post(`${API_BASE_URL}/api/colab/generate`, {
			videoPlan,
			callbackUrl, // Optional: webhook URL for completion notification
		});

		const { jobId, endpoints } = createResponse.data;
		console.log(`Job created: ${jobId}`);
		console.log(`Status endpoint: ${endpoints.status}`);

		// Step 2: Poll for completion
		console.log('\nWaiting for Colab to process job...');
		const downloadUrl = await pollForCompletion(jobId);

		// Step 3: Download video
		console.log(`\nVideo ready! Downloading from: ${downloadUrl}`);
		const videoResponse = await axios.get(downloadUrl, {
			responseType: 'stream',
		});

		// Save video
		const fs = require('fs');
		const path = require('path');
		const outputPath = path.join(process.cwd(), 'output', `colab-${jobId}.mp4`);
		const writer = fs.createWriteStream(outputPath);

		videoResponse.data.pipe(writer);

		return new Promise((resolve, reject) => {
			writer.on('finish', () => {
				console.log(`Video saved to: ${outputPath}`);
				resolve(outputPath);
			});
			writer.on('error', reject);
		});
	} catch (error: any) {
		console.error('Error:', error.response?.data || error.message);
		throw error;
	}
}

/**
 * Poll job status until completion
 */
async function pollForCompletion(jobId: string, maxWaitMinutes = 30): Promise<string> {
	const startTime = Date.now();
	const maxWait = maxWaitMinutes * 60 * 1000; // Convert to milliseconds
	const pollInterval = 5000; // Poll every 5 seconds

	while (true) {
		const elapsed = Date.now() - startTime;
		if (elapsed > maxWait) {
			throw new Error(`Job ${jobId} timed out after ${maxWaitMinutes} minutes`);
		}

		const statusResponse = await axios.get(`${API_BASE_URL}/api/colab/status/${jobId}`);
		const { status, downloadUrl, error } = statusResponse.data;

		console.log(`[${new Date().toLocaleTimeString()}] Status: ${status}`);

		if (status === 'completed') {
			if (!downloadUrl) {
				throw new Error('Job completed but no download URL provided');
			}
			return downloadUrl;
		} else if (status === 'failed') {
			throw new Error(`Job failed: ${error || 'Unknown error'}`);
		} else if (status === 'pending' || status === 'processing') {
			// Continue polling
			await new Promise(resolve => setTimeout(resolve, pollInterval));
		} else {
			throw new Error(`Unknown job status: ${status}`);
		}
	}
}

/**
 * Process job locally (fallback if Colab is not available)
 */
async function processLocally(jobId: string) {
	console.log(`Processing job ${jobId} locally...`);
	
	const response = await axios.post(`${API_BASE_URL}/api/colab/process/${jobId}`);
	console.log('Local processing started:', response.data);
	
	// Poll for completion
	return await pollForCompletion(jobId);
}

// Main execution
async function main() {
	const args = process.argv.slice(2);
	const useLocal = args.includes('--local');

	if (useLocal) {
		// Create job and process locally
		const createResponse = await axios.post(`${API_BASE_URL}/api/colab/generate`, {
			videoPlan,
		});
		const { jobId } = createResponse.data;
		await processLocally(jobId);
	} else {
		// Create job and wait for Colab
		await createAndWaitForJob(videoPlan);
	}
}

// Run if executed directly
if (require.main === module) {
	main().catch(console.error);
}

export { createAndWaitForJob, pollForCompletion, processLocally };

