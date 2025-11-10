import {promises as fs} from 'fs';
import path from 'path';
import os from 'os';
import {pathToFileURL} from 'url';
import {v4 as uuid} from 'uuid';
import {synthesizeSpeechToFile, hasDeepgram} from './deepgram';
import {callGemini} from './gemini';
import type {
	PresentationContent,
	PresentationTheme,
	PresentationJobPayload,
	TableRow,
	ChapterTable,
	ChapterMarker,
	ChapterSlide,
} from '../../src/types/presentation';

export interface PresentationDraftChapter {
	id: string;
	title: string;
	summary: string;
	points: string[];
	startSeconds: number;
	endSeconds: number;
	markers?: ChapterMarker[];
	durationSeconds?: number;
}

export interface PresentationDraft {
	topic: string;
	introCaption?: string;
	outroCaption?: string;
	callToAction?: string;
	chapters: PresentationDraftChapter[];
	backgroundMusic?: string;
	theme?: Partial<PresentationTheme>;
}

/**
 * Step 1: Call the language model to outline chapters, key points, and markers
 */
export async function generatePresentationDraft(
	params: {topic: string; level?: string; durationSeconds?: number; notes?: string}
): Promise<PresentationDraft> {
	const duration = params.durationSeconds ?? 600;
	if (!callGemini) {
		return buildFallbackDraft(params.topic, duration);
	}

	try {
		const prompt = buildGeminiPrompt(params.topic, duration, params.level, params.notes);
		const raw = await callGemini(prompt);
		const cleaned = raw.replace(/^```json/i, '').replace(/```$/i, '').trim();
		const plan = JSON.parse(cleaned) as GeminiLessonPlan;

		if (!plan?.chapters?.length) {
			throw new Error('Gemini returned no chapters');
		}

		const draftChapters: PresentationDraftChapter[] = [];
		let elapsed = 0;

		for (const [index, chapter] of plan.chapters.entries()) {
			const chapterDuration = Math.max(60, Math.round((chapter.durationSeconds ?? duration / plan.chapters.length)));
			const startSeconds = Math.round(elapsed);
			const endSeconds = Math.round(Math.min(duration, elapsed + chapterDuration));
			elapsed = endSeconds;

			const tableMarker = chapter.table
				? {
						type: 'table' as const,
						title: chapter.table.title || `Key Data for ${chapter.title}`,
						rows: chapter.table.rows.filter((row) => Array.isArray(row) && row.length > 0),
					}
				: undefined;

			const markers: ChapterMarker[] = [];
			if (tableMarker && tableMarker.rows.length > 0) {
				markers.push(tableMarker);
			}

			if (chapter.diagram?.steps?.length) {
				markers.push({
					type: 'diagram',
					concept: chapter.diagram.title || chapter.title,
					description: chapter.diagram.steps.join(' → '),
				});
			}

			if (chapter.figure) {
				markers.push({
					type: 'figure',
					caption: chapter.figure.caption || `Illustration of ${chapter.title}`,
					assetUrl: chapter.figure.assetUrl,
				});
			}

			draftChapters.push({
				id: chapter.id || `chapter-${index + 1}`,
				title: chapter.title,
				summary: chapter.summary,
				points: chapter.keyIdeas.slice(0, 5),
				startSeconds,
				endSeconds,
				durationSeconds: chapterDuration,
				markers,
			});
		}

		return {
			topic: plan.topic || params.topic,
			introCaption: plan.introCaption || `Discover ${params.topic} in minutes.`,
			outroCaption: plan.outroCaption || `Keep exploring ${params.topic} to grow your knowledge!`,
			callToAction: plan.callToAction || 'Share what you learned and keep practicing!',
			backgroundMusic: plan.backgroundMusic,
			theme: plan.theme,
			chapters: draftChapters,
		};
	} catch (error) {
		console.warn('Falling back to heuristic draft due to Gemini error:', error);
		return buildFallbackDraft(params.topic, duration);
	}
}

/**
 * Step 2: Convert the draft into a full presentation JSON with assets
 */
export async function buildPresentationFromDraft(
	draft: PresentationDraft,
	options: PresentationJobPayload,
	totalDurationSeconds?: number
): Promise<{content: PresentationContent; tempFiles: string[]}> {
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'presentation-draft-'));
	const tempFiles: string[] = [];

	const theme: PresentationTheme = {
		primaryColor: draft.theme?.primaryColor ?? '#2563eb',
		secondaryColor: draft.theme?.secondaryColor ?? '#7c3aed',
		backgroundColor: draft.theme?.backgroundColor ?? '#0f172a',
		accentColor: draft.theme?.accentColor ?? '#38bdf8',
		fontFamily: draft.theme?.fontFamily ?? 'Inter, Arial, sans-serif',
	};

	const firstDiagramChapter = draft.chapters.find((chapter) =>
		chapter.markers?.some((marker) => marker.type === 'diagram')
	);

	const firstDiagramMarker = firstDiagramChapter?.markers?.find(
		(marker): marker is ChapterMarker & {type: 'diagram'} => marker.type === 'diagram'
	);

	const diagramSteps =
		firstDiagramMarker?.description
			?.split('→')
			.map((step) => step.trim())
			.filter((step) => step.length > 0) ?? firstDiagramChapter?.points;

	const content: PresentationContent = {
		titleText: draft.topic,
		subtitleText: options.titleText ?? `Learn ${draft.topic}`,
		introCaption: draft.introCaption,
		outroCaption: draft.outroCaption,
		callToAction: draft.callToAction,
		chapters: [],
		flowchartSvg: options.svgFile ? await loadSvgMarkup(options.svgFile) : undefined,
		audioTrack: undefined,
		backgroundMusic: toMediaSrc(options.backgroundMusic),
		theme,
	};

	if (!content.flowchartSvg && diagramSteps && diagramSteps.length >= 2) {
		content.flowchartSvg = generateFlowchartSvg(firstDiagramChapter?.title ?? draft.topic, diagramSteps);
	}

	const MIN_CHAPTER_SECONDS = 5;
	const summedDurations = draft.chapters.reduce((sum, chapter) => {
		const rangeDuration =
			typeof chapter.startSeconds === 'number' && typeof chapter.endSeconds === 'number'
				? Math.max(0, chapter.endSeconds - chapter.startSeconds)
				: 0;
		const candidate = chapter.durationSeconds ?? rangeDuration;
		return sum + candidate;
	}, 0);
	const fallbackTotal = summedDurations > 0 ? summedDurations : MIN_CHAPTER_SECONDS * draft.chapters.length;
	const inferredTotalDuration = totalDurationSeconds ?? fallbackTotal;

	let elapsedSeconds = 0;

	for (const [index, chapterDraft] of draft.chapters.entries()) {
		const chaptersRemaining = draft.chapters.length - index;
		const suggested = chapterDraft.durationSeconds ?? inferredTotalDuration / draft.chapters.length;
		const remaining = Math.max(0, inferredTotalDuration - elapsedSeconds);
		const maxForThis = Math.max(MIN_CHAPTER_SECONDS, remaining - MIN_CHAPTER_SECONDS * (chaptersRemaining - 1));
		const chapterDuration = Math.max(MIN_CHAPTER_SECONDS, Math.min(maxForThis, suggested));
		const startSeconds = Math.round(elapsedSeconds);
		elapsedSeconds += chapterDuration;
		const endSeconds = Math.round(Math.min(inferredTotalDuration, elapsedSeconds));

		const {tableMarker, extraMarkers} = partitionMarkers(chapterDraft.markers);
		const table = tableMarker ? convertTableMarker(tableMarker) : undefined;

		const slide: ChapterSlide = {
			id: chapterDraft.id ?? `chapter-${index + 1}`,
			title: chapterDraft.title,
			summary: chapterDraft.summary,
			bullets: chapterDraft.points,
			startSeconds,
			endSeconds,
			table,
			markers: extraMarkers.map((marker) =>
				marker.type === 'figure'
					? {
							...marker,
							assetUrl: toMediaSrc(marker.assetUrl),
						}
					: marker
			),
		};

		if (hasDeepgram()) {
			const script = [slide.title, slide.summary, ...slide.bullets].join('. ').replace(/\s+/g, ' ').trim();
			if (script) {
				try {
					const audioPath = path.join(tempDir, `${slide.id}-${uuid()}.mp3`);
					await synthesizeSpeechToFile(script, audioPath);
					const audioBuffer = await fs.readFile(audioPath);
					slide.voiceoverSrc = `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`;
					tempFiles.push(audioPath);
				} catch (error) {
					console.warn(`Failed to synthesize voiceover for ${slide.id}:`, error);
				}
			}
		}

		content.chapters.push(slide);
	}

	return {content, tempFiles};
}

function partitionMarkers(markers?: ChapterMarker[]) {
	const tableMarker = markers?.find((marker) => marker.type === 'table') as ChapterMarker & {type: 'table'} | undefined;
	const extraMarkers = (markers ?? []).filter((marker) => marker.type !== 'table');
	return {tableMarker, extraMarkers};
}

function convertTableMarker(tableMarker: ChapterMarker & {type: 'table'}): ChapterTable {
	const rows: TableRow[] = tableMarker.rows.map((cols, rowIndex) => ({
		cells: cols.map((value, colIndex) => ({
			value,
			isHeader: rowIndex === 0 || colIndex === 0,
		})),
	}));

	return {
		title: tableMarker.title ?? 'Key Comparisons',
		rows,
		highlightedRowIndex: 1,
	};
}

function toMediaSrc(value?: string): string | undefined {
	if (!value) {
		return undefined;
	}
	if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) {
		return value;
	}
	if (value.startsWith('file://')) {
		return value.replace('file://', '');
	}
	return path.resolve(value);
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

function generateFlowchartSvg(title: string, steps: string[]): string {
	const width = 620;
	const nodeWidth = 420;
	const nodeHeight = 86;
	const verticalGap = 48;
	const margin = 32;
	const totalHeight = steps.length * (nodeHeight + verticalGap) + margin * 2;

	const handDrawnRect = (x: number, y: number, w: number, h: number) => {
		const jitter = 6;
		const top = `${x} ${y + Math.random() * jitter}`;
		const right = `${x + w + Math.random() * jitter} ${y + Math.random() * jitter}`;
		const bottom = `${x + w + Math.random() * jitter} ${y + h + Math.random() * jitter}`;
		const left = `${x + Math.random() * jitter} ${y + h + Math.random() * jitter}`;
		return `${top} ${right} ${bottom} ${left} ${top}`;
	};

	const nodes = steps
		.map((step, index) => {
			const y = margin + index * (nodeHeight + verticalGap);
			const x = (width - nodeWidth) / 2;
			const scribblePath = handDrawnRect(x, y, nodeWidth, nodeHeight);
			const highlightOpacity = index === 0 ? 0.18 : index === steps.length - 1 ? 0.14 : 0.1;
			return `
        <g transform="translate(0 ${index * 2})">
          <path d="M ${scribblePath}" fill="rgba(56,189,248,${highlightOpacity})" stroke="#38bdf8" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M ${scribblePath}" fill="none" stroke="rgba(15,23,42,0.35)" stroke-width="1.2" stroke-dasharray="8 10" stroke-linecap="round" />
          <text x="${width / 2}" y="${y + nodeHeight / 2}" dominant-baseline="middle" text-anchor="middle" font-family="Inter, 'Segoe UI', sans-serif" font-size="19" fill="#e2e8f0" font-weight="600" style="white-space: pre-line; line-height: 1.4">${step.replace(/"/g, '&quot;')}</text>
        </g>
      `;
		})
		.join('\n');

	const arrows = steps
		.slice(0, -1)
		.map((_, index) => {
			const y = margin + (index + 1) * (nodeHeight + verticalGap) - verticalGap / 2;
			const controlOffset = 26;
			return `
        <path d="M ${width / 2 - 80},${y - controlOffset} C ${width / 2 - 40},${y - controlOffset / 2} ${width / 2 + 40},${y + controlOffset / 2} ${
				width / 2 + 80
			},${y + controlOffset}" fill="none" stroke="#38bdf8" stroke-width="2.8" stroke-linecap="round" marker-end="url(#arrowhead)"/>
      `;
		})
		.join('\n');

	return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
  <defs>
    <marker id="arrowhead" markerWidth="14" markerHeight="14" refX="7" refY="7" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0,0 L14,7 L0,14" fill="#38bdf8" />
    </marker>
    <filter id="paperTexture">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="noise" />
      <feDiffuseLighting in="noise" surfaceScale="1" lighting-color="#0f172a55" result="light">
        <feDistantLight azimuth="235" elevation="25" />
      </feDiffuseLighting>
      <feBlend in="SourceGraphic" in2="light" mode="multiply" />
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="rgba(15,23,42,0.58)" rx="28" filter="url(#paperTexture)" />
  <text x="${width / 2}" y="${margin - 6}" text-anchor="middle" font-family="'Playfair Display', Inter, serif" font-size="26" fill="#f8fafc" font-weight="600">${title.replace(/"/g, '&quot;')}</text>
  ${arrows}
  ${nodes}
</svg>
`.trim();
}

interface GeminiLessonPlan {
	topic: string;
	introCaption?: string;
	outroCaption?: string;
	callToAction?: string;
	backgroundMusic?: string;
	theme?: Partial<PresentationTheme>;
	chapters: Array<{
		id?: string;
		title: string;
		summary: string;
		keyIdeas: string[];
		durationSeconds?: number;
		table?: {
			title?: string;
			rows: string[][];
		};
		diagram?: {
			title?: string;
			steps: string[];
		};
		figure?: {
			caption?: string;
			assetUrl?: string;
		};
	}>;
}

function buildGeminiPrompt(topic: string, durationSeconds: number, level?: string, notes?: string) {
	const durationMinutes = Math.round(durationSeconds / 60);
	return `
You are an expert instructional designer. Create a structured lesson outline about "${topic}" aimed at a ${level || 'general'} learner.
Use this additional guidance if provided: ${notes || 'None'}.

Return ONLY JSON matching this TypeScript type:
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
      "title"?: string;
      "steps": string[];
    };
    "figure"?: {
      "caption"?: string;
      "assetUrl"?: string;
    };
  }>;
}

Requirements:
- Produce between 3 and 6 chapters to cover about ${durationMinutes} minutes.
- Each chapter should include 3-5 keyIdeas (concise bullet points).
- Prefer including at least one table and one diagram across the chapter list when appropriate.
- Provide short captions for intro/outro/callToAction to drive engagement.
- DO NOT include markdown or code fences, just JSON.
`.trim();
}

function buildFallbackDraft(topic: string, durationSeconds: number): PresentationDraft {
	const chapters = Math.max(3, Math.round(durationSeconds / 180));
	const chapterLength = durationSeconds / chapters;
	const lowerTopic = topic.toLowerCase();

	const topicKeyIdeas =
		lowerTopic.includes('c++') || lowerTopic.includes('cpp')
			? [
					'Explain how C++ extends C with abstraction and safety.',
					'Introduce classes, objects, and encapsulation in practice.',
					'Compare inheritance, composition, and templates.',
					'Show polymorphism and virtual dispatch solving real problems.',
					'Highlight modern C++ (smart pointers, ranges, STL).',
			  ]
			: lowerTopic.includes('python')
			? [
					'Define Python’s philosophy and why readability matters.',
					'Outline core syntax: variables, types, control flow.',
					'Show how functions and modules promote reuse.',
					'Introduce object-oriented and functional patterns in Python.',
					'Map real-world applications that benefit from Python.',
			  ]
			: lowerTopic.includes('machine learning')
			? [
					'Contrast machine learning with traditional algorithms.',
					'Explain supervised vs. unsupervised learning tasks.',
					'Highlight data pipelines: clean, split, and engineer features.',
					'Describe model training, evaluation, and iteration cycles.',
					'Explore production considerations and common pitfalls.',
			  ]
			: [
					`Define ${topic} and place it within its broader discipline.`,
					`Break ${topic} into 3–4 pillars with tangible examples.`,
					`Discuss a real-world scenario where ${topic} delivers value.`,
					`Point out misconceptions or mistakes learners make about ${topic}.`,
					`Summarize how to practise and deepen mastery of ${topic}.`,
			  ];

	return {
		topic,
		introCaption: `Kick off a quick tour of ${topic}.`,
		outroCaption: `Wrap up ${topic} and choose one idea to practise next.`,
		callToAction: `Share this lesson and teach a friend one ${topic} insight.`,
		backgroundMusic: undefined,
		chapters: Array.from({length: chapters}).map((_, index) => {
			const startSeconds = Math.round(index * chapterLength);
			const endSeconds = Math.round((index + 1) * chapterLength);
			const durationSeconds = Math.max(5, endSeconds - startSeconds);

			const ideaA = topicKeyIdeas[index % topicKeyIdeas.length];
			const ideaB = topicKeyIdeas[(index + 1) % topicKeyIdeas.length];
			const ideaC = topicKeyIdeas[(index + 2) % topicKeyIdeas.length];

			const tableRows = [
				['Focus', 'Key takeaway'],
				['Concept', ideaA],
				['Application', ideaB],
				['Tip', ideaC],
			];

			const diagramDescription = [ideaA, ideaB, ideaC];

			return {
				id: `chapter-${index + 1}`,
				title: `${topic} – Key Idea ${index + 1}`,
				summary:
					index === 0
						? `Clarify what ${topic} means and where it matters most.`
						: index === chapters - 1
						? `Tie ${topic} back to practical next steps and pitfalls to avoid.`
						: `Dive into a core pillar of ${topic} with examples and cautions.`,
				points: [ideaA, ideaB, ideaC],
				startSeconds,
				endSeconds,
				durationSeconds,
				markers:
					index === 0
						? [
								{
									type: 'diagram',
									concept: `${topic} overview`,
									description: diagramDescription.join(' → '),
								},
								{type: 'table', title: `${topic} essentials`, rows: tableRows},
						  ]
						: [
								{
									type: 'diagram',
									concept: `${topic} workflow`,
									description: diagramDescription.join(' → '),
								},
						  ],
			};
		}),
	};
}

