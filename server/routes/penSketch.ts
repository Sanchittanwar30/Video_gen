/**
 * Pen Sketch Animation Routes
 * 
 * Routes for sending images to Colab FastAPI server for pen-sketch animation
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { synthesizeSpeech } from '../services/deepgram';
import { spawn } from 'child_process';

const router = Router();

// Verification endpoint to check which Colab pipeline is active
router.get('/verify-colab', async (req: Request, res: Response) => {
	try {
		if (!COLAB_FASTAPI_URL) {
			return res.status(400).json({
				error: 'COLAB_FASTAPI_URL not configured',
				colab_url: null,
				pipeline: 'unknown'
			});
		}

		// Check Colab server info
		try {
			const infoResponse = await axios.get(`${COLAB_FASTAPI_URL}/api/info`, {
				timeout: 5000
			});
			
			return res.json({
				status: 'connected',
				colab_url: COLAB_FASTAPI_URL,
				pipeline_info: infoResponse.data,
				message: `Connected to ${infoResponse.data.pipeline} pipeline (${infoResponse.data.version})`
			});
		} catch (error: any) {
			// Try health endpoint as fallback
			try {
				const healthResponse = await axios.get(`${COLAB_FASTAPI_URL}/health`, {
					timeout: 5000
				});
				
				return res.json({
					status: 'connected',
					colab_url: COLAB_FASTAPI_URL,
					pipeline_info: healthResponse.data,
					message: `Connected to Colab server (pipeline info not available)`,
					warning: 'Server is running but /api/info endpoint not available'
				});
			} catch (healthError: any) {
				return res.status(503).json({
					status: 'disconnected',
					colab_url: COLAB_FASTAPI_URL,
					error: 'Cannot connect to Colab server',
					details: error.message || 'Unknown error',
					suggestion: 'Make sure Colab server is running and ngrok URL is correct'
				});
			}
		}
	} catch (error: any) {
		return res.status(500).json({
			error: 'Verification failed',
			message: error.message
		});
	}
});

// Colab FastAPI server URL (set via environment variable) - optional, defaults to local
const COLAB_FASTAPI_URL = process.env.COLAB_FASTAPI_URL || '';
// Use local execution by default (set USE_LOCAL_PEN_SKETCH=false to use Colab)
const USE_LOCAL_PEN_SKETCH = process.env.USE_LOCAL_PEN_SKETCH !== 'false';

// Configure multer for file uploads
const upload = multer({
	dest: path.join(process.cwd(), 'temp', 'pen-sketch-uploads'),
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB per file
	},
	fileFilter: (req, file, cb) => {
		// Accept only image files
		if (file.mimetype.startsWith('image/')) {
			cb(null, true);
		} else {
			cb(new Error('Only image files are allowed'));
		}
	},
});

interface PenSketchJob {
	jobId: string;
	status: 'pending' | 'processing' | 'completed' | 'failed';
	imageUrls: string[];
	voiceoverUrl?: string;
	voiceoverScript?: string;
	createdAt: Date;
	completedAt?: Date;
	videoUrl?: string;
	error?: string;
}

// In-memory job storage (use database in production)
const jobs = new Map<string, PenSketchJob>();

/**
 * GET /api/pen-sketch/test/images
 * Get list of available images for testing
 */
router.get('/test/images', async (req: Request, res: Response) => {
	try {
		const assetsDir = process.env.ASSETS_DIR
			? path.resolve(process.cwd(), process.env.ASSETS_DIR)
			: path.join(process.cwd(), 'public', 'assets', 'gemini-images');
		
		try {
			const files = await fs.readdir(assetsDir);
			const imageFiles = files.filter(f => 
				/\.(png|jpg|jpeg|gif|webp)$/i.test(f)
			).map(f => ({
				filename: f,
				url: `/assets/gemini-images/${f}`,
			}));
			
			return res.json({
				images: imageFiles,
				count: imageFiles.length,
			});
		} catch (error: any) {
			return res.status(404).json({
				error: 'Images directory not found',
				path: assetsDir,
			});
		}
	} catch (error: any) {
		console.error('Error listing images:', error);
		res.status(500).json({
			error: error.message || 'Failed to list images',
		});
	}
});

/**
 * POST /api/pen-sketch/upload
 * Upload images directly from frontend
 */
router.post('/upload', upload.array('images', 10), async (req: Request, res: Response) => {
	try {
		const files = req.files as Express.Multer.File[];
		
		if (!files || files.length === 0) {
			return res.status(400).json({
				error: 'At least one image file is required',
			});
		}

		// Save uploaded files and return URLs
		const assetsDir = path.join(process.cwd(), 'public', 'assets', 'pen-sketch-uploads');
		await fs.mkdir(assetsDir, { recursive: true });

		const imageUrls: string[] = [];
		for (const file of files) {
			const ext = path.extname(file.originalname) || '.png';
			const filename = `pen-sketch-${Date.now()}-${uuidv4().substring(0, 6)}${ext}`;
			const destPath = path.join(assetsDir, filename);
			
			await fs.rename(file.path, destPath);
			imageUrls.push(`/assets/pen-sketch-uploads/${filename}`);
		}

		return res.json({
			success: true,
			imageUrls,
			count: imageUrls.length,
		});
	} catch (error: any) {
		console.error('Error uploading images:', error);
		res.status(500).json({
			error: error.message || 'Failed to upload images',
		});
	}
});

/**
 * POST /api/pen-sketch/animate
 * Send images to Colab FastAPI for pen-sketch animation
 * Supports both imageUrls (from existing images) and direct file uploads
 */
router.post('/animate', upload.array('imageFiles', 10), async (req: Request, res: Response) => {
	let jobId: string | undefined;
	let job: PenSketchJob | undefined;
	
	try {
		const { 
			imageUrls: imageUrlsJson,
			// Simplified animation parameters - only duration and fps control the speed
			fps = 25,  // Frames per second
			duration = 5.0,  // Duration in seconds (controls animation speed)
			width = 1920,  // Video width
			height = 1080,  // Video height
			voiceoverScript,
			generateVoiceover = true,
		} = req.body;

		// Parse imageUrls if it's a JSON string
		let imageUrls: string[] = [];
		if (imageUrlsJson) {
			imageUrls = typeof imageUrlsJson === 'string' 
				? JSON.parse(imageUrlsJson) 
				: imageUrlsJson;
		}

		// Handle direct file uploads
		const files = req.files as Express.Multer.File[];
		if (files && files.length > 0) {
			// Save uploaded files
			const assetsDir = path.join(process.cwd(), 'public', 'assets', 'pen-sketch-uploads');
			await fs.mkdir(assetsDir, { recursive: true });

			for (const file of files) {
				const ext = path.extname(file.originalname) || '.png';
				const filename = `pen-sketch-${Date.now()}-${uuidv4().substring(0, 6)}${ext}`;
				const destPath = path.join(assetsDir, filename);
				
				await fs.rename(file.path, destPath);
				const baseUrl = `${req.protocol}://${req.get('host')}`;
				imageUrls.push(`${baseUrl}/assets/pen-sketch-uploads/${filename}`);
			}
			
			console.log(`[Pen Sketch] Uploaded ${files.length} file(s), total images: ${imageUrls.length}`);
		}

		if (!imageUrls || imageUrls.length === 0) {
			return res.status(400).json({
				error: 'Either imageUrls array or imageFiles upload is required with at least one image',
			});
		}

		// Use local execution by default (unless explicitly disabled)
		if (USE_LOCAL_PEN_SKETCH) {
			console.log(`[Pen Sketch] 🏠 Using LOCAL execution (no Colab needed)`);
		} else {
			// Colab mode - check if server is accessible
			if (!COLAB_FASTAPI_URL) {
				return res.status(500).json({
					error: 'COLAB_FASTAPI_URL not configured. Set it in environment variables or enable local execution with USE_LOCAL_PEN_SKETCH=true.',
				});
			}

			// Check if Colab server is accessible before proceeding
			try {
				const healthCheck = await axios.get(`${COLAB_FASTAPI_URL}/health`, {
					timeout: 5000,
					validateStatus: (status) => status === 200
				});
				console.log(`[Pen Sketch] ✅ Colab server is accessible: ${COLAB_FASTAPI_URL}`);
			} catch (error: any) {
				const errorMessage = error.response?.status === 404 
					? 'Colab server endpoint not found (404). The server may be offline or the ngrok tunnel is not active.'
					: error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT'
					? 'Cannot connect to Colab server. The server may be offline or the ngrok tunnel is not active.'
					: `Colab server is not accessible: ${error.message}`;
				
				console.error(`[Pen Sketch] ❌ ${errorMessage}`);
				console.error(`[Pen Sketch]    COLAB_FASTAPI_URL: ${COLAB_FASTAPI_URL}`);
				console.error(`[Pen Sketch]    Tip: Set USE_LOCAL_PEN_SKETCH=true to use local execution instead`);
				
				return res.status(503).json({
					error: 'Colab server is not accessible',
					message: errorMessage,
					colab_url: COLAB_FASTAPI_URL,
					suggestion: 'Set USE_LOCAL_PEN_SKETCH=true in environment variables to use local execution',
					suggestions: [
						'Set USE_LOCAL_PEN_SKETCH=true to use local execution (recommended)',
						'Or ensure Colab FastAPI server is running',
						'Or check if ngrok tunnel is active (if using ngrok)',
						'Or verify COLAB_FASTAPI_URL environment variable is correct'
					]
				});
			}
		}

		// Generate job ID
		jobId = `pen-sketch-${Date.now()}-${uuidv4().substring(0, 6)}`;

		// Generate voiceover if requested
		let voiceoverUrl: string | undefined;
		let finalVoiceoverScript = voiceoverScript;
		
		if (generateVoiceover && !voiceoverScript) {
			// Generate voiceover script from images (simple description)
			finalVoiceoverScript = `This animation shows ${imageUrls.length} educational diagram${imageUrls.length > 1 ? 's' : ''} that illustrate key concepts.`;
		}
		
		if (generateVoiceover && finalVoiceoverScript) {
			try {
				const audioBuffer = await synthesizeSpeech({
					text: finalVoiceoverScript,
					upbeat: true,
				});
				
				// Save voiceover
				const voiceoverDir = path.join(process.cwd(), 'public', 'assets', 'voiceovers');
				await fs.mkdir(voiceoverDir, { recursive: true });
				const voiceoverPath = path.join(voiceoverDir, `pen-sketch-${jobId}.mp3`);
				await fs.writeFile(voiceoverPath, audioBuffer);
				voiceoverUrl = `/assets/voiceovers/pen-sketch-${jobId}.mp3`;
			} catch (error: any) {
				console.warn(`[Pen Sketch] Voiceover generation failed:`, error.message);
				console.warn(`[Pen Sketch] Error details:`, error);
			}
		}

		// Create job
		job = {
			jobId,
			status: 'processing',
			imageUrls,
			voiceoverUrl,
			voiceoverScript: finalVoiceoverScript,
			createdAt: new Date(),
		};
		jobs.set(jobId, job);

		// Download images and prepare for upload
		const tempDir = path.join(process.cwd(), 'temp', 'pen-sketch', jobId);
		await fs.mkdir(tempDir, { recursive: true });

		const imagePaths: string[] = [];
		const baseUrl = `${req.protocol}://${req.get('host')}`;
		
		for (let i = 0; i < imageUrls.length; i++) {
			let imageUrl = imageUrls[i];
			
			// Convert relative URLs to absolute URLs
			if (imageUrl.startsWith('/')) {
				imageUrl = `${baseUrl}${imageUrl}`;
			} else if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
				// If it's a relative path without leading slash, assume it's from public directory
				imageUrl = `${baseUrl}/${imageUrl}`;
			}
			
			try {
				const response = await axios.get(imageUrl, { 
					responseType: 'arraybuffer',
					timeout: 30000, // 30 second timeout
					validateStatus: (status) => status === 200 // Only accept 200 status
				});
				
				// Try to get extension from URL, fallback to .png
				let ext = '.png';
				try {
					const urlPath = new URL(imageUrl).pathname;
					ext = path.extname(urlPath) || '.png';
				} catch {
					// If URL parsing fails, try pathname from original URL
					ext = path.extname(imageUrls[i]) || '.png';
				}
				
				const imagePath = path.join(tempDir, `image_${i.toString().padStart(3, '0')}${ext}`);
				await fs.writeFile(imagePath, response.data);
				imagePaths.push(imagePath);
			} catch (error: any) {
				console.error(`[Pen Sketch] Failed to download image ${i} from ${imageUrl}:`, error.message);
				// If it's a local file path, try to read it directly
				if (imageUrl.startsWith('/') && !imageUrl.startsWith('http')) {
					try {
						const localPath = path.join(process.cwd(), imageUrl);
						const ext = path.extname(localPath) || '.png';
						const imagePath = path.join(tempDir, `image_${i.toString().padStart(3, '0')}${ext}`);
						await fs.copyFile(localPath, imagePath);
						imagePaths.push(imagePath);
						console.log(`[Pen Sketch] Copied local file: ${localPath}`);
					} catch (localError: any) {
						throw new Error(`Failed to download or access image ${i}: ${error.message}. Local file access also failed: ${localError.message}`);
					}
				} else {
					throw error;
				}
			}
		}

		// Execute locally or send to Colab
		if (USE_LOCAL_PEN_SKETCH) {
			// LOCAL EXECUTION - Run sketch_animate_whiteboard.py script (stroke-by-stroke drawing)
			console.log(`[Pen Sketch] 🖊️  Running whiteboard animation locally using sketch_animate_whiteboard.py...`);
			
			// Prepare output path
			const outputDir = path.join(process.cwd(), 'output', 'pen-sketch');
			await fs.mkdir(outputDir, { recursive: true });
			const outputPath = path.join(outputDir, `pen-sketch-${jobId}.mp4`);
			
			// Prepare Python script path
			// Use whiteboard version for stroke-by-stroke path drawing (like YouTube whiteboard videos)
			const scriptPath = path.join(process.cwd(), 'sketch_animate_whiteboard.py');
			
			// Use first image (sketch_animate_whiteboard.py processes one image at a time)
			// If multiple images, process them sequentially
			const firstImagePath = imagePaths[0];
			
			// Build command arguments for sketch_animate_whiteboard.py
			const args = [
				scriptPath,
				firstImagePath,  // Input PNG (positional argument)
				'--output', outputPath,
				'--duration', duration.toString(),
				'--fps', fps.toString(),
				'--width', width.toString(),
				'--height', height.toString(),
				'--variant', `pen-sketch-${jobId}`,
			];
			
			// Run Python script
			job.status = 'processing';
			console.log(`[Pen Sketch] 🐍 Executing: python ${args.join(' ')}`);
			
			// Process in background
			processLocalAnimation(jobId, args, outputPath, tempDir);
			
			return res.status(202).json({
				jobId,
				status: 'processing',
				mode: 'local',
				createdAt: job.createdAt.toISOString(),
				endpoints: {
					status: `/api/pen-sketch/status/${jobId}`,
					download: `/api/pen-sketch/download/${jobId}`,
				},
			});
		} else {
			// COLAB MODE - Send to Colab FastAPI
			const FormData = require('form-data');
			const formData = new FormData();
			for (const imagePath of imagePaths) {
				const imageBuffer = await fs.readFile(imagePath);
				formData.append('images', imageBuffer, {
					filename: path.basename(imagePath),
					contentType: 'image/png',
				});
			}
			// Enhanced algorithm parameters
			// Simplified Colab parameters (if still using Colab)
			// Simplified Colab parameters
			formData.append('fps', fps.toString());
			formData.append('duration', duration.toString());
			formData.append('width', width.toString());
			formData.append('height', height.toString());
			
			// Legacy parameters (for compatibility with older pipelines)
			formData.append('fps', fps.toString());
			formData.append('duration', duration.toString());
			formData.append('job_id', jobId);
			formData.append('width', width.toString());
			formData.append('height', height.toString());
			
			// Add voiceover URL if available
			if (voiceoverUrl) {
				const baseUrl = `${req.protocol}://${req.get('host')}`;
				const absoluteVoiceoverUrl = voiceoverUrl.startsWith('http') 
					? voiceoverUrl 
					: `${baseUrl}${voiceoverUrl}`;
				formData.append('voiceover_url', absoluteVoiceoverUrl);
			}

			let colabResponse;
			try {
				colabResponse = await axios.post(
					`${COLAB_FASTAPI_URL}/api/animate`,
					formData,
					{
						headers: formData.getHeaders(),
						timeout: 600000,
						validateStatus: (status) => status >= 200 && status < 300
					}
				);
			} catch (error: any) {
				job.status = 'failed';
				job.error = 'Failed to send request to Colab server';
				job.completedAt = new Date();
				return res.status(503).json({
					error: 'Failed to send request to Colab server',
					message: error.message || 'Unknown error',
					colab_url: COLAB_FASTAPI_URL,
				});
			}

			job.status = 'processing';
			pollColabJob(jobId, colabResponse.data.job_id, tempDir);

			return res.status(202).json({
				jobId,
				status: 'processing',
				colabJobId: colabResponse.data.job_id,
				mode: 'colab',
				createdAt: job.createdAt.toISOString(),
				endpoints: {
					status: `/api/pen-sketch/status/${jobId}`,
					download: `/api/pen-sketch/download/${jobId}`,
				},
			});
		}
	} catch (error: any) {
		console.error('[Pen Sketch] ❌ Error creating pen-sketch animation:', error);
		
		// Try to update job status if it exists
		if (jobId && job) {
			job.status = 'failed';
			job.error = error.message || 'Unknown error';
			job.completedAt = new Date();
			jobs.set(jobId, job);
		}
		
		// Check if it's a Colab connection error that wasn't caught earlier
		if (error.response?.status === 404 && error.response?.headers?.['ngrok-error-code']) {
			return res.status(503).json({
				error: 'Colab server is offline',
				message: 'The ngrok tunnel is not active or the server is not running.',
				colab_url: COLAB_FASTAPI_URL,
				ngrok_error: error.response.headers['ngrok-error-code'],
				suggestions: [
					'Start the Colab FastAPI server',
					'Start/restart the ngrok tunnel',
					'Verify the ngrok URL matches COLAB_FASTAPI_URL'
				]
			});
		}
		
		res.status(500).json({
			error: 'Failed to create animation',
			message: error.message || 'Unknown error occurred',
			details: process.env.NODE_ENV === 'development' ? error.stack : undefined
		});
	}
});

/**
 * Process animation locally using Python script
 */
async function processLocalAnimation(
	localJobId: string,
	args: string[],
	outputPath: string,
	tempDir: string
) {
	const job = jobs.get(localJobId);
	if (!job) return;

	try {
		console.log(`[Pen Sketch] 🐍 Starting local Python script...`);
		
		// Determine Python command (python3 or python)
		const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
		
		// Spawn Python process with UTF-8 encoding for Windows
		const spawnOptions: any = {
			cwd: process.cwd(),
			stdio: ['ignore', 'pipe', 'pipe'],
		};
		
		// Set UTF-8 encoding for Windows
		if (process.platform === 'win32') {
			spawnOptions.env = {
				...process.env,
				PYTHONIOENCODING: 'utf-8',
			};
		}
		
		const pythonProcess = spawn(pythonCmd, args, spawnOptions);

		let stdout = '';
		let stderr = '';

		pythonProcess.stdout?.on('data', (data) => {
			const output = data.toString('utf8');
			stdout += output;
			// Only log non-JSON lines (JSON will be parsed separately)
			if (!output.trim().startsWith('{') && !output.trim().startsWith('[')) {
				console.log(`[Pen Sketch Python] ${output.trim()}`);
			}
		});

		pythonProcess.stderr?.on('data', (data) => {
			const output = data.toString('utf8');
			stderr += output;
			console.error(`[Pen Sketch Python Error] ${output.trim()}`);
		});

		// Wait for process to complete
		const exitCode = await new Promise<number>((resolve) => {
			pythonProcess.on('close', (code) => {
				resolve(code || 0);
			});
		});

		if (exitCode !== 0) {
			throw new Error(`Python script failed with exit code ${exitCode}: ${stderr}`);
		}

		// sketch_animate_whiteboard.py outputs directly to the specified path
		// Check if output file exists (with retry for filesystem sync delay)
		const finalOutputPath = outputPath;
		let fileFound = false;
		
		for (let attempt = 0; attempt < 10; attempt++) {
			try {
				await fs.access(finalOutputPath);
				const stats = await fs.stat(finalOutputPath);
				if (stats.size > 0) {
					console.log(`[Pen Sketch] ✓ Output file verified: ${finalOutputPath} (${stats.size} bytes)`);
					fileFound = true;
					break;
				} else {
					console.warn(`[Pen Sketch] File exists but is empty (attempt ${attempt + 1}/10)`);
				}
			} catch {
				console.warn(`[Pen Sketch] File not found yet (attempt ${attempt + 1}/10)`);
			}
			
			// Wait a bit for filesystem to sync
			await new Promise(resolve => setTimeout(resolve, 200));
		}
		
		if (!fileFound) {
			// Try alternative location (in case script created it elsewhere)
			const outputDir = path.join(process.cwd(), 'output', 'pen-sketch');
			const possiblePath = path.join(outputDir, `pen-sketch-${localJobId}.mp4`);
			try {
				await fs.access(possiblePath);
				console.log(`[Pen Sketch] Found output at alternative location: ${possiblePath}`);
			} catch {
				throw new Error(`Output video file not found after 10 attempts. Expected: ${finalOutputPath}`);
			}
		}

		// Add voiceover if available
		if (job.voiceoverUrl) {
			try {
				let voiceoverPath: string;
				if (job.voiceoverUrl.startsWith('/')) {
					const relativePath = job.voiceoverUrl.substring(1);
					voiceoverPath = path.join(process.cwd(), 'public', relativePath);
				} else if (path.isAbsolute(job.voiceoverUrl)) {
					voiceoverPath = job.voiceoverUrl;
				} else {
					voiceoverPath = path.join(process.cwd(), 'public', job.voiceoverUrl);
				}
				
				await fs.access(voiceoverPath);
				
				const finalVideoWithAudio = path.join(outputDir, `pen-sketch-${localJobId}-final.mp4`);
				const ffmpeg = require('fluent-ffmpeg');
				const ffmpegStatic = require('ffmpeg-static');
				
				if (ffmpegStatic) {
					ffmpeg.setFfmpegPath(ffmpegStatic);
				}
				
				await new Promise<void>((resolve, reject) => {
					ffmpeg(finalVideoPath)
						.input(voiceoverPath)
						.videoCodec('copy')
						.audioCodec('aac')
						.outputOptions([
							'-map 0:v:0',
							'-map 1:a:0',
							'-shortest',
							'-movflags +faststart'
						])
						.on('end', () => resolve())
						.on('error', (err: Error) => reject(err))
						.save(finalVideoWithAudio);
				});
				
				await fs.unlink(finalVideoPath);
				await fs.rename(finalVideoWithAudio, finalVideoPath);
				console.log(`[Pen Sketch] ✅ Added voiceover to video`);
			} catch (error: any) {
				console.warn(`[Pen Sketch] ⚠️  Failed to add voiceover:`, error.message);
			}
		}

		// Update job
		job.status = 'completed';
		job.completedAt = new Date();
		job.videoUrl = `/output/pen-sketch/pen-sketch-${localJobId}.mp4`;

		// Cleanup temp files
		await fs.rm(tempDir, { recursive: true, force: true });

		console.log(`[Pen Sketch] ✅ Local animation completed: ${localJobId}`);
	} catch (error: any) {
		console.error(`[Pen Sketch] ❌ Local animation failed:`, error);
		job.status = 'failed';
		job.error = error.message || 'Local animation failed';
		job.completedAt = new Date();
	}
}

/**
 * Poll Colab job for completion
 */
async function pollColabJob(localJobId: string, colabJobId: string, tempDir: string) {
	const maxAttempts = 120; // 10 minutes (5 second intervals
	let attempts = 0;

	while (attempts < maxAttempts) {
		try {
			await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

			const statusResponse = await axios.get(`${COLAB_FASTAPI_URL}/api/status/${colabJobId}`);
			const status = statusResponse.data.status;

			const job = jobs.get(localJobId);
			if (!job) return;

			if (status === 'completed') {
				// Download video from Colab
				const videoResponse = await axios.get(
					`${COLAB_FASTAPI_URL}/api/download/${colabJobId}`,
					{ responseType: 'arraybuffer' }
				);

				// Save video in dedicated pen-sketch folder
				const outputDir = path.join(process.cwd(), 'output', 'pen-sketch');
				await fs.mkdir(outputDir, { recursive: true });
				let videoPath = path.join(outputDir, `pen-sketch-${localJobId}.mp4`);
				await fs.writeFile(videoPath, videoResponse.data);

				// Add voiceover if available
				if (job.voiceoverUrl) {
					try {
						// Fix voiceover path - handle both relative and absolute paths
						let voiceoverPath: string;
						if (job.voiceoverUrl.startsWith('/')) {
							// Remove leading slash and join with public directory
							const relativePath = job.voiceoverUrl.substring(1);
							voiceoverPath = path.join(process.cwd(), 'public', relativePath);
						} else if (path.isAbsolute(job.voiceoverUrl)) {
							voiceoverPath = job.voiceoverUrl;
						} else {
							// Relative path, assume it's in public directory
							voiceoverPath = path.join(process.cwd(), 'public', job.voiceoverUrl);
						}
						
						// Verify file exists
						try {
							await fs.access(voiceoverPath);
						} catch {
							throw new Error(`Voiceover file not found: ${voiceoverPath}`);
						}
						
						const finalVideoPath = path.join(outputDir, `pen-sketch-${localJobId}-final.mp4`);
						
						// Use fluent-ffmpeg to add audio (cross-platform, uses bundled ffmpeg)
						const ffmpeg = require('fluent-ffmpeg');
						const ffmpegStatic = require('ffmpeg-static');
						
						// Set ffmpeg path from static binary (works on Windows, Mac, Linux)
						if (ffmpegStatic) {
							ffmpeg.setFfmpegPath(ffmpegStatic);
						}
						
						await new Promise<void>((resolve, reject) => {
							ffmpeg(videoPath)
								.input(voiceoverPath)
								.videoCodec('copy')  // Copy video stream (no re-encoding)
								.audioCodec('aac')  // Encode audio as AAC
								.outputOptions([
									'-map 0:v:0',  // Map video from first input
									'-map 1:a:0',  // Map audio from second input
									'-shortest',   // Finish when shortest stream ends
									'-movflags +faststart'  // Web optimization
								])
								.on('end', () => {
									console.log(`[Pen Sketch] Successfully added voiceover to video`);
									resolve();
								})
								.on('error', (err: Error) => {
									console.error(`[Pen Sketch] FFmpeg error:`, err);
									reject(err);
								})
								.save(finalVideoPath);
						});
						
						// Replace video with final version
						await fs.unlink(videoPath);
						await fs.rename(finalVideoPath, videoPath);
						
						console.log(`[Pen Sketch] Added voiceover to video: ${jobId}`);
					} catch (error: any) {
						console.warn(`[Pen Sketch] Failed to add voiceover:`, error.message);
						// Continue without voiceover
					}
				}

				// Update job
				job.status = 'completed';
				job.completedAt = new Date();
				job.videoUrl = `/output/pen-sketch/pen-sketch-${localJobId}.mp4`;

				// Cleanup temp files
				await fs.rm(tempDir, { recursive: true, force: true });

				return;
			} else if (status === 'failed') {
				job.status = 'failed';
				job.error = statusResponse.data.error || 'Animation failed';
				job.completedAt = new Date();
				await fs.rm(tempDir, { recursive: true, force: true });
				return;
			}

			attempts++;
		} catch (error: any) {
			console.error(`Error polling Colab job ${colabJobId}:`, error.message);
			attempts++;
		}
	}

	// Timeout
	const job = jobs.get(localJobId);
	if (job) {
		job.status = 'failed';
		job.error = 'Animation timeout - Colab job took too long';
		job.completedAt = new Date();
	}
}

/**
 * GET /api/pen-sketch/status/:jobId
 * Get animation job status
 */
router.get('/status/:jobId', async (req: Request, res: Response) => {
	try {
		const { jobId } = req.params;
		const job = jobs.get(jobId);

		if (!job) {
			return res.status(404).json({
				error: 'Job not found',
			});
		}

		return res.json({
			jobId: job.jobId,
			status: job.status,
			createdAt: job.createdAt.toISOString(),
			completedAt: job.completedAt?.toISOString(),
			error: job.error,
			videoUrl: job.videoUrl,
			voiceoverUrl: job.voiceoverUrl,
			voiceoverScript: job.voiceoverScript,
		});
	} catch (error: any) {
		console.error('Error getting job status:', error);
		res.status(500).json({
			error: error.message || 'Failed to get job status',
		});
	}
});

/**
 * GET /api/pen-sketch/download/:jobId
 * Download completed animation video
 */
router.get('/download/:jobId', async (req: Request, res: Response) => {
	try {
		const { jobId } = req.params;
		const job = jobs.get(jobId);

		if (!job) {
			return res.status(404).json({
				error: 'Job not found',
			});
		}

		if (job.status !== 'completed' || !job.videoUrl) {
			return res.status(400).json({
				error: `Job is not completed. Current status: ${job.status}`,
			});
		}

		// Handle video path (support both old and new formats)
		let videoPath: string;
		if (job.videoUrl.startsWith('/output/pen-sketch/')) {
			videoPath = path.join(process.cwd(), job.videoUrl);
		} else if (job.videoUrl.startsWith('/output/')) {
			// Old format - try to find in pen-sketch folder
			const filename = path.basename(job.videoUrl);
			videoPath = path.join(process.cwd(), 'output', 'pen-sketch', filename);
		} else {
			videoPath = path.join(process.cwd(), job.videoUrl);
		}
		
		try {
			await fs.access(videoPath);
			
			// Set proper headers for video download
			const stats = await fs.stat(videoPath);
			res.setHeader('Content-Type', 'video/mp4');
			res.setHeader('Content-Disposition', `attachment; filename="pen-sketch-${jobId}.mp4"`);
			res.setHeader('Content-Length', stats.size);
			
			// Stream the file
			const fileBuffer = await fs.readFile(videoPath);
			return res.send(fileBuffer);
		} catch (error: any) {
			console.error(`[Pen Sketch] Video file not found at: ${videoPath}`, error);
			console.error(`[Pen Sketch] Job videoUrl: ${job.videoUrl}`);
			return res.status(404).json({
				error: 'Video file not found',
				path: videoPath,
				videoUrl: job.videoUrl,
			});
		}
	} catch (error: any) {
		console.error('Error downloading video:', error);
		res.status(500).json({
			error: error.message || 'Failed to download video',
		});
	}
});

export default router;

