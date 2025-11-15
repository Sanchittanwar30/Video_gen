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

export interface WhiteboardStyle {
	background?: string;
	stroke?: string;
	strokeWidth?: number;
	accent?: string;
	boardPadding?: number;
}

export interface DiagramEntity {
	id: string;
	title: string;
	fields?: string[];
	description?: string;
}

export interface DiagramRelationship {
	from: string;
	to: string;
	label?: string;
	fromAnchor?: 'center' | 'top' | 'bottom' | 'left' | 'right';
	toAnchor?: 'center' | 'top' | 'bottom' | 'left' | 'right';
}

export interface WhiteboardLayer {
	title: string;
	items: string[];
}

export interface WhiteboardOverlay {
	externalSvgUrl?: string;
	accentColor?: string;
}

export interface PresentationDiagram {
	type: 'mermaid' | 'erd' | 'whiteboard';
	visualType?: 'mermaid' | 'erd' | 'whiteboard' | 'svg' | 'image';
	mermaid?: string;
	image?: string;
	frameImages?: string[];
	entities?: DiagramEntity[];
	relationships?: DiagramRelationship[];
	style?: WhiteboardStyle;
	whiteboard?: {
		background?: 'grid' | 'dot' | 'plain';
		layers?: WhiteboardLayer[];
		callouts?: string[];
		accentColor?: string;
	};
	imagePrompts?: string[];
	notes?: string;
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
	diagram?: PresentationDiagram;
	voiceoverSrc?: string;
	voiceoverScript?: string;
	voiceoverDurationSeconds?: number;
	audioDurationSeconds?: number;
	markers?: ChapterMarker[];
	durationSeconds?: number;
	audioFile?: string;
	imagePrompts?: string[];
}

export interface PresentationTheme {
	primaryColor: string;
	secondaryColor: string;
	backgroundColor: string;
	accentColor: string;
	fontFamily: string;
	name?: string;
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

