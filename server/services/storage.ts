import {createClient} from '@supabase/supabase-js';
import {config} from '../config';
import {readFileSync} from 'fs';
import {join} from 'path';

/**
 * Storage service interface
 */
export interface StorageService {
	uploadFile(localPath: string, remotePath: string): Promise<string>;
	downloadFile(remotePath: string, localPath: string): Promise<void>;
	getPublicUrl(remotePath: string): Promise<string>;
	deleteFile(remotePath: string): Promise<void>;
}


/**
 * Supabase Storage implementation
 */
class SupabaseStorageService implements StorageService {
	private supabase: any;
	private bucket: string;

	constructor() {
		this.supabase = createClient(config.storage.supabase.url, config.storage.supabase.key);
		this.bucket = config.storage.supabase.bucket;
	}

	async uploadFile(localPath: string, remotePath: string): Promise<string> {
		const fileContent = readFileSync(localPath);
		
		const {data, error} = await this.supabase.storage
			.from(this.bucket)
			.upload(remotePath, fileContent, {
				contentType: this.getContentType(remotePath),
				upsert: true,
			});

		if (error) {
			throw new Error(`Failed to upload to Supabase: ${error.message}`);
		}

		const {data: urlData} = this.supabase.storage
			.from(this.bucket)
			.getPublicUrl(remotePath);

		return urlData.publicUrl;
	}

	async downloadFile(remotePath: string, localPath: string): Promise<void> {
		const {data, error} = await this.supabase.storage
			.from(this.bucket)
			.download(remotePath);

		if (error) {
			throw new Error(`Failed to download from Supabase: ${error.message}`);
		}

		const arrayBuffer = await data.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		require('fs').writeFileSync(localPath, buffer);
	}

	async getPublicUrl(remotePath: string): Promise<string> {
		const {data} = this.supabase.storage
			.from(this.bucket)
			.getPublicUrl(remotePath);

		return data.publicUrl;
	}

	async deleteFile(remotePath: string): Promise<void> {
		const {error} = await this.supabase.storage
			.from(this.bucket)
			.remove([remotePath]);

		if (error) {
			throw new Error(`Failed to delete from Supabase: ${error.message}`);
		}
	}

	private getContentType(filename: string): string {
		const ext = filename.split('.').pop()?.toLowerCase();
		const types: Record<string, string> = {
			mp4: 'video/mp4',
			json: 'application/json',
			png: 'image/png',
			jpg: 'image/jpeg',
			jpeg: 'image/jpeg',
			mp3: 'audio/mpeg',
			wav: 'audio/wav',
			m4a: 'audio/mp4',
			txt: 'text/plain',
		};
		return types[ext || ''] || 'application/octet-stream';
	}
}

/**
 * Local filesystem storage (for development/testing)
 */
class LocalStorageService implements StorageService {
	private baseDir: string;

	constructor() {
		this.baseDir = config.paths.outputDir;
	}

	async uploadFile(localPath: string, remotePath: string): Promise<string> {
		const fs = require('fs');
		const path = require('path');
		const destPath = path.join(this.baseDir, remotePath);
		
		// Ensure directory exists
		const destDir = path.dirname(destPath);
		if (!fs.existsSync(destDir)) {
			fs.mkdirSync(destDir, {recursive: true});
		}

		fs.copyFileSync(localPath, destPath);
		return `/files/${remotePath}`; // Relative URL for local storage
	}

	async downloadFile(remotePath: string, localPath: string): Promise<void> {
		const fs = require('fs');
		const path = require('path');
		const sourcePath = path.join(this.baseDir, remotePath);
		fs.copyFileSync(sourcePath, localPath);
	}

	async getPublicUrl(remotePath: string): Promise<string> {
		return `/files/${remotePath}`;
	}

	async deleteFile(remotePath: string): Promise<void> {
		const fs = require('fs');
		const path = require('path');
		const filePath = path.join(this.baseDir, remotePath);
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
		}
	}
}

/**
 * Get storage service based on configuration
 */
export function getStorageService(): StorageService {
	const provider = config.storage.provider;
	
	switch (provider) {
		case 'supabase':
			if (!config.storage.supabase.url || !config.storage.supabase.key) {
				console.warn('Supabase credentials not configured, falling back to local storage');
				return new LocalStorageService();
			}
			return new SupabaseStorageService();
		case 'local':
		default:
			return new LocalStorageService();
	}
}

