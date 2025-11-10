import axios from 'axios';
import {existsSync, mkdirSync, unlinkSync, writeFileSync} from 'fs';
import {dirname, extname, join} from 'path';
import {v4 as uuid} from 'uuid';
import {renderTemplateToMp4, renderOcrPresentation, renderPresentationContent} from '../../render/index';
import {getStorageService} from './storage';
import {config} from '../config';
import type {PresentationJobPayload} from '../../src/types/presentation';
import {generatePresentationDraft, buildPresentationFromDraft} from './presentation-orchestrator';

const storage = getStorageService();

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

async function ensureLocalAsset(source: string, jobId: string, hint: string): Promise<string> {
	if (!isHttpUrl(source)) {
		return source;
	}

	const response = await axios.get<ArrayBuffer>(source, {
		responseType: 'arraybuffer',
		timeout: 30000,
	});

	const buffer = Buffer.from(response.data);
	const urlPath = new URL(source).pathname;
	const extFromUrl = extname(urlPath);
	const extension = extFromUrl && extFromUrl.length <= 5 ? extFromUrl : '.bin';
	const jobDir = join(config.paths.tempDir, jobId);
	if (!existsSync(jobDir)) {
		mkdirSync(jobDir, {recursive: true});
	}
	const filePath = join(jobDir, `${hint}${extension}`);
	writeFileSync(filePath, buffer);
	return filePath;
}

export interface GenerateVideoRequest {
	template?: any;
	input?: Record<string, any>;
	options?: {
		fps?: number;
		width?: number;
		height?: number;
		duration?: number;
		lowResolution?: boolean;
	};
	transcript?: string;
	userId?: string;
	webhookUrl?: string;
	presentation?: PresentationJobPayload;
	title?: string;
	topic?: string;
}

export interface GenerateVideoResult {
	videoUrl: string;
	transcriptUrl?: string;
	jobId: string;
	remotePath: string;
}

export async function generateVideoFromRequest(request: GenerateVideoRequest): Promise<GenerateVideoResult> {
	const jobId = uuid();
	const outputDir = config.paths.outputDir;
	if (!existsSync(outputDir)) {
		mkdirSync(outputDir, {recursive: true});
	}
	const outputFilename = `${jobId}.mp4`;
	const outputPath = join(outputDir, outputFilename);

	const cleanup: string[] = [];

	try {
		if (request.presentation) {
			const presentation = request.presentation;
			const localVideo = await ensureLocalAsset(presentation.videoFile, jobId, 'source-video');
			if (localVideo !== presentation.videoFile) {
				cleanup.push(localVideo);
			}
			const localSvg = presentation.svgFile
				? await ensureLocalAsset(presentation.svgFile, jobId, 'overlay')
				: undefined;
			if (localSvg && localSvg !== presentation.svgFile) {
				cleanup.push(localSvg);
			}
			const localMusic = presentation.backgroundMusic
				? await ensureLocalAsset(presentation.backgroundMusic, jobId, 'background-music')
				: undefined;
			if (localMusic && localMusic !== presentation.backgroundMusic) {
				cleanup.push(localMusic);
			}

			await renderOcrPresentation({
				...presentation,
				videoFile: localVideo,
				svgFile: localSvg,
				backgroundMusic: localMusic ?? presentation.backgroundMusic,
				outPath: outputPath,
			});
		} else if (request.topic) {
			const draft = await generatePresentationDraft({
				topic: request.topic,
				durationSeconds: request.options?.duration ?? 600,
				notes: request.transcript,
			});

			const {content: presentationContent, tempFiles: draftTempFiles} = await buildPresentationFromDraft(
				draft,
				{
					videoFile: '',
				},
				request.options?.duration ?? 600
			);
			cleanup.push(...draftTempFiles);

			await renderPresentationContent({
				content: presentationContent,
				outPath: outputPath,
				fps: request.options?.fps,
				width: request.options?.width,
				height: request.options?.height,
				introDurationSeconds: 3,
				outroDurationSeconds: 3,
			});
		} else if (request.template && request.input) {
			const jobDir = join(config.paths.tempDir, jobId);
			if (!existsSync(jobDir)) {
				mkdirSync(jobDir, {recursive: true});
			}
			const templatePath = join(jobDir, 'template.json');
			const inputPath = join(jobDir, 'input.json');
			writeFileSync(templatePath, JSON.stringify(request.template, null, 2));
			writeFileSync(inputPath, JSON.stringify(request.input, null, 2));
			cleanup.push(templatePath, inputPath);

			await renderTemplateToMp4({
				templatePath,
				inputPath,
				outPath: outputPath,
				fps: request.options?.fps || 30,
				width: request.options?.width || 1920,
				height: request.options?.height || 1080,
				duration: request.options?.duration,
				lowResolution: request.options?.lowResolution || false,
			});
		} else {
			throw new Error('Request must include a topic, or template/input, or presentation payload.');
		}

		const remotePath = `videos/${jobId}/${outputFilename}`;
		const publicUrl = await storage.uploadFile(outputPath, remotePath);

		let transcriptUrl: string | undefined;
		if (request.transcript) {
			const transcriptFilename = `${jobId}-transcript.txt`;
			const transcriptPath = join(outputDir, transcriptFilename);
			writeFileSync(transcriptPath, request.transcript, 'utf-8');
			const transcriptRemotePath = `videos/${jobId}/${transcriptFilename}`;
			transcriptUrl = await storage.uploadFile(transcriptPath, transcriptRemotePath);
			if (existsSync(transcriptPath)) {
				unlinkSync(transcriptPath);
			}
		}

		return {
			videoUrl: publicUrl,
			transcriptUrl,
			jobId,
			remotePath,
		};
	} finally {
		if (existsSync(outputPath)) {
			unlinkSync(outputPath);
		}
		for (const asset of cleanup) {
			if (asset && existsSync(asset)) {
				try {
					unlinkSync(asset);
				} catch (error) {
					// ignore
				}
			}
		}
	}
}

