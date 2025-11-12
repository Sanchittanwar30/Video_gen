const attachGeneratedTldrawSvg = (
	diagram: PresentationDiagram | undefined
): PresentationDiagram | undefined => {
	if (!diagram) return undefined;
	if (diagram.excalidrawSvg) return diagram;
	if (diagram.whiteboard?.tldrawSceneUrl) return diagram;

	const snapshot = buildTldrawScene(diagram);
	if (!snapshot) return diagram;

	const svg = convertTldrawSceneToSvg(snapshot, diagram.style);
	if (!svg) return diagram;

	return {
		...diagram,
		excalidrawSvg: svg,
	};
};

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import {parseBuffer} from 'music-metadata';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { callGemini, GeminiRequest } from './gemini';
import { synthesizeSpeech } from './deepgram';
import {STYLE_TOKENS} from '../../src/styleConfig';
import {buildTldrawScene, TldrawSnapshot} from '../utils/tldraw-generator';
import type {
	PresentationContent,
	PresentationTheme,
	ChapterSlide,
	ChapterMarker,
	PresentationDiagram,
	DiagramPointer,
	WhiteboardSvgHint,
	DiagramFocusEvent,
	WhiteboardStyle,
} from '../../src/types/presentation';

interface PresentationDraftRequest {
	topic: string;
	durationSeconds?: number;
	backgroundMusic?: string;
	notes?: string;
	language?: string;
}

interface PresentationDraftChapter {
	id: string;
	title: string;
	summary: string;
	keyIdeas: string[];
	durationSeconds?: number;
	table?: {
		title?: string;
		rows: string[][];
	};
	diagram?: PresentationDiagram;
	figure?: {
		caption?: string;
		assetUrl?: string;
	};
	voiceoverScript?: string;
	audioFile?: string;
	imagePrompts?: string[];
}

interface PresentationDraft {
	topic: string;
	introCaption: string;
	outroCaption: string;
	callToAction: string;
	backgroundMusic?: string;
	theme?: Partial<PresentationTheme>;
	chapters: PresentationDraftChapter[];
}

const DEFAULT_THEME: PresentationTheme = {
	primaryColor: '#1d4ed8',
	secondaryColor: '#1e293b',
	backgroundColor: '#0f172a',
	accentColor: '#60a5fa',
	fontFamily: 'Inter, sans-serif',
};

const ensureTheme = (theme?: Partial<PresentationTheme>): PresentationTheme => ({
	...DEFAULT_THEME,
	...theme,
});

const WHITEBOARD_CANVAS = {
	width: 960,
	height: 540,
};

const DEFAULT_WHITEBOARD_STROKE = '#0F172A';
const DEFAULT_WHITEBOARD_ACCENT = '#F97316';

const buildAutoWhiteboard = (
	chapter: PresentationDraftChapter,
	palette?: WhiteboardStyle
): {
	svgHints: WhiteboardSvgHint[];
	focusTargets: number[];
	pointer?: DiagramPointer;
} => {
	const hints: WhiteboardSvgHint[] = [];
	const focusTargets: number[] = [];
	const strokeColor = palette?.stroke ?? DEFAULT_WHITEBOARD_STROKE;
	const strokeWidth = palette?.strokeWidth ?? 3;
	const accentColor = palette?.accent ?? DEFAULT_WHITEBOARD_ACCENT;
	const pointerColor = palette?.pointerColor ?? accentColor;

	const pushHint = (hint: WhiteboardSvgHint) => {
		hints.push(hint);
		return hints.length - 1;
	};

	const titleY = 80;
	const leftBox = {x: 120, y: 140, w: 240, h: 130};
	const rightBox = {x: 520, y: 90, w: 240, h: 140};

	const leftRectIndex = pushHint({
		cmd: 'rect',
		x: leftBox.x,
		y: leftBox.y,
		w: leftBox.w,
		h: leftBox.h,
		style: {stroke: strokeColor, strokeWidth, fill: '#ffffff', opacity: 0.96},
	});

	const rightRectIndex = pushHint({
		cmd: 'rect',
		x: rightBox.x,
		y: rightBox.y,
		w: rightBox.w,
		h: rightBox.h,
		style: {stroke: strokeColor, strokeWidth, fill: '#ffffff', opacity: 0.96},
	});

	const heading = chapter.title ?? 'Key Concept';
	pushHint({
		cmd: 'text',
		x: Math.round(WHITEBOARD_CANVAS.width * 0.08),
		y: titleY,
		text: heading,
		style: {fontSize: 28, fontWeight: 700, fill: strokeColor},
	});

	const summaryLine = (chapter.summary ?? '').slice(0, 120);
	if (summaryLine) {
		pushHint({
			cmd: 'text',
			x: Math.round(WHITEBOARD_CANVAS.width * 0.08),
			y: titleY + 36,
			text: summaryLine,
			style: {fontSize: 18, fill: '#475569'},
		});
	}

	const keyIdeas = (chapter.keyIdeas ?? []).slice(0, 3);
	keyIdeas.forEach((idea, index) => {
		pushHint({
			cmd: 'text',
			x: leftBox.x + 22,
			y: leftBox.y + 48 + index * 28,
			text: `• ${idea}`,
			style: {fontSize: 18, fill: strokeColor},
		});
	});

	const rightSummaries =
		chapter.table?.rows?.slice(1).map((row) => row.join(' — ')) ?? chapter.imagePrompts ?? [];
	rightSummaries.slice(0, 3).forEach((line, index) => {
		pushHint({
			cmd: 'text',
			x: rightBox.x + 22,
			y: rightBox.y + 48 + index * 30,
			text: line,
			style: {fontSize: 18, fill: strokeColor},
		});
	});

	const connectorStart = {
		x: leftBox.x + leftBox.w,
		y: leftBox.y + leftBox.h / 2,
	};
	const connectorEnd = {
		x: rightBox.x,
		y: rightBox.y + rightBox.h / 2,
	};

	const moveIndex = pushHint({
		cmd: 'moveTo',
		x: connectorStart.x,
		y: connectorStart.y,
		style: {stroke: accentColor, strokeWidth: strokeWidth + 1},
	});

	const lineIndex = pushHint({
		cmd: 'lineTo',
		x: connectorEnd.x,
		y: connectorEnd.y,
		style: {stroke: accentColor, strokeWidth: strokeWidth + 1},
	});

	focusTargets.push(leftRectIndex, rightRectIndex, lineIndex);

	const pointer: DiagramPointer = {
		mode: 'trace',
		durationSeconds: 0.9,
		points: [
			{x: connectorStart.x, y: connectorStart.y},
			{x: connectorEnd.x, y: connectorEnd.y},
		],
		color: pointerColor,
	};

	return {
		svgHints: hints,
		focusTargets,
		pointer,
	};
};

const applyFocusTimeline = (
	existing: PresentationDiagram['focusEvents'],
	targets: number[],
	durationSeconds: number
): DiagramFocusEvent[] => {
	const focusEvents = Array.isArray(existing) ? existing.filter(Boolean) : [];
	if (focusEvents.length) {
		return focusEvents.map((event, index) => ({
			...event,
			time:
				event.time && Number.isFinite(event.time)
					? Math.max(0.2, Math.min(durationSeconds - 0.6, event.time))
					: Math.min(
							durationSeconds - 0.6,
							((index + 1) * durationSeconds) / (focusEvents.length + 1)
					  ),
		}));
	}

	if (!targets.length) {
		return focusEvents;
	}

	const safeDuration = Math.max(2.4, durationSeconds);
	const step = Math.max(1, safeDuration / (targets.length + 1));
	return targets.map((cmdIndex, index) => ({
		time: Math.min(safeDuration - 0.6, step * (index + 1)),
		action: index === targets.length - 1 ? 'trace' : 'point',
		target: {cmdIndex},
	}));
};

const fetchExternalWhiteboardSvg = async (url: string): Promise<string | undefined> => {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status} ${response.statusText}`);
		}
		const contentType = response.headers.get('content-type') ?? '';
		if (
			contentType.includes('image/svg') ||
			contentType.includes('text/plain') ||
			contentType === ''
		) {
			return await response.text();
		}
		console.warn(`Unsupported content-type for whiteboard overlay (${contentType})`);
		return undefined;
	} catch (error) {
		console.warn(`Failed to fetch whiteboard overlay from ${url}:`, error);
		return undefined;
	}
};

const fetchTldrawScene = async (url: string): Promise<Record<string, unknown> | undefined> => {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status} ${response.statusText}`);
		}
		return (await response.json()) as Record<string, unknown>;
	} catch (error) {
		console.warn(`Failed to fetch TLDraw scene from ${url}:`, error);
		return undefined;
	}
};

const convertTldrawSceneToSvg = (
	scene: TldrawSnapshot | {records?: Record<string, unknown>; shapes?: Record<string, unknown>},
	palette?: WhiteboardStyle
): string | undefined => {
	const shapes: Array<Record<string, any>> = [];
	const stroke = palette?.stroke ?? DEFAULT_WHITEBOARD_STROKE;
	const strokeWidth = palette?.strokeWidth ?? 2.5;
	const accent = palette?.accent ?? DEFAULT_WHITEBOARD_ACCENT;
	const pointerColor = palette?.pointerColor ?? accent;

	const isShapeRecord = (record: any) =>
		record && typeof record === 'object' && record.typeName === 'shape';

	const records = 'records' in scene ? scene.records : undefined;
	if (records && typeof records === 'object') {
		for (const value of Object.values(records)) {
			if (isShapeRecord(value)) {
				shapes.push(value as Record<string, any>);
			}
		}
	}

	const sceneShapes = 'shapes' in scene ? scene.shapes : undefined;
	if (!shapes.length && sceneShapes && typeof sceneShapes === 'object') {
		for (const value of Object.values(sceneShapes as Record<string, unknown>)) {
			if (value && typeof value === 'object') {
				shapes.push(value as Record<string, any>);
			}
		}
	}

	if (!shapes.length) {
		console.warn('TLDraw converter found no shapes.');
		return undefined;
	}

	const elements: string[] = [];
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	const toNumber = (value: unknown, fallback = 0) =>
		typeof value === 'number' && !Number.isNaN(value) ? value : fallback;

	const pushBounds = (x: number, y: number) => {
		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x);
		maxY = Math.max(maxY, y);
	};

	const renderGeo = (shape: any) => {
		const {props = {}} = shape;
		const x = toNumber(shape.x);
		const y = toNumber(shape.y);
		const w = toNumber(props.w, 120);
		const h = toNumber(props.h, 80);
		const geo = props.geo ?? 'rectangle';
		const fill =
			props.fill && props.fill !== 'none'
				? props.fill === 'solid'
					? accent
					: props.fill
				: 'none';
		pushBounds(x, y);
		pushBounds(x + w, y + h);
		if (geo === 'ellipse') {
			return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
		}
		if (geo === 'diamond') {
			const points = [
				[ x + w / 2, y ],
				[ x + w, y + h / 2 ],
				[ x + w / 2, y + h ],
				[ x, y + h / 2 ],
			]
				.map((pair) => pair.join(','))
				.join(' ');
			return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
		}
		const radius = toNumber(props.radius, 12);
		return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
	};

	const renderDraw = (shape: any) => {
		const baseX = toNumber(shape.x);
		const baseY = toNumber(shape.y);
		const points = Array.isArray(shape?.props?.points) ? shape.props.points : [];
		if (!points.length) {
			return undefined;
		}
		const d = points
			.map((point: any, idx: number) => {
				const px = baseX + toNumber(point.x);
				const py = baseY + toNumber(point.y);
				pushBounds(px, py);
				return `${idx === 0 ? 'M' : 'L'} ${px} ${py}`;
			})
			.join(' ');
		return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`;
	};

	const renderArrow = (shape: any) => {
		const baseX = toNumber(shape.x);
		const baseY = toNumber(shape.y);
		const {props = {}} = shape;
		const start = props.start ?? props.startPoint ?? {x: 0, y: 0};
		const end = props.end ?? props.endPoint ?? {x: 80, y: 0};
		const x1 = baseX + toNumber(start.x);
		const y1 = baseY + toNumber(start.y);
		const x2 = baseX + toNumber(end.x);
		const y2 = baseY + toNumber(end.y);
		pushBounds(x1, y1);
		pushBounds(x2, y2);
		return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${pointerColor}" stroke-width="${strokeWidth}" marker-end="url(#tldraw-arrow-head)" />`;
	};

	shapes.forEach((shape) => {
		const type = shape.type ?? shape.props?.geo ?? shape.props?.type;
		let element: string | undefined;
		if (type === 'draw' || type === 'free_draw') {
			element = renderDraw(shape);
		} else if (type === 'arrow') {
			element = renderArrow(shape);
		} else {
			element = renderGeo(shape);
		}
		if (element) {
			elements.push(element);
		}
	});

	if (!elements.length) {
		return undefined;
	}

	const pad = 80;
	const width = Math.max(WHITEBOARD_CANVAS.width, maxX - minX + pad * 2);
	const height = Math.max(WHITEBOARD_CANVAS.height, maxY - minY + pad * 2);
	const offsetX = minX - pad;
	const offsetY = minY - pad;

	const defs = `<defs>
<marker id="tldraw-arrow-head" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
  <path d="M 0 0 L 12 6 L 0 12 z" fill="${pointerColor}" />
</marker>
</defs>`;

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${offsetX} ${offsetY} ${width} ${height}">
${defs}
${elements.join('\n')}
</svg>`;
};

const enrichWhiteboardDiagram = (
	diagram: PresentationDiagram | undefined,
	chapter: PresentationDraftChapter,
	durationSeconds: number
): PresentationDiagram | undefined => {
	if (!diagram) {
		return undefined;
	}

	const visualType = diagram.visualType ?? diagram.type;
	if (visualType !== 'whiteboard') {
		return {
			...diagram,
			visualType,
		};
	}

	const result: PresentationDiagram = {
		...diagram,
		visualType: 'whiteboard',
	};

	let autoAssets:
		| ReturnType<typeof buildAutoWhiteboard>
		| undefined;

	if (!Array.isArray(result.svgHints) || result.svgHints.length === 0) {
		autoAssets = buildAutoWhiteboard(chapter, result.style);
		if (autoAssets.svgHints && autoAssets.svgHints.length) {
			result.svgHints = autoAssets.svgHints;
		}
	}

	const generatedTargets = autoAssets?.focusTargets ?? [];
	result.focusEvents = applyFocusTimeline(result.focusEvents, generatedTargets, durationSeconds);

	if (!result.pointer && autoAssets?.pointer) {
		result.pointer = autoAssets.pointer;
	}

	return result;
};

const getPointerPauseSeconds = (diagram?: PresentationDiagram): number => {
	if (!diagram?.pointer) {
		return 0;
	}

	if (typeof diagram.pointer.durationSeconds === 'number') {
		return Math.max(0.4, Math.min(1.6, diagram.pointer.durationSeconds));
	}

	if (Array.isArray(diagram.focusEvents) && diagram.focusEvents.length) {
		return 0.8;
	}

	return 0.6;
};

const estimateWhiteboardDrawSeconds = (diagram?: PresentationDiagram): number => {
	if (!diagram || (diagram.visualType ?? diagram.type) !== 'whiteboard') {
		return 0;
	}
	const hintCount = diagram.svgHints?.length ?? 0;
	if (hintCount === 0) {
		return 3;
	}
	return Math.min(12, Math.max(2.5, hintCount * 0.45));
};
if (typeof ffmpegStatic === 'string') {
	ffmpeg.setFfmpegPath(ffmpegStatic);
}
const AUDIO_PADDING_SECONDS = 0.4;
const MIN_CHAPTER_SECONDS = 5;

interface AudioAsset {
	src: string;
	durationSeconds?: number;
}

const trimAudioBuffer = async (buffer: Buffer, maxSeconds?: number): Promise<Buffer> => {
	if (!maxSeconds || !Number.isFinite(maxSeconds) || maxSeconds <= 0) {
		return buffer;
	}

	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-trim-'));
	const inputPath = path.join(tmpDir, 'input.mp3');
	const outputPath = path.join(tmpDir, 'output.mp3');

	try {
		await fs.writeFile(inputPath, buffer);

		await new Promise<void>((resolve, reject) => {
			ffmpeg(inputPath)
				.duration(maxSeconds)
				.format('mp3')
				.output(outputPath)
				.on('end', () => resolve())
				.on('error', (error: unknown) => reject(error))
				.run();
		});

		const trimmed = await fs.readFile(outputPath);
		return trimmed;
	} catch (error) {
		console.warn('Failed to trim audio buffer:', error instanceof Error ? error.message : error);
		return buffer;
	} finally {
		await fs
			.rm(tmpDir, {recursive: true, force: true})
			.catch(() => undefined);
	}
};

const bufferToDataUrl = (buffer: Buffer, mimeType: string) =>
	`data:${mimeType};base64,${buffer.toString('base64')}`;

const getAudioDurationFromBuffer = async (
	buffer: Buffer,
	mimeType = 'audio/mpeg'
): Promise<number | undefined> => {
	try {
		const metadata = await parseBuffer(buffer, {mimeType});
		return metadata.format.duration ?? undefined;
	} catch (error) {
		console.warn('Failed to parse audio duration:', error instanceof Error ? error.message : error);
		return undefined;
	}
};

const resolveAudioAsset = async (
	source: string,
	maxDurationSeconds?: number
): Promise<AudioAsset | undefined> => {
	try {
		if (source.startsWith('data:')) {
			const match = source.match(/^data:(.+?);base64,(.+)$/);
			if (!match) {
				return {src: source};
			}
			const [, mime, base64] = match;
			const buffer = Buffer.from(base64, 'base64');
			const trimmed = await trimAudioBuffer(buffer, maxDurationSeconds);
			const durationSeconds = await getAudioDurationFromBuffer(trimmed, mime);
			return {
				src: bufferToDataUrl(trimmed, mime),
				durationSeconds,
			};
		}

		if (source.startsWith('http://') || source.startsWith('https://')) {
			const response = await fetch(source);
			if (!response.ok) {
				throw new Error(`Failed to fetch audio source ${source}: ${response.status} ${response.statusText}`);
			}
			const arrayBuffer = await response.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			const mimeType = response.headers.get('content-type') ?? 'audio/mpeg';
			const trimmed = await trimAudioBuffer(buffer, maxDurationSeconds);
			const durationSeconds = await getAudioDurationFromBuffer(trimmed, mimeType);
			return {
				src: bufferToDataUrl(trimmed, mimeType),
				durationSeconds,
			};
		}

		const absolutePath = path.isAbsolute(source) ? source : path.join(process.cwd(), source);
		const buffer = await fs.readFile(absolutePath);
		const trimmed = await trimAudioBuffer(buffer, maxDurationSeconds);
		const durationSeconds = await getAudioDurationFromBuffer(trimmed);
		return {
			src: bufferToDataUrl(trimmed, 'audio/mpeg'),
			durationSeconds,
		};
	} catch (error) {
		console.warn(`Unable to resolve audio asset "${source}":`, error instanceof Error ? error.message : error);
		return {src: source};
	}
};

const ensureChapterMarkers = (chapter: PresentationDraftChapter): ChapterMarker[] => {
	const markers: ChapterMarker[] = [];

	if (chapter.table) {
		markers.push({
			type: 'table',
			title: chapter.table.title,
			rows: chapter.table.rows,
		});
	}

	if (chapter.diagram) {
		const diagramType = chapter.diagram.visualType ?? chapter.diagram.type;
		markers.push({
			type: 'diagram',
			concept: chapter.diagram.notes ?? diagramType ?? chapter.title,
			description:
				diagramType === 'whiteboard'
					? chapter.diagram.whiteboard?.callouts?.join(' • ')
					: diagramType === 'erd'
					? chapter.diagram.entities
							?.map((entity) => entity.title)
							.join(' ↔ ')
					: (diagramType === 'mermaid' || Boolean(chapter.diagram.mermaid))
					? 'Mermaid diagram included'
					: undefined,
		});
	}

	if (chapter.figure?.caption) {
		markers.push({
			type: 'figure',
			caption: chapter.figure.caption,
			assetUrl: chapter.figure.assetUrl,
		});
	}

	return markers;
};

export const generatePresentationDraft = async (
	request: PresentationDraftRequest
): Promise<PresentationDraft> => {
const ensureDuration = (
	chapters: PresentationDraftChapter[],
	totalDurationSeconds = 60
): PresentationDraftChapter[] => {
	const minimumChapterDuration = 5;
	const specifiedTotal = chapters.reduce(
		(sum, chapter) => sum + (chapter.durationSeconds ?? 0),
		0
	);

	if (specifiedTotal > 0) {
		return chapters.map((chapter) => ({
			...chapter,
			durationSeconds:
				chapter.durationSeconds ?? Math.max(minimumChapterDuration, totalDurationSeconds / chapters.length),
		}));
	}

	const evenlyDistributed = totalDurationSeconds / chapters.length;
	return chapters.map((chapter) => ({
		...chapter,
		durationSeconds: Math.max(minimumChapterDuration, evenlyDistributed),
	}));
};

const generateFallbackDraft = (request: PresentationDraftRequest): PresentationDraft => {
	const {topic, durationSeconds = 60, notes} = request;
	const lowerTopic = topic.toLowerCase();
	const isOopTopic =
		lowerTopic.includes('object-oriented') ||
		lowerTopic.includes('object oriented') ||
		lowerTopic.includes('oop');

	if (isOopTopic) {
		const oopChapters: Array<Omit<PresentationDraftChapter, 'id'>> = [
			{
				title: 'Blueprint vs. Instance',
				summary: 'Classes define blueprints; objects are concrete instances with state.',
				keyIdeas: [
					'Class describes members & methods',
					'Objects hold unique data in memory',
					'Constructors hydrate and validate state',
				],
				durationSeconds: 7,
				diagram: {
					type: 'whiteboard',
					visualType: 'whiteboard',
					style: {
						background: '#0f172a',
						stroke: '#e2e8f0',
						accent: '#38bdf8',
						pointerColor: '#f97316',
						strokeWidth: 3,
					},
					svgHints: [
						{cmd: 'rect', x: 150, y: 150, w: 200, h: 110, style: {stroke: '#38bdf8', strokeWidth: 3, fill: 'rgba(56,189,248,0.1)'}},
						{cmd: 'text', x: 168, y: 186, text: 'class Car', style: {fontSize: 24}},
						{cmd: 'rect', x: 470, y: 150, w: 200, h: 110, style: {stroke: '#38bdf8', strokeWidth: 3, fill: 'rgba(56,189,248,0.1)'}},
						{cmd: 'text', x: 488, y: 186, text: 'Car sportsCar', style: {fontSize: 20}},
						{cmd: 'moveTo', x: 350, y: 205},
						{cmd: 'lineTo', x: 470, y: 205},
					],
					focusEvents: [
						{time: 1.0, action: 'point', target: {cmdIndex: 0}},
						{time: 2.4, action: 'point', target: {cmdIndex: 2}},
						{time: 3.6, action: 'trace', target: {cmdIndex: 4}},
					],
					pointer: {
						mode: 'trace',
						points: [
							{x: 350, y: 205},
							{x: 470, y: 205},
						],
						durationSeconds: 0.8,
					},
					whiteboard: {
						background: 'dot',
						callouts: ['Class blueprint', 'Object instance'],
					},
				},
			},
			{
				title: 'Encapsulation Guardrails',
				summary: 'Expose intention via public APIs while hiding implementation details.',
				keyIdeas: [
					'Private data keeps invariants safe',
					'Public methods validate inputs',
					'Use friend sparingly',
				],
				durationSeconds: 7,
				diagram: {
					type: 'whiteboard',
					visualType: 'whiteboard',
					style: {
						background: '#0b1220',
						stroke: '#e5e9ff',
						accent: '#ffb74d',
						pointerColor: '#ffb74d',
					},
					svgHints: [
						{cmd: 'rect', x: 140, y: 160, w: 220, h: 130, style: {stroke: '#ffb74d', strokeWidth: 3, fill: 'rgba(255,183,77,0.12)'}},
						{cmd: 'text', x: 158, y: 198, text: 'class BankAccount', style: {fontSize: 22}},
						{cmd: 'rect', x: 470, y: 170, w: 230, h: 110, style: {stroke: '#ffb74d', strokeWidth: 3, fill: 'rgba(255,183,77,0.12)'}},
						{cmd: 'text', x: 488, y: 208, text: 'public deposit()', style: {fontSize: 20}},
						{cmd: 'moveTo', x: 360, y: 220},
						{cmd: 'lineTo', x: 470, y: 220},
					],
					focusEvents: [
						{time: 1.0, action: 'point', target: {cmdIndex: 0}},
						{time: 2.6, action: 'trace', target: {cmdIndex: 4}},
					],
					pointer: {
						mode: 'trace',
						points: [
							{x: 360, y: 220},
							{x: 470, y: 220},
						],
						durationSeconds: 0.8,
					},
					whiteboard: {
						background: 'grid',
						callouts: ['Hide data', 'Expose intention'],
					},
				},
			},
			{
				title: 'Inheritance Hierarchies',
				summary: 'Reuse behavior via base classes but keep trees shallow.',
				keyIdeas: [
					'Base class exposes shared API',
					'Derived types override specifics',
					'Prefer composition beyond two levels',
				],
				durationSeconds: 7,
				diagram: {
					type: 'whiteboard',
					visualType: 'whiteboard',
					style: {
						background: '#111827',
						stroke: '#cbd5f5',
						accent: '#34d399',
					},
					svgHints: [
						{cmd: 'text', x: 220, y: 160, text: 'Vehicle', style: {fontSize: 26}},
						{cmd: 'moveTo', x: 240, y: 170},
						{cmd: 'lineTo', x: 240, y: 230},
						{cmd: 'text', x: 150, y: 270, text: 'Car', style: {fontSize: 20}},
						{cmd: 'text', x: 320, y: 270, text: 'Truck', style: {fontSize: 20}},
						{cmd: 'moveTo', x: 240, y: 230},
						{cmd: 'lineTo', x: 160, y: 250},
						{cmd: 'moveTo', x: 240, y: 230},
						{cmd: 'lineTo', x: 320, y: 250},
					],
					focusEvents: [
						{time: 0.8, action: 'point', target: {cmdIndex: 0}},
						{time: 2.0, action: 'trace', target: {cmdIndex: 1}},
					],
					pointer: {
						mode: 'trace',
						points: [
							{x: 240, y: 170},
							{x: 240, y: 230},
						],
						durationSeconds: 0.9,
					},
					whiteboard: {
						background: 'dot',
						callouts: ['Common base', 'Specialized leaves'],
					},
				},
			},
			{
				title: 'Polymorphism in Action',
				summary: 'Late binding lets base pointers call the right override at runtime.',
				keyIdeas: [
					'virtual enables dynamic dispatch',
					'override signals intent',
					'Use base pointers to store families',
				],
				durationSeconds: 7,
				diagram: {
					type: 'whiteboard',
					visualType: 'whiteboard',
					svgHints: [
						{cmd: 'text', x: 160, y: 190, text: 'Shape* s = new Circle();', style: {fontSize: 22}},
						{cmd: 'text', x: 160, y: 220, text: 's->draw();', style: {fontSize: 22}},
						{cmd: 'moveTo', x: 360, y: 205},
						{cmd: 'lineTo', x: 520, y: 205},
					],
					focusEvents: [
						{time: 1.0, action: 'point', target: {cmdIndex: 0}},
						{time: 2.4, action: 'trace', target: {cmdIndex: 2}},
					],
					pointer: {
						mode: 'trace',
						points: [
							{x: 360, y: 205},
							{x: 520, y: 205},
						],
						durationSeconds: 0.7,
					},
					whiteboard: {
						background: 'grid',
						callouts: ['Late binding'],
					},
				},
			},
			{
				title: 'Composition & Interfaces',
				summary: 'Favor composition with interfaces to extend behaviour flexibly.',
				keyIdeas: [
					'Compose services to share responsibility',
					'Abstract base classes define contracts',
					'Dependency injection simplifies testing',
				],
				durationSeconds: 7,
				diagram: {
					type: 'whiteboard',
					visualType: 'whiteboard',
					style: {
						background: '#101b2e',
						stroke: '#f1f5f9',
						accent: '#f97316',
						pointerColor: '#f97316',
					},
					whiteboard: {
						background: 'grid',
						tldrawSceneUrl: 'https://assets.example.com/scenes/oop-composition.json',
						callouts: ['Compose & delegate'],
					},
					svgHints: [
						{cmd: 'rect', x: 150, y: 200, w: 180, h: 100, style: {fill: 'rgba(249,115,22,0.08)', stroke: '#f97316', strokeWidth: 3}},
						{cmd: 'text', x: 168, y: 240, text: 'Renderer', style: {fontSize: 20}},
						{cmd: 'rect', x: 440, y: 170, w: 210, h: 90, style: {fill: 'rgba(249,115,22,0.08)', stroke: '#f97316', strokeWidth: 3}},
						{cmd: 'text', x: 460, y: 210, text: 'ILogger', style: {fontSize: 18}},
						{cmd: 'moveTo', x: 330, y: 230},
						{cmd: 'lineTo', x: 440, y: 210},
					],
					focusEvents: [
						{time: 1.2, action: 'point', target: {cmdIndex: 0}},
						{time: 2.6, action: 'trace', target: {cmdIndex: 4}},
					],
					pointer: {
						mode: 'trace',
						points: [
							{x: 330, y: 230},
							{x: 440, y: 210},
						],
						durationSeconds: 0.8,
					},
				},
			},
		];

		const oopChaptersWithIds = ensureDuration(
			oopChapters.map((chapter, index) => ({
				id: uuidv4(),
				...chapter,
				figure: chapter.figure ?? {
					caption: `OOP concept ${index + 1}`,
				},
			})),
			durationSeconds
		);

		return {
			topic,
			introCaption: 'A visual tour of OOP pillars in C++',
			outroCaption: 'Practice these patterns to build resilient C++.',
			callToAction: 'Share this OOP refresher with your team.',
			backgroundMusic: request.backgroundMusic,
			theme: {
				primaryColor: '#1e1b4b',
				secondaryColor: '#0f172a',
				accentColor: '#38bdf8',
			},
			chapters: oopChaptersWithIds,
		};
	}

	const genericIdeas: Array<Omit<PresentationDraftChapter, 'id'>> = [
		{
			title: `Why ${topic} Matters`,
			summary: `Understand the core relevance of ${topic} in modern workflows.`,
			keyIdeas: [
				`${topic} unlocks new problem-solving techniques.`,
				`Real-world case studies show measurable impact.`,
				`Adopting ${topic} shifts how teams collaborate.`,
			],
			voiceoverScript: `Let's explore why ${topic} matters and how it reshapes day-to-day work.`,
			diagram: {
				type: 'whiteboard',
				visualType: 'whiteboard',
				whiteboard: {
					background: 'grid',
					callouts: ['Vision', 'Plan', 'Launch'],
				},
				svgHints: [
					{cmd: 'text', x: 160, y: 190, text: 'Vision → Plan → Launch', style: {fontSize: 26}},
				],
			},
		},
		{
			title: `${topic} Building Blocks`,
			summary: `Explore core components and how they connect${notes ? `, considering ${notes}` : ''}.`,
			keyIdeas: [
				`Start with fundamental definitions.`,
				`Relate concepts using analogies.`,
				`Spot the patterns that repeat across scenarios.`,
			],
			diagram: {
				type: 'mermaid',
				visualType: 'mermaid',
				mermaid: `graph TD
  Start[Introduce ${topic}] --> Build{Explore components}
  Build --> Apply[Relate to examples]
  Apply --> Reflect[Capture learnings]`,
			},
		},
		{
			title: `Putting ${topic} Into Practice`,
			summary: `Translate ideas into hands-on implementation steps.`,
			keyIdeas: [
				`Plan your workflow before execution.`,
				`Monitor each milestone against objectives.`,
				`Celebrate quick wins to maintain momentum.`,
			],
			table: {
				title: 'Action Plan',
				rows: [
					['Phase', 'Focus', 'Success Metric'],
					['Plan', 'Define scope', 'Clear problem statement'],
					['Execute', 'Iterate quickly', 'Working prototype'],
					['Review', 'Gather feedback', 'Validated learnings'],
				],
			},
			diagram: {
				type: 'erd',
				visualType: 'erd',
				entities: [
					{id: 'plan', title: 'Planning', fields: ['Scope', 'Stakeholders']},
					{id: 'run', title: 'Execution', fields: ['Build', 'Measure']},
					{id: 'iterate', title: 'Improve', fields: ['Feedback', 'Lessons']},
				],
				relationships: [
					{from: 'plan', to: 'run', label: 'guides'},
					{from: 'run', to: 'iterate', label: 'feeds'},
				],
			},
		},
	];

	const genericChapters = ensureDuration(
		genericIdeas.map((idea, index) => ({
			id: uuidv4(),
			...idea,
			figure: idea.figure ?? {
				caption: `${topic} concept visualization ${index + 1}`,
			},
		})),
		durationSeconds
	);

	return {
		topic,
		introCaption: `Today we explore ${topic}`,
		outroCaption: 'Thanks for learning with us',
		callToAction: 'Subscribe for more bite-sized lessons!',
		backgroundMusic: request.backgroundMusic,
		theme: {
			primaryColor: '#312e81',
			secondaryColor: '#1e1b4b',
			accentColor: '#38bdf8',
		},
		chapters: genericChapters,
	};
};

	const prompt: GeminiRequest = {
		model: 'gemini-2.5-flash',
		contents: [
			{
				role: 'user',
				parts: [
					{
						text: `You are an expert instructional designer and storyboard artist. Create a richly visual lesson outline about "${request.topic}" for general learners.
Additional guidance (optional): ${request.notes ?? 'N/A'}.

Return ONLY JSON matching this TypeScript shape (no Markdown, no commentary):
{
  "topic": string;
  "introCaption": string;
  "outroCaption": string;
  "callToAction": string;
  "backgroundMusic"?: string;
  "theme"?: {
    "primaryColor"?: string;
    "secondaryColor"?: string;
    "backgroundColor"?: string;
    "accentColor"?: string;
    "fontFamily"?: string;
  };
  "chapters": Array<{
    "id"?: string;
    "title": string;
    "summary": string;
    "keyIdeas": string[];
    "durationSeconds"?: number;
    "table"?: {
      "title"?: string;
      "rows": string[][];
    };
    "diagram"?: {
      "type": "mermaid" | "erd" | "whiteboard";
      "visualType"?: "mermaid" | "erd" | "whiteboard" | "svg" | "image";
      "notes"?: string;
      "mermaid"?: string;
      "entities"?: Array<{
        "id": string;
        "title": string;
        "fields"?: string[];
        "description"?: string;
      }>;
      "relationships"?: Array<{
        "from": string;
        "to": string;
        "label"?: string;
        "fromAnchor"?: "center" | "top" | "bottom" | "left" | "right";
        "toAnchor"?: "center" | "top" | "bottom" | "left" | "right";
      }>;
      "pointer"?: {
        "mode": "tap" | "point" | "trace";
        "target"?: string;
        "anchor"?: "center" | "top" | "bottom" | "left" | "right";
        "durationSeconds"?: number;
        "points"?: Array<{ "x": number; "y": number; }>;
      };
      "whiteboard"?: {
        "background"?: "grid" | "dot" | "plain";
        "layers"?: Array<{ "title": string; "items": string[]; }>;
        "callouts"?: string[];
        "externalSvgUrl"?: string;
        "tldrawSceneUrl"?: string;
        "accentColor"?: string;
      };
      "svgHints"?: Array<{
        "cmd": "moveTo" | "lineTo" | "rect" | "circle" | "text" | "arc" | "bezier";
        "x"?: number;
        "y"?: number;
        "w"?: number;
        "h"?: number;
        "width"?: number;
        "height"?: number;
        "cx"?: number;
        "cy"?: number;
        "r"?: number;
        "rx"?: number;
        "ry"?: number;
        "rotation"?: number;
        "largeArc"?: boolean;
        "sweep"?: number;
        "text"?: string;
        "points"?: Array<{ "x": number; "y": number; }>;
        "style"?: Record<string, unknown>;
      }>;
      "focusEvents"?: Array<{
        "time": number;
        "action": "point" | "tap" | "trace";
        "target": { "cmdIndex"?: number; "x"?: number; "y"?: number; };
      }>;
      "imagePrompts"?: string[];
      "excalidrawSvg"?: string;
    };
    "figure"?: {
      "caption"?: string;
      "assetUrl"?: string;
    };
    "voiceoverScript"?: string;
    "audioFile"?: string;
    "imagePrompts"?: string[];
  }>;
}

Storytelling requirements:
- Produce between 3 and 6 chapters for ~${request.durationSeconds ?? 60} total seconds (5-8 seconds each).
- Each chapter must have 3-5 concise keyIdeas.
- At least one chapter must provide a Mermaid diagram ("diagram.type":"mermaid") with valid syntax for Mermaid v10.
- At least one chapter must provide an ERD-style diagram with entities + relationships.
- Use whiteboard-style diagrams to break down processes: set both "diagram.type":"whiteboard" and "diagram.visualType":"whiteboard", and include "svgHints" (stroke commands) plus at least 2 "focusEvents" that reference cmdIndex targets. When you already have a TLDraw canvas, provide "diagram.whiteboard.tldrawSceneUrl" (public TLDraw JSON) so we can render the exact sketch. For pre-rendered art, continue using "diagram.whiteboard.externalSvgUrl" or embed "diagram.excalidrawSvg".
- Pointer instructions and focusEvents should highlight key focus areas (tap for emphasis, trace for path explanations) with durationSeconds between 0.6 and 1.0 when pointer.mode is provided.
- When using "pointer", specify "anchor" (left/right/top/bottom/center) and an explicit "durationSeconds" between 0.6 and 1.0.
- When whiteboard scenes benefit from richer sketches, embed optional "diagram.excalidrawSvg" (exported SVG markup from Excalidraw/TLDraw) alongside the svgHints.
- Provide an engaging voiceoverScript per chapter (1-2 sentences, friendly tone) but do not assume TTS—audioFile should only be set when a real file path is known.
- If generating image prompts, list 1-2 short descriptive prompts tailored for diffusion models (optional).
- DO NOT wrap the JSON in backticks or include extra text.`,
					},
				],
			},
		],
		safetySettings: [
			{
				category: 'HARM_CATEGORY_HARASSMENT',
				threshold: 'BLOCK_ONLY_HIGH',
			},
			{
				category: 'HARM_CATEGORY_HATE_SPEECH',
				threshold: 'BLOCK_ONLY_HIGH',
			},
			{
				category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
				threshold: 'BLOCK_ONLY_HIGH',
			},
			{
				category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
				threshold: 'BLOCK_ONLY_HIGH',
			},
		],
	};

	try {
		const response = await callGemini<PresentationDraft>(prompt, 4);

		const draft: PresentationDraft = {
			...response,
			topic: response.topic ?? request.topic,
			introCaption: response.introCaption ?? `Today we explore ${request.topic}`,
			outroCaption: response.outroCaption ?? 'Thanks for learning with us',
			callToAction:
				response.callToAction ?? 'Subscribe for more bite-sized lessons!',
			backgroundMusic: response.backgroundMusic ?? request.backgroundMusic,
			theme: response.theme ?? {},
			chapters: response.chapters?.length ? response.chapters : [],
		};

		if (!draft.chapters.length) {
			throw new Error('Gemini returned an empty chapter list');
		}

		return {
			...draft,
			chapters: ensureDuration(draft.chapters, request.durationSeconds),
		};
	} catch (error) {
		console.warn('Falling back to heuristic draft due to Gemini error:', error);
		return generateFallbackDraft(request);
	}
};

const USE_TTS =
	(process.env.USE_TTS ?? process.env.ENABLE_TTS ?? '').toLowerCase() === 'true';
const USE_HF = (process.env.USE_HF ?? '').toLowerCase() === 'true';
const HF_IMAGE_MODEL =
	process.env.HF_IMAGE_MODEL ?? 'stabilityai/stable-diffusion-xl-base-1.0';
const HF_IMAGE_API_URL =
	process.env.HF_IMAGE_API_URL ??
	`https://api-inference.huggingface.co/models/${HF_IMAGE_MODEL}`;
const HF_API_TOKEN = process.env.HF_API_TOKEN;

const ensureVoiceover = async (
	chapter: PresentationDraftChapter,
	maxDurationSeconds?: number
): Promise<AudioAsset | undefined> => {
	try {
		const audioBuffer = await synthesizeSpeech({
			text: `${chapter.summary}. ${chapter.keyIdeas.join('. ')}`,
		});
		const trimmedBuffer =
			maxDurationSeconds && Number.isFinite(maxDurationSeconds)
				? await trimAudioBuffer(audioBuffer, maxDurationSeconds)
				: audioBuffer;
		const dataUrl = bufferToDataUrl(trimmedBuffer, 'audio/mpeg');
		const durationSeconds = await getAudioDurationFromBuffer(trimmedBuffer);

		console.log(
			`Voiceover generated for chapter ${chapter.id} (seconds=${durationSeconds ?? 'unknown'})`
		);
		return {
			src: dataUrl,
			durationSeconds,
		};
	} catch (error) {
		console.warn(`Deepgram synthesis failed for chapter ${chapter.id}:`, error);
		return undefined;
	}
};

const generateHuggingFaceImage = async (prompt: string): Promise<string | undefined> => {
	if (!USE_HF) {
		return undefined;
	}

	if (!HF_API_TOKEN) {
		console.warn('USE_HF is true but HF_API_TOKEN is not configured.');
		return undefined;
	}

	try {
		const response = await fetch(HF_IMAGE_API_URL, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${HF_API_TOKEN}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				inputs: prompt,
				options: {
					wait_for_model: true,
				},
			}),
		});

		if (!response.ok) {
			console.warn(
				`Hugging Face request failed (${response.status} ${response.statusText})`
			);
			return undefined;
		}

		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		const base64 = buffer.toString('base64');
		return `data:image/png;base64,${base64}`;
	} catch (error) {
		console.warn(
			'Hugging Face image generation failed:',
			error instanceof Error ? error.message : error
		);
		return undefined;
	}
};

export const buildPresentationFromDraft = async (
	draft: PresentationDraft
): Promise<PresentationContent> => {
	const theme = ensureTheme(draft.theme);

	const chapters: ChapterSlide[] = [];
	let currentStart = 4; // intro seconds

	for (const chapter of draft.chapters) {
		const id = chapter.id ?? uuidv4();
		const requestedDuration = chapter.durationSeconds ?? 15;

		let diagram: PresentationDiagram | undefined = chapter.diagram
			? {...chapter.diagram}
			: undefined;

		diagram = enrichWhiteboardDiagram(diagram, {...chapter, id}, requestedDuration);
		diagram = attachGeneratedTldrawSvg(diagram);
		let pointerPauseSeconds = getPointerPauseSeconds(diagram);
		let whiteboardDrawSeconds = estimateWhiteboardDrawSeconds(diagram);
		const maxAudioDuration = Math.max(
			0.5,
			requestedDuration + Math.max(0, whiteboardDrawSeconds - pointerPauseSeconds)
		);

		let voiceoverAsset: AudioAsset | undefined;
		if (USE_TTS && !chapter.audioFile) {
			voiceoverAsset = await ensureVoiceover({ ...chapter, id }, maxAudioDuration);
		}

		let externalAudioAsset: AudioAsset | undefined;
		if (chapter.audioFile) {
			externalAudioAsset = await resolveAudioAsset(chapter.audioFile, maxAudioDuration);
		}

		if (USE_HF && !diagram?.image) {
			const prompt =
				chapter.imagePrompts?.[0] ??
				diagram?.notes ??
				`${chapter.title} diagram illustration`;
			if (prompt) {
				const generatedImage = await generateHuggingFaceImage(prompt);
				if (generatedImage) {
					diagram = enrichWhiteboardDiagram(
						{
							...(diagram ?? {type: 'whiteboard', notes: chapter.summary}),
							image: generatedImage,
						},
						{...chapter, id},
						requestedDuration
					);
				}
			}
		}

		const audioDurationSeconds =
			externalAudioAsset?.durationSeconds ?? voiceoverAsset?.durationSeconds ?? 0;

		pointerPauseSeconds = getPointerPauseSeconds(diagram);
		whiteboardDrawSeconds = estimateWhiteboardDrawSeconds(diagram);

		const autoDuration = Math.max(
			MIN_CHAPTER_SECONDS,
			audioDurationSeconds + pointerPauseSeconds,
			whiteboardDrawSeconds + 1.2
		);

		const diagramType = diagram?.visualType ?? diagram?.type;
		const maxDurationCap =
			diagramType === 'whiteboard'
				? Math.max(STYLE_TOKENS.timing.chapterMaxSeconds, requestedDuration + whiteboardDrawSeconds)
				: STYLE_TOKENS.timing.chapterMaxSeconds;

		const durationSeconds = Math.min(
			Math.max(requestedDuration, autoDuration),
			maxDurationCap
		);

		diagram = enrichWhiteboardDiagram(diagram, {...chapter, id}, durationSeconds);
		pointerPauseSeconds = getPointerPauseSeconds(diagram);

		if (diagram?.whiteboard?.externalSvgUrl && !diagram.excalidrawSvg) {
			const overlay = await fetchExternalWhiteboardSvg(diagram.whiteboard.externalSvgUrl);
			if (overlay) {
				diagram = {
					...diagram,
					excalidrawSvg: overlay,
				};
			}
		}

		if (diagram?.whiteboard?.tldrawSceneUrl && !diagram.excalidrawSvg) {
			const scene = await fetchTldrawScene(diagram.whiteboard.tldrawSceneUrl);
			if (scene && typeof scene === 'object') {
				const svg = convertTldrawSceneToSvg(scene as {records?: Record<string, unknown>; shapes?: Record<string, unknown>}, diagram.style);
				if (svg) {
					diagram = {
						...diagram,
						excalidrawSvg: svg,
					};
				}
			}
		}

		const markers = ensureChapterMarkers({ ...chapter, id, diagram });

		const slide: ChapterSlide = {
			id,
			title: chapter.title,
			summary: chapter.summary,
			bullets: chapter.keyIdeas,
			startSeconds: currentStart,
			endSeconds: currentStart + durationSeconds,
			table: chapter.table
				? {
						title: chapter.table.title,
						rows: chapter.table.rows.map((row, index) => ({
							cells: row.map((cell, cellIndex) => ({
								value: cell,
								isHeader: index === 0 || cellIndex === 0,
							})),
						})),
				  }
				: undefined,
			diagram,
			voiceoverSrc: voiceoverAsset?.src,
			voiceoverScript:
				chapter.voiceoverScript ??
				`${chapter.summary}. ${chapter.keyIdeas.join('. ')}`,
			voiceoverDurationSeconds: voiceoverAsset?.durationSeconds,
			audioDurationSeconds: externalAudioAsset?.durationSeconds,
			markers,
			durationSeconds,
			audioFile: externalAudioAsset?.src ?? chapter.audioFile,
			imagePrompts: chapter.imagePrompts,
			pointerPauseSeconds,
		};

		chapters.push(slide);
		currentStart += durationSeconds;
	}

	return {
		titleText: draft.topic,
		subtitleText: draft.chapters[0]?.summary,
		introCaption: draft.introCaption,
		outroCaption: draft.outroCaption,
		callToAction: draft.callToAction,
		backgroundMusic: draft.backgroundMusic,
		chapters,
		flowchartSvg: undefined,
		theme,
	};
};

