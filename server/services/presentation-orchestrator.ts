import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { callGemini, GeminiRequest } from './gemini';
import { synthesizeSpeech } from './deepgram';
import type {
	PresentationContent,
	PresentationTheme,
	ChapterSlide,
	ChapterMarker,
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
	diagram?: {
		title?: string;
		steps: string[];
	};
	figure?: {
		caption?: string;
		assetUrl?: string;
	};
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
		markers.push({
			type: 'diagram',
			concept: chapter.diagram.title ?? chapter.title,
			description: chapter.diagram.steps.join(' → '),
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
	const { topic, durationSeconds = 60, notes } = request;

	const chapterIdeas = [
		{
			title: `Why ${topic} Matters`,
			summary: `Understand the core relevance of ${topic} in modern workflows.`,
			keyIdeas: [
				`${topic} unlocks new problem-solving techniques.`,
				`Real-world case studies show measurable impact.`,
				`Adopting ${topic} shifts how teams collaborate.`,
			],
			table: {
				title: 'Benefits Overview',
				rows: [
					['Aspect', 'Improvement'],
					['Efficiency', 'Up to 40% faster delivery'],
					['Quality', 'Consistent outcomes via automation'],
					['Engagement', 'Interactive, learner-centered approach'],
				],
			},
			diagram: {
				title: 'Adoption Flow',
				steps: ['Introduce concept', 'Demonstrate value', 'Practice', 'Iterate'],
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
				title: 'Concept Map',
				steps: ['Concept', 'Use case', 'Feedback', 'Improvement'],
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
		},
	];

	const provisionalChapters = ensureDuration(
		chapterIdeas.map((idea, index) => ({
			id: uuidv4(),
			title: idea.title,
			summary: idea.summary,
			keyIdeas: idea.keyIdeas,
			table: idea.table,
			diagram: idea.diagram,
			figure: {
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
		chapters: provisionalChapters,
	};
};

export const generatePresentationDraft = async (
	request: PresentationDraftRequest
): Promise<PresentationDraft> => {
	const prompt: GeminiRequest = {
		model: 'gemini-2.5-flash',
		contents: [
			{
				role: 'user',
				parts: [
					{
						text: `You are an expert instructional designer. Create a structured lesson outline about "${request.topic}" aimed at a general learner.
Use this additional guidance if provided: ${request.notes ?? 'N/A'}.

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
- Produce between 3 and 6 chapters to cover about ${request.durationSeconds ?? 60} seconds.
- Each chapter should include 3-5 keyIdeas (concise bullet points).
- Prefer including at least one table and one diagram across the chapter list when appropriate.
- Provide short captions for intro/outro/callToAction.
- DO NOT include markdown or code fences, just JSON.`,
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

const saveTempAsset = async (dir: string, filename: string, data: Buffer) => {
	const filePath = path.join(dir, filename);
	await fs.writeFile(filePath, data);
	return filePath;
};

const ensureVoiceover = async (
	chapter: PresentationDraftChapter,
	tempDir: string
): Promise<string | undefined> => {
	try {
		const audioBuffer = await synthesizeSpeech({
			text: `${chapter.summary}. ${chapter.keyIdeas.join('. ')}`,
		});
		const filename = `${chapter.id}-voiceover.mp3`;
		return await saveTempAsset(tempDir, filename, audioBuffer);
	} catch (error) {
		console.warn(`Deepgram synthesis failed for chapter ${chapter.id}:`, error);
		return undefined;
	}
};

const generateFlowchartSvg = (title: string, steps: string[]): string => {
	const width = 800;
	const height = 400;
	const stepWidth = 200;
	const stepHeight = 80;
	const gap = 40;
	const startX = (width - (steps.length * stepWidth + (steps.length - 1) * gap)) / 2;
	const centerY = height / 2;

	const stepRects = steps
		.map((step, index) => {
			const x = startX + index * (stepWidth + gap);
			return `
      <g transform="translate(${x}, ${centerY - stepHeight / 2})">
        <rect rx="12" ry="12" width="${stepWidth}" height="${stepHeight}" fill="#38bdf8" opacity="0.85"/>
        <text x="${stepWidth / 2}" y="${stepHeight / 2}" text-anchor="middle" dominant-baseline="middle" fill="#0f172a" font-size="18" font-family="Inter, sans-serif">
          ${step}
        </text>
      </g>
    `;
		})
		.join('\n');

	const connectors = steps
		.slice(0, -1)
		.map((_, index) => {
			const x = startX + (index + 1) * (stepWidth + gap) - gap / 2;
			return `<line x1="${x}" y1="${centerY}" x2="${x + gap}" y2="${centerY}" stroke="#38bdf8" stroke-width="4" marker-end="url(#arrow)"/>`;
		})
		.join('\n');

	return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 z" fill="#38bdf8" />
      </marker>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow flood-color="#0f172a" flood-opacity="0.35" dx="0" dy="12" stdDeviation="12" />
      </filter>
    </defs>
    <rect width="${width}" height="${height}" rx="24" fill="rgba(15,23,42,0.85)" filter="url(#shadow)" />
    <text x="${width / 2}" y="60" text-anchor="middle" font-size="28" fill="#e0f2fe" font-family="Inter, sans-serif" font-weight="600">${title}</text>
    ${connectors}
    ${stepRects}
  </svg>
  `;
};

export const buildPresentationFromDraft = async (
	draft: PresentationDraft
): Promise<PresentationContent> => {
	const theme = ensureTheme(draft.theme);
	const tempDir = await fs.mkdtemp(path.join(process.cwd(), 'presentation-draft-'));

	const chapters: ChapterSlide[] = [];
	let currentStart = 4; // intro seconds

	for (const chapter of draft.chapters) {
		const id = chapter.id ?? uuidv4();
		const durationSeconds = chapter.durationSeconds ?? 15;
		const voiceoverSrc = await ensureVoiceover({ ...chapter, id }, tempDir);
		const markers = ensureChapterMarkers({ ...chapter, id });

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
			voiceoverSrc,
			markers,
			durationSeconds,
		};

		chapters.push(slide);
		currentStart += durationSeconds;
	}

	const diagramChapter = draft.chapters.find((c) => c.diagram?.steps?.length);
	const flowchartSvg = diagramChapter
		? generateFlowchartSvg(diagramChapter.diagram!.title ?? diagramChapter.title, diagramChapter.diagram!.steps)
		: undefined;

	return {
		titleText: draft.topic,
		subtitleText: draft.chapters[0]?.summary,
		introCaption: draft.introCaption,
		outroCaption: draft.outroCaption,
		callToAction: draft.callToAction,
		backgroundMusic: draft.backgroundMusic,
		chapters,
		flowchartSvg,
		theme,
	};
};

