import {v4 as uuid} from 'uuid';
import type {PresentationDiagram, WhiteboardStyle, DiagramRelationship, DiagramEntity} from '../../src/types/presentation';

export interface TldrawSnapshot {
	records: Record<string, any>;
}

interface Position {
	x: number;
	y: number;
}

const createGeoShape = ({
	id,
	x,
	y,
	width,
	height,
	palette,
	fill = 'none',
	strokeDash = 'draw',
}: {
	id?: string;
	x: number;
	y: number;
	width: number;
	height: number;
	palette?: WhiteboardStyle;
	fill?: string;
	strokeDash?: string;
}) => {
	const shapeId = `shape:${id ?? uuid()}`;
	return {
		typeName: 'shape',
		id: shapeId,
		type: 'geo',
		x,
		y,
		rotation: 0,
		index: 'a' + shapeId,
		parentId: 'page:page',
		props: {
			geo: 'rectangle',
			w: width,
			h: height,
			fill,
			stroke: palette?.stroke ?? '#e2e8f0',
			strokeWidth: palette?.strokeWidth ?? 3,
			dash: strokeDash,
			size: 'm',
			font: 'draw',
			align: 'middle',
		},
	};
};

const createArrowShape = ({
	id,
	start,
	end,
	palette,
}: {
	id?: string;
	start: Position;
	end: Position;
	palette?: WhiteboardStyle;
}) => {
	const shapeId = `shape:${id ?? uuid()}`;
	return {
		typeName: 'shape',
		id: shapeId,
		type: 'arrow',
		x: 0,
		y: 0,
		rotation: 0,
		index: 'a' + shapeId,
		parentId: 'page:page',
		props: {
			start: {x: start.x, y: start.y},
			end: {x: end.x, y: end.y},
			stroke: palette?.accent ?? '#38bdf8',
			strokeWidth: palette?.strokeWidth ?? 3,
		},
	};
};

const layoutEntities = (entities: DiagramEntity[] | undefined) => {
	if (!entities?.length) return [];
	const count = entities.length;
	const columns = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(count))));
	const rows = Math.ceil(count / columns);
	const canvasWidth = 960;
	const canvasHeight = 540;
	const marginX = 100;
	const marginY = 80;
	const columnWidth = (canvasWidth - marginX * 2) / columns;
	const rowHeight = (canvasHeight - marginY * 2) / rows;

	return entities.map((entity, index) => {
		const textLines = [entity.title ?? entity.id ?? 'Entity', ...(entity.fields ?? [])];
		const maxLength = Math.max(...textLines.map((line) => (line?.length ?? 0)), 10);
		const width = Math.min(340, Math.max(200, maxLength * 9));
		const height = Math.min(220, Math.max(120, 60 + (textLines.length - 1) * 26));
		const col = index % columns;
		const row = Math.floor(index / columns);
		const x = marginX + col * columnWidth + (columnWidth - width) / 2;
		const y = marginY + row * rowHeight + (rowHeight - height) / 2;
		return {entity, x, y, width, height};
	});
};

const relationshipArrow = (
	layout: ReturnType<typeof layoutEntities>,
	relationship: DiagramRelationship,
	palette?: WhiteboardStyle
) => {
	const from = layout.find((entry) => entry.entity.id === relationship.from);
	const to = layout.find((entry) => entry.entity.id === relationship.to);
	if (!from || !to) return undefined;
	const startX = from.x + (from.width ?? 220) / 2;
	const startY = from.y + (from.height ?? 130) / 2;
	const endX = to.x + (to.width ?? 220) / 2;
	const endY = to.y + (to.height ?? 130) / 2;
	return createArrowShape({
		start: {x: startX, y: startY},
		end: {x: endX, y: endY},
		palette,
	});
};

const createTextShape = ({
	id,
	x,
	y,
	text,
	palette,
	fontSize = 18,
}: {
	id?: string;
	x: number;
	y: number;
	text: string;
	palette?: WhiteboardStyle;
	fontSize?: number;
}) => {
	const shapeId = `shape:${id ?? uuid()}`;
	return {
		typeName: 'shape',
		id: shapeId,
		type: 'text',
		x,
		y,
		rotation: 0,
		index: 'a' + shapeId,
		parentId: 'page:page',
		props: {
			text,
			color: palette?.stroke ?? '#e2e8f0',
			size: fontSize,
			align: 'start',
			autoSize: 'both',
		},
	};
};

export const buildTldrawScene = (
	diagram: PresentationDiagram | undefined
): TldrawSnapshot | undefined => {
	if (!diagram) return undefined;
	const palette = diagram.style;
	const records: Record<string, any> = {};

	if ((diagram.entities?.length ?? 0) > 0) {
		const positioned = layoutEntities(diagram.entities);
		positioned.forEach(({x, y, entity, width, height}) => {
			const shape = createGeoShape({
				x,
				y,
				width,
				height,
				palette,
				fill: 'rgba(56,189,248,0.08)',
			});
			records[shape.id] = shape;

			const lines = [entity.title ?? entity.id, ...(entity.fields ?? [])].filter(Boolean);
			if (lines.length) {
				const textShape = createTextShape({
					x: x + 18,
					y: y + 42,
					text: lines.join('\n'),
					palette,
					fontSize: 16,
				});
				records[textShape.id] = textShape;
			}
		});

		diagram.relationships?.forEach((rel) => {
			const arrow = relationshipArrow(positioned, rel, palette);
			if (arrow) {
				records[arrow.id] = arrow;
			}
		});
	}

	if (diagram.whiteboard?.layers?.length) {
		diagram.whiteboard.layers.forEach((layer, index) => {
			const x = 120 + (index % 3) * 240;
			const y = 120 + Math.floor(index / 3) * 200;
			const shape = createGeoShape({
				x,
				y,
				width: 200,
				height: 160,
				palette,
				fill: 'rgba(249,115,22,0.14)',
				strokeDash: 'solid',
			});
			records[shape.id] = shape;

			const text = [layer.title, ...(layer.items ?? [])].filter(Boolean).join('\n');
			if (text) {
				const textShape = createTextShape({
					x: x + 18,
					y: y + 32,
					text,
					palette,
					fontSize: 16,
				});
				records[textShape.id] = textShape;
			}
		});
	}

	if (diagram.whiteboard?.callouts?.length) {
		diagram.whiteboard.callouts.forEach((callout, index) => {
			const x = 520;
			const y = 140 + index * 140;
			const shape = createGeoShape({
				x,
				y,
				width: 220,
				height: 100,
				palette,
				fill: 'rgba(96,165,250,0.14)',
				strokeDash: 'solid',
			});
			records[shape.id] = shape;
			const textShape = createTextShape({
				x: x + 18,
				y: y + 40,
				text: callout,
				palette,
			});
			records[textShape.id] = textShape;
		});
	}

	if (diagram.svgHints?.length) {
		let previousPosition: Position | null = null;
		diagram.svgHints.forEach((hint) => {
			if (hint.cmd === 'rect' && typeof hint.x === 'number' && typeof hint.y === 'number') {
				const shape = createGeoShape({
					x: hint.x,
					y: hint.y,
					width: hint.w ?? 180,
					height: hint.h ?? 120,
					palette,
					fill: 'rgba(148,163,184,0.18)',
					strokeDash: 'solid',
				});
				records[shape.id] = shape;
				previousPosition = {x: hint.x, y: hint.y};
			}
			if (hint.cmd === 'lineTo' && previousPosition && typeof hint.x === 'number' && typeof hint.y === 'number') {
				const arrow = createArrowShape({
					start: {x: previousPosition.x, y: previousPosition.y},
					end: {x: hint.x, y: hint.y},
					palette,
				});
				records[arrow.id] = arrow;
				previousPosition = {x: hint.x, y: hint.y};
			}
			if (hint.cmd === 'moveTo' && typeof hint.x === 'number' && typeof hint.y === 'number') {
				previousPosition = {x: hint.x, y: hint.y};
			}
			if (hint.cmd === 'text' && typeof hint.x === 'number' && typeof hint.y === 'number' && hint.text) {
				const hintedFontSize =
					typeof hint.style?.fontSize === 'number' && !Number.isNaN(hint.style.fontSize)
						? hint.style.fontSize
						: 18;
				const textShape = createTextShape({
					x: hint.x,
					y: hint.y,
					text: hint.text,
					palette,
					fontSize: hintedFontSize,
				});
				records[textShape.id] = textShape;
			}
		});
	}

	let createdRecords = Object.keys(records).length;

	if (!createdRecords) {
		const fallbackTexts = [
			diagram.notes,
			...(diagram.whiteboard?.callouts ?? []),
			...(diagram.whiteboard?.layers?.flatMap((layer) => [layer.title, ...(layer.items ?? [])]) ?? []),
			...(diagram.entities ?? []).map((entity) => entity.title ?? entity.id),
		]
			.filter((text): text is string => typeof text === 'string' && text.trim().length > 0)
			.map((text) => text.trim())
			.slice(0, 4);

		const safeFallbackTexts = fallbackTexts.length ? fallbackTexts : ['Key Idea 1', 'Example 2', 'Apply It'];
		const columns = Math.min(2, safeFallbackTexts.length);
		const rows = Math.ceil(safeFallbackTexts.length / columns);
		const canvasWidth = 960;
		const canvasHeight = 540;
		const marginX = 120;
		const marginY = 120;
		const columnWidth = (canvasWidth - marginX * 2) / Math.max(columns, 1);
		const rowHeight = (canvasHeight - marginY * 2) / Math.max(rows, 1);

		safeFallbackTexts.forEach((text, index) => {
			const col = index % columns;
			const row = Math.floor(index / columns);
			const width = 260;
			const height = 160;
			const x = marginX + col * columnWidth + (columnWidth - width) / 2;
			const y = marginY + row * rowHeight + (rowHeight - height) / 2;
			const sticky = createGeoShape({
				x,
				y,
				width,
				height,
				palette,
				fill: 'rgba(254,240,138,0.52)',
				strokeDash: 'solid',
			});
			records[sticky.id] = sticky;
			const textShape = createTextShape({
				x: x + 18,
				y: y + 48,
				text,
				palette,
				fontSize: 18,
			});
			records[textShape.id] = textShape;
		});

		const accentArrow = createArrowShape({
			start: {x: marginX + 40, y: marginY + rowHeight * 0.15},
			end: {x: marginX + columnWidth - 50, y: canvasHeight - marginY - rowHeight * 0.2},
			palette,
		});
		records[accentArrow.id] = accentArrow;

		createdRecords = Object.keys(records).length;
	}

	if (!createdRecords) {
		return undefined;
	}

	return {records} as TldrawSnapshot;
};
