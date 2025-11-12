import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, spring} from 'remotion';
import {STYLE_TOKENS} from './styleConfig';
import penAsset from './hand-pen.svg';
import {
	parseSvgHintsToPaths,
	computeStrokeDuration,
	cmdIndexToPathPoint,
	timeSecToFrame,
} from './whiteboard-utils';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const DEFAULT_BG = '#F8FAFC';
const DEFAULT_STROKE = '#0F172A';
const DEFAULT_ACCENT = '#F97316';
const POINTER_WINDOW_SEC = 0.6;

const buildStrokeTimeline = (paths, durationSec, fps) => {
	const padding = Math.min(1, durationSec * 0.18);
	const drawBudget = Math.max(0.5, durationSec - padding);
	let cursor = 0;

	return paths
		.filter((path) => path.drawable !== false && path.type !== 'text')
		.map((path) => {
			const duration = Math.min(
				drawBudget - cursor,
				computeStrokeDuration(path, drawBudget)
			);
			const startSec = cursor;
			const endSec = Math.max(startSec + 0.01, Math.min(drawBudget, startSec + duration));
			cursor = endSec + 0.05;
			return {
				path,
				startSec,
				endSec,
				startFrame: Math.round(startSec * fps),
				endFrame: Math.max(Math.round(endSec * fps), Math.round(startSec * fps) + 1),
				primaryCmdIndex:
					path.cmdIndices?.[path.cmdIndices.length - 1] ?? path.cmdIndices?.[0],
			};
		});
};

const buildTextRevealTimeline = (paths, drawBudget, fps) =>
	paths
		.filter((path) => path.type === 'text')
		.map((path, index) => ({
			path,
			frame: Math.round((drawBudget + 0.2 + index * 0.2) * fps),
		}));

const resolveFocusTimeline = (focusEvents, fps) =>
	Array.isArray(focusEvents)
		? focusEvents.map((event, index) => ({
				...event,
				frame: timeSecToFrame(event.time ?? 0, fps),
				id: event.id ?? `focus-${index}`,
			}))
		: [];

const fallbackBoard = ({
	title,
	summary,
	entities = [],
	width,
	height,
	accent = DEFAULT_ACCENT,
	stroke = DEFAULT_STROKE,
	background = DEFAULT_BG,
}) => {
	const boxWidth = Math.min(240, width * 0.4);
	const gap = 24;
	return (
		<svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
			<rect width={width} height={height} fill={background} />
			<rect
				x={40}
				y={48}
				width={width - 80}
				height={height - 96}
				rx={28}
				fill="rgba(255,255,255,0.78)"
				stroke="rgba(15,23,42,0.08)"
				strokeWidth={2}
			/>
			<text
				x={Math.round(width * 0.08)}
				y={72}
				fontSize={26}
				fontWeight="700"
				fill={stroke}
			>
				{title}
			</text>
			<text
				x={Math.round(width * 0.08)}
				y={108}
				fontSize={18}
				fill={stroke}
				opacity={0.75}
			>
				{summary}
			</text>
			{(entities ?? []).slice(0, 3).map((entity, index) => {
				const x = Math.round(width * 0.08) + index * (boxWidth + gap);
				const y = Math.round(height * 0.45);
				return (
					<g key={entity?.id ?? index}>
				<rect
							x={x}
							y={y}
							width={boxWidth}
							height={120}
							rx={14}
							fill="#ffffff"
					stroke={stroke}
					strokeWidth={3}
							opacity={0.92}
						/>
						<text
							x={x + 16}
							y={y + 28}
							fontSize={18}
							fontWeight="600"
					fill={stroke}
						>
							{entity?.title ?? entity?.id ?? 'Entity'}
						</text>
						{(entity?.fields ?? []).slice(0, 3).map((field, fieldIndex) => (
							<text
								key={field}
								x={x + 16}
								y={y + 54 + fieldIndex * 22}
								fontSize={15}
							fill={stroke}
								opacity={0.75}
							>
								• {field}
							</text>
						))}
					</g>
				);
			})}
		</svg>
	);
};

const resolveStrokeStyle = (path, palette) => ({
	stroke: path.style?.stroke ?? palette.stroke,
	strokeWidth: path.style?.strokeWidth ?? palette.strokeWidth,
	strokeLinecap: path.style?.strokeLinecap ?? 'round',
	strokeLinejoin: path.style?.strokeLinejoin ?? 'round',
	fill: path.style?.fill ?? 'none',
	opacity: path.style?.opacity ?? 1,
	dashArray: path.style?.sketchy ? '6 4' : undefined,
});

const findTracedPath = (paths, activeFocus) => {
	if (!activeFocus || activeFocus.action !== 'trace') {
		return undefined;
	}
	const cmdIndex = activeFocus.target?.cmdIndex;
	if (typeof cmdIndex !== 'number') {
		return undefined;
	}
	return paths.find((candidate) =>
		candidate.cmdIndices?.includes(cmdIndex)
	);
};

const pointerFromSegment = (paths, segment, frame) => {
	if (!segment) {
		return undefined;
	}
	const totalFrames = segment.endFrame - segment.startFrame;
	const progress = clamp(
		(segment.endFrame - segment.startFrame) === 0
			? 1
			: (frame - segment.startFrame) / totalFrames,
		0,
		1
	);
	const cmdIndex = segment.primaryCmdIndex;
	if (typeof cmdIndex !== 'number') {
		return undefined;
	}
	return cmdIndexToPathPoint(paths, cmdIndex, progress);
};

const pointerFromFocus = (paths, focus, frame, fps) => {
	if (!focus) {
		return undefined;
	}
	const target = focus.target ?? {};
	if (typeof target.cmdIndex === 'number') {
		const focusWindow = Math.max(4, Math.round(POINTER_WINDOW_SEC * fps));
		const focusElapsed = clamp((frame - focus.frame) / focusWindow, 0, 1);
		return cmdIndexToPathPoint(paths, target.cmdIndex, focus.action === 'trace' ? focusElapsed : 1);
	}
	if (typeof target.x === 'number' && typeof target.y === 'number') {
		return {x: target.x, y: target.y};
	}
	return undefined;
};

const WhiteboardFrame = ({
	chapter,
	mode = 'whiteboard',
	width = STYLE_TOKENS.canvas.width,
	height = STYLE_TOKENS.canvas.height,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const diagram = chapter?.diagram ?? {};
	const boardStyle = diagram.style ?? {};
	const boardBackground = boardStyle.background ?? DEFAULT_BG;
	const boardStroke = boardStyle.stroke ?? DEFAULT_STROKE;
	const boardStrokeWidth = boardStyle.strokeWidth ?? 3;
	const boardAccent = boardStyle.accent ?? DEFAULT_ACCENT;
	const pointerAccent = diagram.pointer?.color ?? boardStyle.pointerColor ?? boardAccent;

	if (mode === 'image' && diagram.image) {
		return (
			<div style={{width, height, borderRadius: 24, overflow: 'hidden'}}>
				<img src={diagram.image} alt={chapter?.title ?? 'diagram'} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
			</div>
		);
	}

	const durationSec =
		chapter?.durationSeconds ??
		diagram.durationSeconds ??
		chapter?.voiceoverDurationSeconds ??
		6;

	const svgHints = Array.isArray(diagram.svgHints) ? diagram.svgHints : [];
	const parsedPaths = useMemo(
		() => parseSvgHintsToPaths(svgHints),
		[svgHints]
	);

	if (!parsedPaths.length) {
		return fallbackBoard({
			title: chapter?.title ?? 'Whiteboard Scene',
			summary: chapter?.summary ?? '',
			entities: diagram.entities,
			width,
			height,
			accent: boardAccent,
			stroke: boardStroke,
			background: boardBackground,
		});
	}

	const focusTimeline = useMemo(
		() => resolveFocusTimeline(diagram.focusEvents, fps),
		[diagram.focusEvents, fps]
	);

	const strokeTimeline = useMemo(
		() => buildStrokeTimeline(parsedPaths, durationSec, fps),
		[parsedPaths, durationSec, fps]
	);

	const drawBudget = Math.max(0.5, durationSec - Math.min(1, durationSec * 0.18));
	const textTimeline = useMemo(
		() => buildTextRevealTimeline(parsedPaths, drawBudget, fps),
		[parsedPaths, drawBudget, fps]
	);

	const activeSegment = strokeTimeline.find(
		(segment) => frame >= segment.startFrame && frame <= segment.endFrame
	);

	const focusWindowFrames = Math.max(6, Math.round(POINTER_WINDOW_SEC * fps));
	const activeFocus = focusTimeline.find(
		(event) => frame >= event.frame && frame <= event.frame + focusWindowFrames
	);

	const segmentProgress = activeSegment
		? clamp(
				(frame - activeSegment.startFrame) /
					(activeSegment.endFrame - activeSegment.startFrame || 1),
				0,
				1
		  )
		: undefined;
	const focusProgress = activeFocus
		? clamp((frame - activeFocus.frame) / focusWindowFrames, 0, 1)
		: undefined;

	const pointerFromStroke = pointerFromSegment(parsedPaths, activeSegment, frame);
	const pointerFromFocusEvent = pointerFromFocus(parsedPaths, activeFocus, frame, fps);
	const pointerPosition = pointerFromFocusEvent ?? pointerFromStroke;

	const pointerVisible = Boolean(pointerPosition);
	const pointerBounce = activeFocus && activeFocus.action === 'tap'
		? spring({
			frame: frame - activeFocus.frame,
			fps,
			config: {damping: 200, stiffness: 420, mass: 0.8},
		})
		: 0;

	const tracedPath = findTracedPath(parsedPaths, activeFocus);
	const pointerAngle = (() => {
		if (!pointerPosition) {
			return undefined;
		}
		let referenceCmdIndex: number | undefined;
		let referenceProgress: number | undefined;

		if (
			typeof activeFocus?.target?.cmdIndex === 'number' &&
			(activeFocus.action === 'trace' || activeFocus.action === 'point' || activeFocus.action === 'tap')
		) {
			referenceCmdIndex = activeFocus.target.cmdIndex;
			referenceProgress =
				activeFocus.action === 'trace'
					? Math.max(0, (focusProgress ?? 0) - 0.05)
					: Math.max(0, (focusProgress ?? 0) - 0.02);
		} else if (typeof activeSegment?.primaryCmdIndex === 'number') {
			referenceCmdIndex = activeSegment.primaryCmdIndex;
			referenceProgress = Math.max(0, (segmentProgress ?? 0) - 0.05);
		}

		if (referenceCmdIndex === undefined) {
			return undefined;
		}
		const previousPoint = cmdIndexToPathPoint(parsedPaths, referenceCmdIndex, referenceProgress ?? 0);
		if (!previousPoint) {
			return undefined;
		}
		return Math.atan2(pointerPosition.y - previousPoint.y, pointerPosition.x - previousPoint.x);
	})();

	const pointerScale =
		activeFocus && activeFocus.action === 'tap'
			? 0.92 + pointerBounce * 0.25
			: 1;

	return (
		<AbsoluteFill
			style={{
				width,
				height,
				position: 'relative',
				filter: 'drop-shadow(0 20px 40px rgba(15,23,42,0.16))',
				borderRadius: 28,
				overflow: 'hidden',
				background: diagram.style?.background ?? DEFAULT_BG,
			}}
		>
			<svg
				width={width}
				height={height}
				viewBox={`0 0 ${width} ${height}`}
				preserveAspectRatio="xMidYMid meet"
			>
				<rect width={width} height={height} fill={boardBackground} />
				<rect
					x={32}
					y={44}
					width={width - 64}
					height={height - 88}
					rx={28}
					fill="rgba(255,255,255,0.8)"
					stroke="rgba(15,23,42,0.08)"
					strokeWidth={2}
				/>
				{parsedPaths.map((path) => {
					const style = resolveStrokeStyle(path, {
						stroke: boardStroke,
						strokeWidth: boardStrokeWidth,
					});
					const timelineEntry = strokeTimeline.find((segment) => segment.path === path);

					if (path.type === 'text') {
						const revealFrame = textTimeline.find((entry) => entry.path === path)?.frame ?? 0;
						const visible = frame >= revealFrame;
						return (
							<text
								key={path.id}
								x={path.x}
								y={path.y}
								fontSize={path.style?.fontSize ?? 20}
								fontWeight={path.style?.fontWeight ?? 500}
								fill={path.style?.fill ?? DEFAULT_STROKE}
								opacity={visible ? 1 : 0}
							>
								{path.text}
							</text>
						);
					}

					const length = path.length ?? 600;
					const dashArray = style.dashArray ?? length;
					let dashOffset = dashArray;
					if (timelineEntry) {
						const {startFrame, endFrame} = timelineEntry;
						const progress = clamp(
							(frame - startFrame) / (endFrame - startFrame || 1),
							0,
							1
						);
						dashOffset = dashArray * (1 - progress);
					}

					const highlight = tracedPath && tracedPath.id === path.id;
					const strokeColor = highlight ? pointerAccent : style.stroke;
					return (
						<path
							key={path.id}
							d={path.d}
							fill={style.fill}
							stroke={strokeColor}
							strokeWidth={highlight ? (style.strokeWidth ?? 3) * 1.35 : style.strokeWidth}
							strokeLinecap={style.strokeLinecap}
							strokeLinejoin={style.strokeLinejoin}
							vectorEffect="non-scaling-stroke"
							opacity={style.opacity}
							strokeDasharray={dashArray}
							strokeDashoffset={dashOffset}
						/>
					);
				})}
			</svg>
			{pointerVisible ? (
				<div
					style={{
						position: 'absolute',
						top: (pointerPosition?.y ?? height / 2) - 24,
						left: (pointerPosition?.x ?? width / 2) - 24,
						width: 48,
						height: 48,
						pointerEvents: 'none',
						transform: `rotate(${pointerAngle ?? 0}rad) scale(${pointerScale})`,
						transformOrigin: '24px 24px',
						transition: 'transform 90ms ease-out',
					}}
				>
					<img src={penAsset} alt="pointer" style={{width: '100%', height: '100%'}} />
					{activeFocus && activeFocus.action === 'point' ? (
						<div
							style={{
								position: 'absolute',
								top: 8,
								left: 8,
								width: 32,
								height: 32,
								borderRadius: '50%',
								boxShadow: `0 0 0 2px ${pointerAccent}AA`,
								opacity: 0.7,
							}}
						/>
					) : null}
				</div>
			) : null}
			{diagram?.excalidrawSvg ? (
				<div
					style={{
						position: 'absolute',
						inset: '6%',
						borderRadius: 24,
						overflow: 'hidden',
						pointerEvents: 'none',
						opacity: 0.96,
					}}
					dangerouslySetInnerHTML={{__html: diagram.excalidrawSvg}}
				/>
			) : null}
		</AbsoluteFill>
	);
};

export {parseSvgHintsToPaths} from './whiteboard-utils';
export default WhiteboardFrame;
