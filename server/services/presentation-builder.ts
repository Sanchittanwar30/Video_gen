import path from 'path';
import fs from 'fs/promises';
import {v4 as uuidv4} from 'uuid';
import type {
	PresentationBuildRequest,
	PresentationBuildResult,
	PresentationContent,
} from '../../src/types/presentation';
import {buildPresentationFromDraft, generatePresentationDraft} from './presentation-orchestrator';

export const buildPresentationFromVideo = async (
	request: PresentationBuildRequest
): Promise<PresentationBuildResult> => {
	const draft = await generatePresentationDraft({
		topic: request.titleText ?? 'Auto-generated lesson',
		durationSeconds: request.chapterTimes?.reduce(
			(sum, chapter) => sum + (chapter.endSeconds - chapter.startSeconds),
			0
		),
		backgroundMusic: request.backgroundMusic,
		notes: request.subtitleText,
	});

	const content = await buildPresentationFromDraft(draft);

	return {
		content,
		durationInFrames: Math.floor((content.chapters.at(-1)?.endSeconds ?? 60) * 30),
		fps: 30,
		width: 1920,
		height: 1080,
		tempFiles: [],
	};
};

export const buildPresentationFromDraftInput = async (
	content: PresentationContent
): Promise<PresentationBuildResult> => ({
	content,
	durationInFrames: Math.floor((content.chapters.at(-1)?.endSeconds ?? 60) * 30),
	fps: 30,
	width: 1920,
	height: 1080,
	tempFiles: [],
});

export const saveTempAudio = async (buffer: Buffer, label: string): Promise<string> => {
	const dir = await fs.mkdtemp(path.join(process.cwd(), 'audio-'));
	const filePath = path.join(dir, `${label}-${uuidv4()}.mp3`);
	await fs.writeFile(filePath, buffer);
	return filePath;
};

