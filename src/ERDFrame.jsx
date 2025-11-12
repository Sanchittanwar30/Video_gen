import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring, staticFile} from 'remotion';
import {STYLE_TOKENS, resolveTheme} from './styleConfig';
import type {ThemeTokens} from './styleConfig';
import type {PresentationDiagram, DiagramPointer, WhiteboardLayer} from './types/presentation';

const DEFAULT_ENTITY_WIDTH = 220;
const DEFAULT_ENTITY_HEIGHT = 130;
const ENTITY_MARGIN = 40;
const CANVAS_WIDTH = STYLE_TOKENS.canvas.width;
const CANVAS_HEIGHT = STYLE_TOKENS.canvas.height;
const CANVAS_MARGIN = 0;

const fallbackDiagram: PresentationDiagram = {
	type: 'erd',
	entities: [
		{
			id: 'user',
			title: 'User',
			fields: ['user_id (PK)', 'email', 'created_at'],
		},
		{
			id: 'order',
			title: 'Order',
			fields: ['order_id (PK)', 'user_id (FK)', 'total'],
		},
	],
	relationships: [{from: 'user', to: 'order', label: 'places'}],
	pointer: {
		mode: 'tap',
		target: 'order',
	},
};

const computeLayout = (entities: PresentationDiagram['entities'] = []) => {
	const count = entities.length || 1;
	const cols = Math.max(1, Math.min(3, Math.ceil(Math.sqrt(count))));
	const rows = Math.max(1, Math.ceil(count / cols));

	const availableWidth =
		CANVAS_WIDTH - CANVAS_MARGIN * 2 - ENTITY_MARGIN * (cols - 1);
	const availableHeight =
		CANVAS_HEIGHT - CANVAS_MARGIN * 2 - ENTITY_MARGIN * (rows - 1);

	const boxWidth = Math.max(
		160,
		Math.min(DEFAULT_ENTITY_WIDTH, availableWidth / cols)
	);
	const boxHeight = Math.max(
		110,
		Math.min(DEFAULT_ENTITY_HEIGHT + 20, availableHeight / rows)
	);

	return entities.map((entity, index) => {
		const row = Math.floor(index / cols);
		const col = index % cols;
		const x =
			CANVAS_MARGIN +
			col * (boxWidth + ENTITY_MARGIN);
		const y =
			CANVAS_MARGIN +
			row * (boxHeight + ENTITY_MARGIN);
		return {...entity, layout: {x, y, width: boxWidth, height: boxHeight}};
	});
};

export const computeAnchor = (entity, anchor = 'center') => {
	const {x, y, width = DEFAULT_ENTITY_WIDTH, height = DEFAULT_ENTITY_HEIGHT} =
		entity.layout ?? {};
	switch (anchor) {
		case 'top':
			return {x: x + width / 2, y};
		case 'bottom':
			return {x: x + width / 2, y: y + height};
		case 'left':
			return {x, y: y + height / 2};
		case 'right':
			return {x: x + width, y: y + height / 2};
		default:
			return {x: x + width / 2, y: y + height / 2};
	}
};

const pointerSprite = {
	size: 44,
	offset: {x: -22, y: -22},
};

const renderWhiteboardLayers = (layers = [], palette = {}, fontFamily) => {
	const {
		whiteboardNote,
		whiteboardOutline,
		textPrimary,
		textSecondary,
	} = palette;
	if (!layers.length) {
		return null;
	}

	const columnWidth = (CANVAS_WIDTH - CANVAS_MARGIN * 2) / layers.length;
	const notesTop = CANVAS_MARGIN + 60;

	return layers.map((layer, index) => {
		const x = CANVAS_MARGIN + index * columnWidth;
		return (
			<g key={layer.title} transform={`translate(${x}, ${notesTop})`}>
				<rect
					width={columnWidth - 36}
					height={240}
					fill={palette.whiteboardNote}
					stroke={palette.whiteboardOutline}
					rx={18}
					opacity={0.95}
				/>
				<text
					x={20}
					y={34}
					fontFamily={fontFamily}
					fontSize={18}
					fontWeight="600"
					fill={palette.textPrimary}
				>
					{layer.title}
				</text>
				{layer.items?.map((item, idx) => (
					<text
						key={item}
						x={20}
						y={60 + idx * 32}
						fontFamily={fontFamily}
						fontSize={STYLE_TOKENS.fonts.bodySize}
						fill={palette.textSecondary}
					>
						• {item}
					</text>
				))}
			</g>
		);
	});
};

const renderWhiteboardCallouts = (
	callouts = [],
	palette = {},
	fontFamily
) => {
	const {fill, stroke, text} = palette;
	if (!callouts.length) return null;
	const baseY = CANVAS_HEIGHT - CANVAS_MARGIN - 96;
	return callouts.map((callout, index) => (
		<g
			key={callout}
			transform={`translate(${CANVAS_MARGIN + index * 260}, ${baseY})`}
		>
			<rect width={240} height={66} rx={14} fill={fill} stroke={stroke} />
			<text
				x={20}
				y={38}
				fontFamily={fontFamily}
				fontSize={STYLE_TOKENS.fonts.bodySize}
				fill={text}
			>
				{callout}
			</text>
		</g>
	));
};

const renderWhiteboardScribbles = (layers = [], color) => {
	if (!layers.length) {
		return null;
	}
	return layers.map((_, idx) => {
		const offsetY = CANVAS_MARGIN + 32 + idx * 20;
		const path = `M ${CANVAS_MARGIN} ${offsetY}
			C ${CANVAS_MARGIN + 140} ${offsetY - 18},
			  ${CANVAS_WIDTH - CANVAS_MARGIN - 140} ${offsetY + 28},
			  ${CANVAS_WIDTH - CANVAS_MARGIN} ${offsetY}`;
		return (
			<path
				key={`scribble-${idx}`}
				d={path}
				fill="none"
				stroke={color}
				strokeWidth={2}
				strokeLinecap="round"
				strokeDasharray="10 6"
				opacity={0.45}
			/>
		);
	});
};

const renderRelationshipPath = (
	sourceAnchor,
	targetAnchor,
	label,
	key,
	relationshipColor,
	textColor,
	fontFamily,
	strokeDasharray,
	strokeDashoffset
) => {
	const horizontal =
		Math.abs(sourceAnchor.x - targetAnchor.x) >
		Math.abs(sourceAnchor.y - targetAnchor.y);

	const curveStrength = 0.45;
	const controlX = horizontal
		? sourceAnchor.x + (targetAnchor.x - sourceAnchor.x) * curveStrength
		: sourceAnchor.x + (targetAnchor.x - sourceAnchor.x) * 0.5;
	const controlY = horizontal
		? sourceAnchor.y
		: sourceAnchor.y + (targetAnchor.y - sourceAnchor.y) * curveStrength;
	const controlX2 = horizontal
		? targetAnchor.x - (targetAnchor.x - sourceAnchor.x) * curveStrength
		: targetAnchor.x;
	const controlY2 = horizontal
		? targetAnchor.y
		: targetAnchor.y - (targetAnchor.y - sourceAnchor.y) * curveStrength;

	const path = `M ${sourceAnchor.x} ${sourceAnchor.y} C ${controlX} ${controlY}, ${controlX2} ${controlY2}, ${targetAnchor.x} ${targetAnchor.y}`;

	return (
		<g key={key}>
			<path
				d={path}
				stroke={relationshipColor}
				strokeWidth={2}
				fill="none"
				markerEnd="url(#arrowhead)"
				strokeDasharray={strokeDasharray}
				strokeDashoffset={strokeDashoffset}
				opacity={0.9}
			/>
			{label ? (
				<text
					x={(sourceAnchor.x + targetAnchor.x) / 2}
					y={(sourceAnchor.y + targetAnchor.y) / 2 - 10}
					textAnchor="middle"
					fontFamily={fontFamily}
					fontSize={STYLE_TOKENS.fonts.relationshipSize}
					fill={textColor}
				>
					{label}
				</text>
			) : null}
		</g>
	);
};

export const ERDFrame = ({
	diagram = fallbackDiagram,
	pointerAsset,
	theme,
	fontFamily,
}: {
	diagram?: PresentationDiagram | null;
	pointerAsset?: string;
	theme?: ThemeTokens;
	fontFamily?: string;
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const diagramData: PresentationDiagram = diagram ?? fallbackDiagram;
	const themeTokens = resolveTheme(theme);
	const font = fontFamily ?? STYLE_TOKENS.fonts.baseFamily;
	const canvasMargin = CANVAS_MARGIN;
	const backgroundColor = themeTokens.background ?? STYLE_TOKENS.colors.background;
	const backgroundAccent =
		themeTokens.backgroundAccent ?? 'rgba(226,232,240,0.35)';
	const panelColor = themeTokens.card ?? STYLE_TOKENS.colors.panel;
	const panelBorder = themeTokens.cardBorder ?? STYLE_TOKENS.colors.panelBorder;
	const textPrimary = themeTokens.textPrimary ?? STYLE_TOKENS.colors.textPrimary;
	const textSecondary =
		themeTokens.textSecondary ?? STYLE_TOKENS.colors.textSecondary;
	const accentPrimary =
		themeTokens.accentPrimary ?? STYLE_TOKENS.colors.accent;
	const accentSecondary =
		themeTokens.accentSecondary ?? STYLE_TOKENS.colors.pointer;
	const accentMuted =
		themeTokens.accentMuted ?? 'rgba(37,99,235,0.14)';
	const relationshipColor =
		themeTokens.chartStroke ?? STYLE_TOKENS.colors.relationship;
	const whiteboardNote =
		themeTokens.whiteboardNote ?? STYLE_TOKENS.colors.whiteboardNote;
	const whiteboardOutline =
		themeTokens.whiteboardOutline ?? STYLE_TOKENS.colors.whiteboardOutline;
	const whiteboardScribble =
		themeTokens.whiteboardScribble ?? STYLE_TOKENS.colors.whiteboardScribble;
	const entities = useMemo(
		() => computeLayout(diagramData.entities),
		[diagramData.entities]
	);

	const entityMap = useMemo(() => {
		const map = new Map();
		entities.forEach((entity) => map.set(entity.id, entity));
		return map;
	}, [entities]);

	const pointerConfig = diagramData.pointer;

	const pointerState = useMemo(() => {
		if (!pointerConfig || pointerConfig.mode === 'none') {
			return null;
		}

		const durationSeconds = pointerConfig.durationSeconds ?? 1.2;

		const targetEntity = pointerConfig.target
			? entityMap.get(pointerConfig.target)
			: entities[0];
		const anchor = targetEntity
			? computeAnchor(targetEntity, pointerConfig.anchor)
			: undefined;

		const mapPoints = () =>
			pointerConfig.points?.map((point) => ({
				x: canvasMargin + point.x,
				y: canvasMargin + point.y,
			}));

		if (pointerConfig.mode === 'arrow') {
			const mappedPoints = mapPoints();
			const startPoint =
				anchor ??
				mappedPoints?.[0] ?? {
					x: CANVAS_WIDTH / 2,
					y: CANVAS_HEIGHT / 2,
				};
			const endPoint =
				(mappedPoints && mappedPoints.length > 1 ? mappedPoints[1] : mappedPoints?.[0]) ??
				(anchor
					? {
							x: anchor.x + 80,
							y: anchor.y - 20,
					  }
					: {
							x: startPoint.x + 80,
							y: startPoint.y - 20,
					  });
			return {
				type: 'arrow',
				start: startPoint,
				end: endPoint,
				color: pointerConfig.color ?? accentSecondary,
				durationSeconds,
			};
		}

		if (pointerConfig.mode === 'trace') {
			const tracePoints = mapPoints();
			if (tracePoints && tracePoints.length) {
				const pathPoints = anchor ? [anchor, ...tracePoints] : tracePoints;
				return {
					type: 'trace',
					points: pathPoints,
					color: pointerConfig.color ?? accentSecondary,
					durationSeconds,
				};
			}
		}

		const fallbackPosition =
			anchor ??
			mapPoints()?.[0] ?? {
				x: CANVAS_WIDTH / 2,
				y: CANVAS_HEIGHT / 2,
			};

		if (fallbackPosition) {
			return {
				type: 'hand',
				position: fallbackPosition,
				color: pointerConfig.color ?? accentSecondary,
				durationSeconds,
			};
		}

		return null;
	}, [pointerConfig, entities, entityMap, accentSecondary]);

	const pointerDuration = pointerState?.durationSeconds ?? 1.2;
	const pointerProgress = pointerState
		? Math.min(1, frame / Math.max(1, pointerDuration * fps))
		: 0;

	const polylineLength = (points) =>
		points.reduce((sum, point, idx) => {
			if (idx === 0) return sum;
			const prev = points[idx - 1];
			return sum + Math.hypot(point.x - prev.x, point.y - prev.y);
		}, 0);

	const pointAtDistance = (points, targetDistance) => {
		let travelled = 0;
		for (let i = 1; i < points.length; i++) {
			const start = points[i - 1];
			const end = points[i];
			const segment = Math.hypot(end.x - start.x, end.y - start.y);
			if (travelled + segment >= targetDistance) {
				const remaining = targetDistance - travelled;
				const ratio = segment === 0 ? 0 : remaining / segment;
				return {
					x: start.x + (end.x - start.x) * ratio,
					y: start.y + (end.y - start.y) * ratio,
				};
			}
			travelled += segment;
		}
		return points[points.length - 1];
	};

	const isWhiteboard = diagramData.type === 'whiteboard';
	const isERD = diagramData.type === 'erd' || !diagramData.type;
	const showGrid = isERD;

	return (
		<div
			style={{
				position: 'relative',
				width: CANVAS_WIDTH,
				height: CANVAS_HEIGHT,
				borderRadius: 24,
				boxShadow: '0 28px 70px rgba(15, 23, 42, 0.18)',
				background: backgroundColor,
				overflow: 'hidden',
			}}
		>
			<svg
				width={CANVAS_WIDTH}
				height={CANVAS_HEIGHT}
				viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
				style={{borderRadius: 24}}
			>
			<defs>
				{showGrid ? (
					<pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
						<path
							d="M 20 0 L 0 0 0 20"
							fill="none"
							stroke={backgroundAccent}
							strokeWidth="1"
						/>
					</pattern>
				) : null}
				<marker
					id="arrowhead"
					markerWidth="8"
					markerHeight="8"
					refX="4"
					refY="4"
					orient="auto"
					markerUnits="strokeWidth"
				>
					<polygon points="0 0, 8 4, 0 8" fill={relationshipColor} />
				</marker>
				<filter id="noteShadow" x="-20%" y="-20%" width="140%" height="140%">
					<feDropShadow
						dx="0"
						dy="10"
						stdDeviation="12"
						floodColor="rgba(15,23,42,0.3)"
					/>
				</filter>
				<clipPath id="board-clip">
					<rect
						x={canvasMargin}
						y={canvasMargin}
						width={CANVAS_WIDTH - canvasMargin * 2}
						height={CANVAS_HEIGHT - canvasMargin * 2}
						rx={18}
					/>
				</clipPath>
				<style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          text {
            font-family: ${font};
          }
        `}</style>
			</defs>

			<rect
				x="0"
				y="0"
				width={CANVAS_WIDTH}
				height={CANVAS_HEIGHT}
				fill={
					showGrid
						? 'url(#grid)'
						: diagramData.whiteboard?.background === 'dot'
						? backgroundAccent
						: backgroundColor
				}
			/>
			{diagramData.image ? (
				<image
					href={diagramData.image}
					x={canvasMargin}
					y={canvasMargin}
					width={CANVAS_WIDTH - canvasMargin * 2}
					height={CANVAS_HEIGHT - canvasMargin * 2}
					clipPath="url(#board-clip)"
					preserveAspectRatio="xMidYMid slice"
					opacity={0.88}
				/>
			) : null}

			{isWhiteboard ? (
				<>
					{renderWhiteboardScribbles(diagramData.whiteboard?.layers, whiteboardScribble)}
					{renderWhiteboardLayers(
						diagramData.whiteboard?.layers,
						{
							whiteboardNote,
							whiteboardOutline,
							textPrimary,
							textSecondary,
						},
						font
					)}
					{renderWhiteboardCallouts(
						diagramData.whiteboard?.callouts,
						{
							fill: accentMuted,
							stroke: `${accentPrimary}3d`,
							text: textPrimary,
						},
						font
					)}
				</>
			) : (
				<>
					{entities.map((entity) => (
						<g
							key={entity.id}
							transform={`translate(${entity.layout.x}, ${entity.layout.y})`}
						>
							<rect
								width={entity.layout.width ?? DEFAULT_ENTITY_WIDTH}
								height={entity.layout.height ?? DEFAULT_ENTITY_HEIGHT}
								fill={panelColor}
								rx="12"
								stroke={panelBorder}
								filter="url(#noteShadow)"
							/>
							<rect
								width={entity.layout.width ?? DEFAULT_ENTITY_WIDTH}
								height={entity.layout.height ?? DEFAULT_ENTITY_HEIGHT}
								fill="none"
								rx="12"
								stroke="rgba(220,38,38,0.65)"
								strokeWidth={2}
								strokeDasharray="10 6"
								pointerEvents="none"
							/>
							<text
								x={16}
								y={32}
								fontFamily={font}
								fontSize={STYLE_TOKENS.fonts.entityTitleSize}
								fontWeight="600"
								fill={textPrimary}
							>
								{entity.title ?? entity.id}
							</text>
							{entity.fields?.map((field, idx) => (
								<text
									key={field}
									x={16}
									y={54 + idx * 18}
									fontFamily={font}
									fontSize={STYLE_TOKENS.fonts.entityFieldSize}
									fill={textSecondary}
								>
									{field}
								</text>
							))}
						</g>
					))}

					{diagramData.relationships?.map((rel) => {
						const source = entityMap.get(rel.from);
						const target = entityMap.get(rel.to);
						if (!source || !target) return null;

						const sourceAnchor = computeAnchor(source, rel.fromAnchor ?? 'right');
						const targetAnchor = computeAnchor(target, rel.toAnchor ?? 'left');

						return renderRelationshipPath(
							sourceAnchor,
							targetAnchor,
							rel.label,
							`${rel.from}-${rel.to}`,
							relationshipColor,
							textSecondary,
							font
						);
					})}
				</>
			)}

			{pointerState?.type === 'arrow' && (() => {
				const dx = pointerState.end.x - pointerState.start.x;
				const dy = pointerState.end.y - pointerState.start.y;
				const length = Math.hypot(dx, dy) || 1;
				const dashOffset = length * (1 - pointerProgress);
				const easedOffset = Math.max(dashOffset, 0);
				return (
					<line
						x1={pointerState.start.x}
						y1={pointerState.start.y}
						x2={pointerState.end.x}
						y2={pointerState.end.y}
						stroke={pointerState.color}
						strokeWidth={4}
						strokeLinecap="round"
						markerEnd="url(#arrowhead)"
						strokeDasharray={length}
						strokeDashoffset={easedOffset}
					/>
				);
			})()}
			{pointerState?.type === 'trace' && (() => {
				const pathPoints = pointerState.points;
				const totalLength = polylineLength(pathPoints) || 1;
				const dashOffset = totalLength * (1 - pointerProgress);
				const easedOffset = Math.max(dashOffset, 0);
				const headPoint = pointAtDistance(pathPoints, totalLength * pointerProgress);
				return (
					<>
						<path
							d={pathPoints
								.map((point, idx) =>
									idx === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`
								)
								.join(' ')}
							fill="none"
							stroke={pointerState.color}
							strokeWidth={3}
							strokeLinecap="round"
							strokeDasharray={totalLength}
							strokeDashoffset={easedOffset}
						/>
						{headPoint ? (
							<circle
								cx={headPoint.x}
								cy={headPoint.y}
								r={10}
								fill={pointerState.color}
								opacity={0.8}
							/>
						) : null}
					</>
				);
			})()}
			{pointerState?.type === 'hand' && (() => {
				const scale = 0.9 + 0.15 * Math.sin(pointerProgress * Math.PI);
				return (
					<g
						transform={`translate(${pointerState.position.x + pointerSprite.offset.x}, ${
							pointerState.position.y + pointerSprite.offset.y
						}) scale(${scale})`}
						style={{opacity: 0.9}}
					>
						<image
							href={pointerAsset ?? staticFile('hand.svg')}
							width={pointerSprite.size}
							height={pointerSprite.size}
						/>
						<circle
							cx={pointerSprite.size / 2}
							cy={pointerSprite.size / 2}
							r={pointerSprite.size / 2}
							fill={pointerState.color}
							opacity={0.18}
						/>
					</g>
				);
			})()}
			</svg>
			{diagramData.excalidrawSvg ? (
				<div
					style={{
						position: 'absolute',
						inset: '8%',
						borderRadius: 18,
						overflow: 'hidden',
						boxShadow: '0 20px 40px rgba(15,23,42,0.16)',
						background: 'rgba(15,23,42,0.6)',
						padding: 16,
					}}
					dangerouslySetInnerHTML={{__html: diagramData.excalidrawSvg}}
				/>
			) : null}
		</div>
	);
};

