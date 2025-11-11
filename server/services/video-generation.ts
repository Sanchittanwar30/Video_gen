import fs from 'fs/promises';
import path from 'path';
import {existsSync} from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { renderPresentationContent } from '../../render';
import type { PresentationBuildRequest, PresentationContent } from '../../src/types/presentation';
import { generatePresentationDraft, buildPresentationFromDraft } from './presentation-orchestrator';

interface GenerateVideoFromTopicPayload {
	topic: string;
	durationSeconds?: number;
	backgroundMusic?: string;
	notes?: string;
	language?: string;
}

export type GenerateVideoRequest =
	| {
			type: 'presentation';
			payload: PresentationBuildRequest;
	  }
	| {
			type: 'topic';
			payload: GenerateVideoFromTopicPayload;
	  }
	| {
			type: 'template';
			payload: {
				template: string;
				input: Record<string, unknown>;
			};
	  };

export interface GenerateVideoResponse {
	success: boolean;
	videoUrl?: string;
	transcript?: string;
	transcriptUrl?: string;
	content?: PresentationContent;
	error?: string;
}

const ensureTmpDir = async (prefix: string) => {
	const dir = await fs.mkdtemp(path.join(process.cwd(), prefix));
	return dir;
};

const cleanupTempDir = async (dir: string) => {
	try {
		await fs.rm(dir, { recursive: true, force: true });
	} catch (error) {
		console.warn('Failed to clean up temp dir', dir, error);
	}
};

const ensureLocalAsset = async (src: string, jobId: string, label: string) => {
	const response = await fetch(src);
	if (!response.ok) {
		throw new Error(`Failed to download ${label} asset from ${src}`);
	}

	const arrayBuffer = await response.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);
	const ext = path.extname(src) || '.mp3';
	const dir = path.join(process.cwd(), 'temp-assets', jobId);
	await fs.mkdir(dir, { recursive: true });
	const filePath = path.join(dir, `${label}${ext}`);
	await fs.writeFile(filePath, buffer);
	return filePath;
};

const resolvePresentationContent = async (
	request: GenerateVideoRequest
): Promise<PresentationContent> => {
	if (request.type === 'presentation') {
		const payload = request.payload;

		if ((payload as Partial<PresentationContent>).chapters) {
			return payload as unknown as PresentationContent;
		}

		const draft = await generatePresentationDraft({
			topic: payload.titleText ?? 'Auto-generated lesson',
			durationSeconds: payload.chapterTimes?.reduce(
				(sum, chapter) => sum + (chapter.endSeconds - chapter.startSeconds),
				0
			),
			backgroundMusic: payload.backgroundMusic,
			notes: payload.subtitleText,
			language: payload.language,
		});

		return buildPresentationFromDraft(draft);
	}

	if (request.type === 'topic') {
		const draft = await generatePresentationDraft(request.payload);
		return buildPresentationFromDraft(draft);
	}

	throw new Error('Template-based rendering not implemented in this build');
};

export const generateVideoFromRequest = async (
	request: GenerateVideoRequest
): Promise<GenerateVideoResponse> => {
	const jobId = uuidv4();
	const tempDir = await ensureTmpDir(`video-job-${jobId}`);
	const outputDir = path.join(process.cwd(), 'output');
	if (!existsSync(outputDir)) {
		await fs.mkdir(outputDir, {recursive: true});
	}
	const outputPath = path.join(outputDir, `${jobId}.mp4`);

	try {
		const content = await resolvePresentationContent(request);
		let backgroundMusicSrc: string | undefined = content.backgroundMusic;

		if (backgroundMusicSrc?.startsWith('http')) {
			backgroundMusicSrc = await ensureLocalAsset(backgroundMusicSrc, jobId, 'background-music');
		}

		// Render video using Remotion renderer wrapper
		const result = await renderPresentationContent({
			content: {
				...content,
				backgroundMusic: backgroundMusicSrc ?? content.backgroundMusic,
			},
			outPath: outputPath,
		});

		const transcript = content.chapters.map((chapter) => chapter.summary).join('\n');
		const transcriptPath = path.join(outputDir, `${jobId}.txt`);
		await fs.writeFile(transcriptPath, transcript, 'utf-8');

		return {
			success: true,
			videoUrl: `/output/${path.basename(result.outputLocation)}`,
			transcript,
			transcriptUrl: `/output/${path.basename(transcriptPath)}`,
			content,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	} finally {
		await cleanupTempDir(tempDir);
	}
};