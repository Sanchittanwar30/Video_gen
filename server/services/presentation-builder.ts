import {promises as fs} from 'fs';
import path from 'path';
import os from 'os';
import {v4 as uuid} from 'uuid';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpeg = require('fluent-ffmpeg') as typeof import('fluent-ffmpeg');
import tesseract from 'node-tesseract-ocr';
import {synthesizeSpeechToFile, hasDeepgram} from './deepgram';
import type {
	ChapterSlide,
	ChapterTable,
	PresentationBuildRequest,
	PresentationBuildResult,
	PresentationContent,
	PresentationTheme,
	TableRow,
} from '../../src/types/presentation';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const DEFAULT_THEME: PresentationTheme = {
	primaryColor: '#2563eb',
	secondaryColor: '#7c3aed',
	backgroundColor: '#0f172a',
	accentColor: '#38bdf8',
	fontFamily: 'Inter, Arial, sans-serif',
};

const DEFAULT_FLOWCHART_PATH = path.join(__dirname, '../../assets/excalidraw-flowchart.svg');

interface FrameOcrResult {
	timeSeconds: number;
	text: string;
}

const OCR_OPTIONS = {
	lang: 'eng',
	oem: 1,
	psm: 3,
};

async function ensureTempDir(prefix: string): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
	return dir;
}

async function extractFrameAtTime(videoPath: string, seconds: number, outputDir: string): Promise<string> {
	const filename = `frame-${seconds.toFixed(2)}-${uuid()}.png`;
	const outputPath = path.join(outputDir, filename);

	await new Promise<void>((resolve, reject) => {
		ffmpeg(videoPath)
			.seekInput(seconds)
			.frames(1)
			.outputOptions(['-vf', 'scale=1280:-1'])
			.save(outputPath)
			.on('end', () => resolve())
			.on('error', (error: Error) => reject(error));
	});

	return outputPath;
}

async function runOcrOnImage(imagePath: string, language: string): Promise<string> {
	const config = {
		...OCR_OPTIONS,
		lang: language,
	};
	try {
		const text = await tesseract.recognize(imagePath, config);
		return text.replace(/\s+/g, ' ').trim();
	} catch (error) {
		console.warn(`OCR failed for ${imagePath}:`, error);
		return '';
	}
}

function chunkTextIntoSentences(text: string): string[] {
	return text
		.split(/(?<=[.?!])\s+/)
		.map((sentence) => sentence.replace(/\s+/g, ' ').trim())
		.filter((sentence) => sentence.length > 0);
}

function deriveBulletsFromSentences(sentences: string[]): string[] {
	if (sentences.length <= 4) {
		return sentences;
	}

	const grouped: string[] = [];
	let buffer = '';

	sentences.forEach((sentence, index) => {
		buffer = buffer ? `${buffer} ${sentence}` : sentence;
		if (buffer.length >= 120 || index === sentences.length - 1) {
			grouped.push(buffer.trim());
			buffer = '';
		}
	});

	return grouped.slice(0, 6);
}

function buildTableFromLines(lines: string[]): ChapterTable | undefined {
	const rows: TableRow[] = [];
	lines.forEach((line) => {
		const cleanLine = line.trim();
		if (!cleanLine) {
			return;
		}

		if (cleanLine.includes('|')) {
			const cells = cleanLine.split('|').map((value) => ({
				value: value.trim(),
			}));
			rows.push({cells});
			return;
		}

		if (cleanLine.includes(':')) {
			const [heading, value] = cleanLine.split(':');
			rows.push({
				cells: [
					{value: heading.trim(), isHeader: true},
					{value: value.trim()},
				],
			});
		}
	});

	return rows.length > 0
		? {
				rows,
				highlightedRowIndex: rows.length > 1 ? 1 : 0,
			}
		: undefined;
}

function deriveChapterSlides(
	frames: FrameOcrResult[],
	request: PresentationBuildRequest
): ChapterSlide[] {
	const chapters: ChapterSlide[] = [];

	if (request.chapterTimes && request.chapterTimes.length > 0) {
		request.chapterTimes.forEach((chapterTime, index) => {
			const relevantFrames = frames.filter(
				(frame) => frame.timeSeconds >= chapterTime.startSeconds && frame.timeSeconds <= chapterTime.endSeconds
			);
			const mergedText = relevantFrames.map((frame) => frame.text).join(' ');
			const sentences = chunkTextIntoSentences(mergedText);
			const bullets = deriveBulletsFromSentences(sentences);

			const table = buildTableFromLines(sentences.slice(0, 6));

			chapters.push({
				id: chapterTime.label || `chapter-${index + 1}`,
				title: chapterTime.label || `Chapter ${index + 1}`,
				summary: sentences[0] || `Key insights about ${chapterTime.label || `chapter ${index + 1}`}.`,
				bullets,
				startSeconds: chapterTime.startSeconds,
				endSeconds: chapterTime.endSeconds,
				table,
			});
		});
		return chapters;
	}

	// fallback: treat frames sequentially
	const sentences = chunkTextIntoSentences(frames.map((frame) => frame.text).join(' '));
	const bullets = deriveBulletsFromSentences(sentences);
	const durationPerChapter = Math.max(12, Math.round(bullets.length * 3));

	chapters.push({
		id: 'chapter-1',
		title: request.titleText || 'Overview',
		summary: sentences[0] || 'Automatic summary generated from OCR text.',
		bullets,
		startSeconds: 0,
		endSeconds: durationPerChapter,
		table: buildTableFromLines(sentences),
	});

	return chapters;
}

async function loadSvgMarkup(svgFile?: string): Promise<string | undefined> {
	if (!svgFile) {
		return undefined;
	}
	try {
		const content = await fs.readFile(svgFile, 'utf-8');
		return content;
	} catch (error) {
		console.warn('Failed to read SVG file:', svgFile, error);
		return undefined;
	}
}

export async function buildPresentationFromVideo(
	request: PresentationBuildRequest
): Promise<PresentationBuildResult> {
	const fps = request.frameRate ?? 30;
	const width = 1920;
	const height = 1080;
	const language = request.language || 'eng';

	const tempDir = await ensureTempDir('video-ocr-');
	const tempFiles: string[] = [];

	try {
		const sampleTimes =
			request.chapterTimes && request.chapterTimes.length > 0
				? request.chapterTimes.map((chapter) => (chapter.startSeconds + chapter.endSeconds) / 2)
				: [3, 8, 14, 20];

		const frames: FrameOcrResult[] = [];

		for (const time of sampleTimes) {
			const framePath = await extractFrameAtTime(request.videoFile, time, tempDir);
			tempFiles.push(framePath);
			const text = await runOcrOnImage(framePath, language);
			frames.push({timeSeconds: time, text});
		}

		const chapters = deriveChapterSlides(frames, request);
		const theme: PresentationTheme = {
			...DEFAULT_THEME,
			...(request.theme ?? {}),
		};

		const overlaySvg =
			(await loadSvgMarkup(request.svgFile)) ??
			(await loadSvgMarkup(DEFAULT_FLOWCHART_PATH));

		const content: PresentationContent = {
			titleText: request.titleText || 'Video Presentation',
			subtitleText: request.subtitleText || 'Automated highlight reel',
			introCaption: request.introCaption || 'Key ideas extracted from video',
			outroCaption: request.outroCaption || 'Thanks for watching',
			callToAction: request.callToAction || 'Share what you learned today!',
			chapters,
			flowchartSvg: overlaySvg,
			theme,
		};

		if (hasDeepgram()) {
			for (let index = 0; index < chapters.length; index++) {
				const chapter = chapters[index];
				const scriptParts = [chapter.title, chapter.summary, ...chapter.bullets];
				const script = scriptParts.join('. ').replace(/\s+/g, ' ').trim();
				if (!script) {
					continue;
				}

				try {
					const audioPath = path.join(tempDir, `chapter-${index + 1}-${uuid()}.mp3`);
					await synthesizeSpeechToFile(script, audioPath);
					console.log(`[PresentationBuilder] Voiceover generated for ${chapter.id} at ${audioPath}`);
					chapter.voiceoverSrc = audioPath;
					tempFiles.push(audioPath);
				} catch (error) {
					console.warn(`Failed to synthesize voiceover for chapter ${chapter.id}:`, error);
				}
			}
		}

		if (request.backgroundMusic) {
			content.backgroundMusic = path.isAbsolute(request.backgroundMusic)
				? request.backgroundMusic
				: request.backgroundMusic;
		}

		if (request.tableData && request.tableData.length > 0) {
			request.tableData.forEach((table, index) => {
				if (content.chapters[index]) {
					content.chapters[index].table = table;
				}
			});
		}

		const totalChapterSeconds = chapters.reduce(
			(sum, chapter) => sum + Math.max(6, chapter.endSeconds - chapter.startSeconds),
			0
		);
		const introSeconds = 4;
		const outroSeconds = 5;
		const durationInFrames = Math.floor((introSeconds + totalChapterSeconds + outroSeconds) * fps);

		return {
			content,
			durationInFrames,
			fps,
			width,
			height,
			tempFiles,
		};
	} finally {
		// cleanup is managed by caller if needed using tempFiles list
	}
}

