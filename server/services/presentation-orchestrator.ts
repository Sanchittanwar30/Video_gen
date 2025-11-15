import {v4 as uuidv4} from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import {parseBuffer} from 'music-metadata';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import {callGeminiImage, callGeminiText} from './gemini';
import {synthesizeSpeech} from './deepgram';
import {STYLE_TOKENS} from '../../src/styleConfig';
import type {
	PresentationContent,
	PresentationTheme,
	ChapterSlide,
	ChapterMarker,
	PresentationDiagram,
} from '../../src/types/presentation';

export interface PresentationDraftRequest {
	topic: string;
	durationSeconds?: number;
	backgroundMusic?: string;
	notes?: string;
	language?: string;
}

export interface PresentationDraftChapter {
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
				chapter.durationSeconds ??
				Math.max(minimumChapterDuration, totalDurationSeconds / chapters.length),
		}));
	}

	const evenlyDistributed = totalDurationSeconds / chapters.length;
	return chapters.map((chapter) => ({
		...chapter,
		durationSeconds: Math.max(minimumChapterDuration, evenlyDistributed),
	}));
};

const generateGeminiWhiteboardImage = async (
	lessonTopic: string,
	chapter: PresentationDraftChapter,
	prompt: string
): Promise<string | undefined> => {
	try {
		return await callGeminiImage(
			`Create a clean educational whiteboard-style hand-drawn sketch using thin black ink lines.
Use a slightly wobbly outline frame, handwritten text, no color, no shading, no gradients.
Use 1920x1080 transparent background. Make the layout clear, readable, and centered.
Focus on the core concept: ${lessonTopic}. Include chapter context: ${chapter.title}.
Scene description: ${prompt}`,
			'1920x1080'
		);
	} catch (error) {
		console.warn(
			'Gemini whiteboard image generation failed:',
			error instanceof Error ? error.message : error
		);
		return undefined;
	}
};

const ensureWhiteboardImage = async (
	lessonTopic: string,
	chapter: PresentationDraftChapter,
	diagram: PresentationDiagram | undefined
): Promise<PresentationDiagram | undefined> => {
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

	if (diagram.image) {
		return {
			...diagram,
			visualType: 'whiteboard',
		};
	}

	const prompt =
		diagram.imagePrompts?.[0] ??
		`${chapter.summary}. Highlight key ideas: ${(chapter.keyIdeas ?? []).join(', ')}`;

	const progressiveStages = [
		`${prompt}. Stage 1 of 3 — Rough layout only: place the main shapes and title text without annotations.`,
		`${prompt}. Stage 2 of 3 — Add connecting arrows, dashed entanglement arcs, and key labels.`,
		`${prompt}. Stage 3 of 3 — Final details: emphasize arrows, add question prompts, highlight accents in #38BDF8/#F97316.`,
	];

	const frameImages: string[] = [];
	for (const stage of progressiveStages) {
		const frame = await generateGeminiWhiteboardImage(lessonTopic, chapter, stage);
		if (frame) {
			frameImages.push(frame);
		}
	}

	if (frameImages.length) {
		return {
			...diagram,
			visualType: 'whiteboard',
			image: frameImages.at(-1),
			frameImages,
		};
	}

	const geminiImage = await generateGeminiWhiteboardImage(lessonTopic, chapter, prompt);

	if (geminiImage) {
		return {
			...diagram,
			visualType: 'whiteboard',
			image: geminiImage,
			frameImages: [geminiImage],
		};
	}

	return {
		...diagram,
		visualType: 'whiteboard',
	};
};

const generateFallbackDraft = (request: PresentationDraftRequest): PresentationDraft => {
	const {topic, durationSeconds = 60, notes} = request;

	const genericIdeas: Array<Omit<PresentationDraftChapter, 'id'>> = [
		{
			title: `Why ${topic} Matters`,
			summary: `Understand the core relevance of ${topic} in modern workflows.`,
			keyIdeas: [
				`${topic} unlocks new problem-solving techniques.`,
				'Real-world case studies show measurable impact.',
				`Adopting ${topic} shifts how teams collaborate.`,
			],
			voiceoverScript: `Let's explore why ${topic} matters and how it reshapes day-to-day work.`,
			diagram: {
				type: 'whiteboard',
				visualType: 'whiteboard',
				whiteboard: {
					callouts: ['Vision', 'Plan', 'Launch'],
				},
				imagePrompts: [
					`Whiteboard sketch showing a central headline "${topic}" with three sticky notes labelled Vision, Plan, Launch and arrows connecting them.`,
				],
			},
		},
		{
			title: `${topic} Building Blocks`,
			summary: `Explore core components and how they connect${notes ? `, considering ${notes}` : ''}.`,
			keyIdeas: [
				'Start with fundamental definitions.',
				`Relate the pieces of ${topic} using analogies.`,
				'Spot the patterns that repeat across scenarios.',
			],
			diagram: {
				type: 'whiteboard',
				visualType: 'whiteboard',
				whiteboard: {
					callouts: ['Inputs', 'Process', 'Outcome'],
				},
				imagePrompts: [
					`Whiteboard diagram with three columns titled Inputs, Process, Outcome connected by arrows and brief bullet notes under each heading.`,
				],
			},
		},
		{
			title: `Putting ${topic} Into Practice`,
			summary: `Translate ideas into hands-on implementation steps.`,
			keyIdeas: [
				'Plan your workflow before execution.',
				'Monitor each milestone against objectives.',
				'Celebrate quick wins to maintain momentum.',
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
				type: 'whiteboard',
				visualType: 'whiteboard',
				whiteboard: {
					callouts: ['Plan', 'Build', 'Improve'],
				},
				imagePrompts: [
					`Whiteboard flow showing a checklist for Plan, a progress bar for Build, and a celebratory team icon for Improve, linked in sequence.`,
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

const buildGeminiPrompt = (request: PresentationDraftRequest): string => `You are an expert instructional designer and storyboard artist. Create a richly visual lesson outline about "${request.topic}" for general learners.
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
      "whiteboard"?: {
        "background"?: "grid" | "dot" | "plain";
        "layers"?: Array<{ "title": string; "items": string[]; }>;
        "callouts"?: string[];
        "accentColor"?: string;
      };
      "imagePrompts"?: string[];
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
- Use whiteboard-style diagrams to break down processes: set both "diagram.type":"whiteboard" and "diagram.visualType":"whiteboard". Include 1-2 "diagram.imagePrompts" describing how the whiteboard sketch should look (callouts, arrows, layout). No TLDraw or SVG data is required.
- Provide an engaging voiceoverScript per chapter (1-2 sentences, friendly tone) but do not assume TTS—audioFile should only be set when a real file path is known.
- If generating image prompts, list 1-2 short descriptive prompts tailored for diffusion models (optional).
- DO NOT wrap the JSON in backticks or include extra text.`;

export const generatePresentationDraft = async (
	request: PresentationDraftRequest
): Promise<PresentationDraft> => {
	try {
		const raw = await callGeminiText(buildGeminiPrompt(request));
		const response = JSON.parse(raw) as PresentationDraft;
		const draft: PresentationDraft = {
			...response,
			topic: response.topic ?? request.topic,
			introCaption: response.introCaption ?? `Today we explore ${request.topic}`,
			outroCaption: response.outroCaption ?? 'Thanks for learning with us',
			callToAction: response.callToAction ?? 'Subscribe for more bite-sized lessons!',
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
		console.warn(
			`Unable to resolve audio asset "${source}":`,
			error instanceof Error ? error.message : error
		);
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
					: diagramType === 'mermaid'
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
			text: chapter.voiceoverScript ?? `${chapter.summary}. ${chapter.keyIdeas.join('. ')}`,
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
		const requestedDuration = Math.max(
			MIN_CHAPTER_SECONDS,
			chapter.durationSeconds ?? MIN_CHAPTER_SECONDS
		);

		let diagram: PresentationDiagram | undefined = chapter.diagram
			? {...chapter.diagram}
			: undefined;

		diagram = await ensureWhiteboardImage(draft.topic, {...chapter, id}, diagram);

		let voiceoverAsset: AudioAsset | undefined;
		if (USE_TTS && !chapter.audioFile) {
			voiceoverAsset = await ensureVoiceover({...chapter, id}, requestedDuration);
		}

		let externalAudioAsset: AudioAsset | undefined;
		if (chapter.audioFile) {
			externalAudioAsset = await resolveAudioAsset(
				chapter.audioFile,
				requestedDuration + AUDIO_PADDING_SECONDS
			);
		}

		if (USE_HF && diagram && (diagram.visualType ?? diagram.type) === 'whiteboard' && !diagram.image) {
			const prompt =
				chapter.imagePrompts?.[0] ??
				diagram?.notes ??
				`${chapter.title} diagram illustration`;
			if (prompt) {
				const generatedImage = await generateHuggingFaceImage(prompt);
				if (generatedImage) {
					diagram = {
						...(diagram ?? {type: 'whiteboard', notes: chapter.summary}),
						visualType: diagram?.visualType ?? 'image',
						image: generatedImage,
						frameImages: [generatedImage],
					};
				}
			}
		}

		const audioDurationSeconds =
			externalAudioAsset?.durationSeconds ?? voiceoverAsset?.durationSeconds ?? 0;

		const autoDuration = Math.max(
			MIN_CHAPTER_SECONDS,
			requestedDuration,
			audioDurationSeconds > 0 ? audioDurationSeconds + AUDIO_PADDING_SECONDS : 0
		);

		const durationSeconds = Math.min(
			Math.max(requestedDuration, autoDuration),
			STYLE_TOKENS.timing.chapterMaxSeconds
		);

		const markers = ensureChapterMarkers({...chapter, id, diagram});

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
				chapter.voiceoverScript ?? `${chapter.summary}. ${chapter.keyIdeas.join('. ')}`,
			voiceoverDurationSeconds: voiceoverAsset?.durationSeconds,
			audioDurationSeconds: externalAudioAsset?.durationSeconds,
			markers,
			durationSeconds,
			audioFile: externalAudioAsset?.src ?? chapter.audioFile,
			imagePrompts: chapter.imagePrompts,
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


