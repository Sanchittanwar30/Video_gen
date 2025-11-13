import path from 'path';
import {promises as fs} from 'fs';
import {v4 as uuidv4} from 'uuid';

const DEFAULT_ASSETS_SUBDIR = path.join('public', 'assets');

const ensureAssetsDir = async () => {
	const configured = process.env.ASSETS_DIR;
	const absoluteDir = configured
		? path.resolve(process.cwd(), configured)
		: path.join(process.cwd(), DEFAULT_ASSETS_SUBDIR);
	await fs.mkdir(absoluteDir, {recursive: true});
	return absoluteDir;
};

const assetUrlFromPath = (absolutePath: string): string => {
	const configured = process.env.ASSETS_DIR
		? path.resolve(process.cwd(), process.env.ASSETS_DIR)
		: path.join(process.cwd(), DEFAULT_ASSETS_SUBDIR);
	const relative = path.relative(configured, absolutePath);
	return `/assets/${relative.replace(/\\/g, '/')}`;
};

/**
 * Placeholder Veo integration. In production, replace this implementation
 * with a call to Google AI's Veo 3 API and persist the returned MP4.
 */
export const generateMotionScene = async (prompt: string): Promise<string | undefined> => {
	try {
		const assetsDir = await ensureAssetsDir();
		const filename = `veo-placeholder-${uuidv4()}.mp4`;
		const target = path.join(assetsDir, filename);
		const caption = `Veo 3 placeholder clip for prompt: ${prompt}`;
		await fs.writeFile(target, Buffer.from(caption, 'utf-8'));
		return assetUrlFromPath(target);
	} catch (error) {
		console.warn('Failed to create placeholder motion scene asset', error);
		return undefined;
	}
};


