export interface ChapterTime {
	startSeconds: number;
	endSeconds: number;
	label?: string;
}

export interface TableCell {
	value: string;
	isHeader?: boolean;
}

export interface TableRow {
	cells: TableCell[];
}

export interface ChapterTable {
	title?: string;
	rows: TableRow[];
	highlightedRowIndex?: number;
}

export type ChapterMarker =
	| {
			type: 'table';
			title?: string;
			rows: string[][];
	  }
	| {
			type: 'diagram';
			concept: string;
			description?: string;
	  }
	| {
			type: 'figure';
			caption: string;
			assetUrl?: string;
	  };

export interface ChapterSlide {
	id: string;
	title: string;
	summary: string;
	bullets: string[];
	startSeconds: number;
	endSeconds: number;
	table?: ChapterTable;
	voiceoverSrc?: string;
	markers?: ChapterMarker[];
	durationSeconds?: number;
}

export interface PresentationTheme {
	primaryColor: string;
	secondaryColor: string;
	backgroundColor: string;
	accentColor: string;
	fontFamily: string;
}

export interface PresentationContent {
	titleText: string;
	subtitleText?: string;
	introCaption?: string;
	outroCaption?: string;
	callToAction?: string;
	chapters: ChapterSlide[];
	flowchartSvg?: string;
	audioTrack?: string;
	backgroundMusic?: string;
	theme: PresentationTheme;
}

export interface PresentationBuildRequest {
	videoFile: string;
	svgFile?: string;
	tableData?: ChapterTable[];
	titleText?: string;
	subtitleText?: string;
	chapterTimes?: ChapterTime[];
	introCaption?: string;
	outroCaption?: string;
	callToAction?: string;
	language?: string;
	theme?: Partial<PresentationTheme>;
	frameRate?: number;
	backgroundMusic?: string;
}

export interface PresentationBuildResult {
	content: PresentationContent;
	durationInFrames: number;
	fps: number;
	width: number;
	height: number;
	tempFiles?: string[];
}

export interface PresentationJobPayload extends PresentationBuildRequest {}

