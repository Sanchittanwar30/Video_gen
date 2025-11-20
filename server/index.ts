import 'dotenv/config';

import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { promises as fs } from 'fs';
import { config } from './config';
import aiRoutes from './routes/ai';
import generateVideoRoute from './routes/generateVideo';
import colabRoutes from './routes/colab';
import vectorizeRoutes from './routes/vectorize';
import penSketchRoutes from './routes/penSketch';
import { VideoWebSocketServer } from './websocket';


const app = express();



// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/ai', aiRoutes);
app.use('/api/colab', colabRoutes);
app.use('/api/vectorize', vectorizeRoutes);
app.use('/api/pen-sketch', penSketchRoutes);
app.use('/output', express.static(path.join(process.cwd(), 'output')));
const assetsDirectory = process.env.ASSETS_DIR
	? path.resolve(process.cwd(), process.env.ASSETS_DIR)
	: path.join(process.cwd(), 'public', 'assets');
app.use('/assets', express.static(assetsDirectory));

// Serve pen-sketch uploads
app.use('/assets/pen-sketch-uploads', express.static(path.join(process.cwd(), 'public', 'assets', 'pen-sketch-uploads')));

// Ensure pen-sketch output directory exists
const penSketchOutputDir = path.join(process.cwd(), 'output', 'pen-sketch');
fs.mkdir(penSketchOutputDir, { recursive: true }).catch(() => {
	// Ignore errors, directory might already exist
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
	res.json({
		status: 'ok',
		timestamp: new Date().toISOString(),
		service: 'video-generation-api',
	});
});

// API routes
app.use('/api', generateVideoRoute);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
	res.json({
		message: 'Video Generation API',
		version: '1.0.0',
		endpoints: {
			health: '/health',
			generateVideo: 'POST /api/generate-video',
			colab: {
				generate: 'POST /api/colab/generate',
				status: 'GET /api/colab/status/:jobId',
				download: 'GET /api/colab/download/:jobId',
				pending: 'GET /api/colab/jobs/pending',
			},
			penSketch: {
				animate: 'POST /api/pen-sketch/animate',
				status: 'GET /api/pen-sketch/status/:jobId',
				download: 'GET /api/pen-sketch/download/:jobId',
			},
		},
	});
});

// Start HTTP server
const port = config.server.port;
const server = app.listen(port, () => {
	console.log(`🚀 Video Generation API server running on port ${port}`);
	console.log(`📡 Health check: http://localhost:${port}/health`);
	console.log(`📝 API docs: http://localhost:${port}/`);
});

// Start WebSocket server
const wsServer = new VideoWebSocketServer(config.websocket.port);
console.log(`🔌 WebSocket server running on port ${config.websocket.port}`);

// Graceful shutdown
process.on('SIGTERM', () => {
	console.log('SIGTERM signal received: closing HTTP server');
	server.close(() => {
		console.log('HTTP server closed');
		process.exit(0);
	});
});

export { app, wsServer };

