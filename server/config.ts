import dotenv from 'dotenv';

dotenv.config();

export const config = {
	server: {
		port: parseInt(process.env.PORT || '3000', 10),
		env: process.env.NODE_ENV || 'development',
	},
	redis: {
		host: process.env.REDIS_HOST || 'localhost',
		port: parseInt(process.env.REDIS_PORT || '6379', 10),
		password: process.env.REDIS_PASSWORD || undefined,
	},
	storage: {
		provider: (process.env.ASSET_STORAGE_PROVIDER || 'supabase').toLowerCase(),
		supabase: {
			url: process.env.SUPABASE_URL || '',
			key: process.env.SUPABASE_KEY || '',
			bucket: process.env.SUPABASE_BUCKET || 'videos',
		},
		// Local storage fallback for development
		local: {
			baseDir: process.env.OUTPUT_DIR || './output',
		},
	},
	ai: {
		geminiApiKey: process.env.GEMINI_API_KEY || '',
		geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
	},
	paths: {
		outputDir: process.env.OUTPUT_DIR || './output',
		tempDir: process.env.TEMP_DIR || './temp',
	},
	websocket: {
		port: parseInt(process.env.WEBSOCKET_PORT || '3001', 10),
	},
	colab: {
		enabled: process.env.COLAB_ENABLED === 'true',
		notebookUrl: process.env.COLAB_NOTEBOOK_URL,
		apiToken: process.env.COLAB_API_TOKEN,
		uploadEndpoint: process.env.COLAB_UPLOAD_ENDPOINT,
		downloadEndpoint: process.env.COLAB_DOWNLOAD_ENDPOINT,
	},
};

