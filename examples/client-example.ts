/**
 * Example client code for interacting with the Video Generation API
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const WS_URL = process.env.WS_URL || 'ws://localhost:3001';

/**
 * Generate a video
 */
export async function generateVideo(template: any, input: any, options?: any) {
	try {
		const response = await axios.post(`${API_BASE_URL}/api/video/generate`, {
			template,
			input,
			options,
			webhookUrl: 'https://your-app.com/webhooks/video-complete', // Optional
		});

		return response.data;
	} catch (error: any) {
		console.error('Error generating video:', error.response?.data || error.message);
		throw error;
	}
}

/**
 * Check video generation status
 */
export async function getVideoStatus(jobId: string) {
	try {
		const response = await axios.get(`${API_BASE_URL}/api/video/status/${jobId}`);
		return response.data;
	} catch (error: any) {
		console.error('Error getting video status:', error.response?.data || error.message);
		throw error;
	}
}

/**
 * Cancel a video generation job
 */
export async function cancelVideo(jobId: string) {
	try {
		const response = await axios.delete(`${API_BASE_URL}/api/video/cancel/${jobId}`);
		return response.data;
	} catch (error: any) {
		console.error('Error cancelling video:', error.response?.data || error.message);
		throw error;
	}
}

/**
 * WebSocket client for real-time updates
 */
export class VideoWebSocketClient {
	private ws: WebSocket | null = null;
	private jobId: string;

	constructor(jobId: string) {
		this.jobId = jobId;
	}

	connect(onMessage: (data: any) => void, onError?: (error: Error) => void) {
		this.ws = new WebSocket(WS_URL);

		this.ws.onopen = () => {
			console.log('WebSocket connected');
			// Subscribe to job updates
			this.send({type: 'subscribe', jobId: this.jobId});
		};

		this.ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				onMessage(data);
			} catch (error) {
				console.error('Error parsing WebSocket message:', error);
			}
		};

		this.ws.onerror = (error) => {
			console.error('WebSocket error:', error);
			if (onError) {
				onError(new Error('WebSocket connection error'));
			}
		};

		this.ws.onclose = () => {
			console.log('WebSocket disconnected');
		};
	}

	send(data: any) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(data));
		}
	}

	disconnect() {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
	}
}

/**
 * Example usage
 */
async function example() {
	// Load template and input
	const template = {
		timeline: {duration: 300, fps: 30},
		tracks: [
			{
				type: 'background',
				src: '{{backgroundImage}}',
				startFrame: 0,
				endFrame: 300,
			},
			{
				type: 'text',
				content: '{{title}}',
				style: {fontSize: 72, color: '#ffffff'},
				startFrame: 30,
				endFrame: 150,
			},
		],
	};

	const input = {
		title: 'Hello World',
		backgroundImage: 'https://example.com/bg.jpg',
	};

	// Generate video
	const result = await generateVideo(template, input, {
		width: 1920,
		height: 1080,
		fps: 30,
	});

	console.log('Job created:', result.jobId);

	// Connect to WebSocket for real-time updates
	const wsClient = new VideoWebSocketClient(result.jobId);
	wsClient.connect((data) => {
		console.log('Update:', data);
		if (data.type === 'job-completed') {
			console.log('Video URL:', data.result.videoUrl);
			wsClient.disconnect();
		}
	});

	// Or poll for status
	const statusInterval = setInterval(async () => {
		const status = await getVideoStatus(result.jobId);
		console.log('Status:', status.status, `Progress: ${status.progress}%`);

		if (status.status === 'completed') {
			console.log('Video URL:', status.result.videoUrl);
			clearInterval(statusInterval);
		} else if (status.status === 'failed') {
			console.error('Video generation failed:', status.error);
			clearInterval(statusInterval);
		}
	}, 2000); // Poll every 2 seconds
}

// Uncomment to run example
// example().catch(console.error);

