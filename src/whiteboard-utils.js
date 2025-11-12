/**
 * Utility helpers supporting the WhiteboardFrame renderer.
 * These helpers remain framework-agnostic so they can be reused in
 * validation scripts and other tooling.
 */

const VALID_COMMANDS = new Set([
	'moveTo',
	'lineTo',
	'rect',
	'circle',
	'text',
	'arc',
	'bezier',
]);

const TRACEABLE_TYPES = new Set(['path']);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const dist = (a, b) => Math.hypot((b.x ?? 0) - (a.x ?? 0), (b.y ?? 0) - (a.y ?? 0));

const lerp = (a, b, t) => ({
	x: a.x + (b.x - a.x) * t,
	y: a.y + (b.y - a.y) * t,
});

const cubicBezierPoint = (p0, p1, p2, p3, t) => {
	const mt = 1 - t;
	const a = mt * mt * mt;
	const b = 3 * mt * mt * t;
	const c = 3 * mt * t * t;
	const d = t * t * t;
	return {
		x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
		y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
	};
};

const approximateCubicLength = (p0, p1, p2, p3, steps = 12) => {
	let total = 0;
	let prev = p0;
	for (let i = 1; i <= steps; i += 1) {
		const t = i / steps;
		const point = cubicBezierPoint(p0, p1, p2, p3, t);
		total += dist(prev, point);
		prev = point;
	}
	return total;
};

const approximateArcLength = ({rx, ry, sweep, largeArc}) => {
	const radius = Math.max(rx, ry);
	const theta = (sweep ? 1 : -1) * (largeArc ? Math.PI : Math.PI / 2);
	return Math.abs(radius * theta * 1.1);
};

const finaliseCurrentPath = (currentPath, paths) => {
	if (!currentPath) {
		return null;
	}
	const length =
		currentPath.length ??
		currentPath.segments?.reduce((sum, seg) => sum + (seg.length ?? 0), 0) ??
		0;
	currentPath.length = length;
	if (!currentPath.bbox && length > 0) {
		const xs = [];
		const ys = [];
		currentPath.segments?.forEach((segment) => {
			const points =
				segment.type === 'line'
					? [segment.from, segment.to]
					: segment.type === 'bezier'
					? [segment.from, segment.cp1, segment.cp2, segment.to]
					: segment.type === 'arc'
					? [segment.from, segment.to]
					: [];
			points.forEach((point) => {
				if (point) {
					xs.push(point.x);
					ys.push(point.y);
				}
			});
		});
		if (xs.length && ys.length) {
			const minX = Math.min(...xs);
			const maxX = Math.max(...xs);
			const minY = Math.min(...ys);
			const maxY = Math.max(...ys);
			currentPath.bbox = {
				x: minX,
				y: minY,
				width: maxX - minX,
				height: maxY - minY,
			};
		}
	}
	paths.push(currentPath);
	return null;
};

export const parseSvgHintsToPaths = (svgHints = []) => {
	if (!Array.isArray(svgHints)) {
		return [];
	}

	const paths = [];
	let currentPath = null;
	let cursor = {x: 0, y: 0};

	svgHints.forEach((rawHint, index) => {
		const hint = rawHint ?? {};
		const cmd = typeof hint.cmd === 'string' ? hint.cmd : '';
		const style = hint.style ?? {};

		if (!VALID_COMMANDS.has(cmd)) {
			currentPath = finaliseCurrentPath(currentPath, paths);
			return;
		}

		const startNewPath = (point) => {
			currentPath = {
				id: `cmd-${index}`,
				type: 'path',
				d: `M ${point.x} ${point.y}`,
				cmdIndices: [index],
				style,
				segments: [],
				length: 0,
				drawable: true,
			};
		};

		switch (cmd) {
			case 'moveTo': {
				currentPath = finaliseCurrentPath(currentPath, paths);
				cursor = {x: hint.x ?? 0, y: hint.y ?? 0};
				startNewPath(cursor);
				break;
			}
			case 'lineTo': {
				if (!currentPath) {
					startNewPath(cursor);
				}
				const to = {x: hint.x ?? cursor.x, y: hint.y ?? cursor.y};
				currentPath.d += ` L ${to.x} ${to.y}`;
				const length = dist(cursor, to);
				currentPath.segments.push({
					type: 'line',
					from: {...cursor},
					to,
					length,
				});
				currentPath.length += length;
				currentPath.cmdIndices.push(index);
				cursor = to;
				break;
			}
			case 'bezier': {
				if (!currentPath) {
					startNewPath(cursor);
				}
				const points = Array.isArray(hint.points) ? hint.points : [];
				const cp1 = points[0] ?? {...cursor};
				const cp2 = points[1] ?? points[0] ?? {...cursor};
				const end = points[points.length - 1] ?? {...cursor};
				currentPath.d += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y}`;
				const length = approximateCubicLength(cursor, cp1, cp2, end);
				currentPath.segments.push({
					type: 'bezier',
					from: {...cursor},
					cp1,
					cp2,
					to: end,
					length,
				});
				currentPath.length += length;
				currentPath.cmdIndices.push(index);
				cursor = end;
				break;
			}
			case 'arc': {
				if (!currentPath) {
					startNewPath(cursor);
				}
				const to = {x: hint.x ?? cursor.x, y: hint.y ?? cursor.y};
				const rx = hint.rx ?? hint.r ?? 32;
				const ry = hint.ry ?? hint.r ?? rx;
				const rotation = hint.rotation ?? 0;
				const largeArc = hint.largeArc ? 1 : 0;
				const sweep = hint.sweep ?? 1;
				currentPath.d += ` A ${rx} ${ry} ${rotation} ${largeArc} ${sweep} ${to.x} ${to.y}`;
				const length = approximateArcLength({rx, ry, sweep, largeArc});
				currentPath.segments.push({
					type: 'arc',
					from: {...cursor},
					to,
					length,
				});
				currentPath.length += length;
				currentPath.cmdIndices.push(index);
				cursor = to;
				break;
			}
			case 'rect': {
				currentPath = finaliseCurrentPath(currentPath, paths);
				const x = hint.x ?? 0;
				const y = hint.y ?? 0;
				const w = hint.w ?? hint.width ?? 120;
				const h = hint.h ?? hint.height ?? 80;
				const segments = [
					{type: 'line', from: {x, y}, to: {x: x + w, y}, length: Math.abs(w)},
					{
						type: 'line',
						from: {x: x + w, y},
						to: {x: x + w, y: y + h},
						length: Math.abs(h),
					},
					{
						type: 'line',
						from: {x: x + w, y: y + h},
						to: {x, y: y + h},
						length: Math.abs(w),
					},
					{
						type: 'line',
						from: {x, y: y + h},
						to: {x, y},
						length: Math.abs(h),
					},
				];
				const rectPath = {
					id: `cmd-${index}`,
					type: 'path',
					d: `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`,
					style,
					cmdIndices: [index],
					drawable: true,
					length: 2 * (Math.abs(w) + Math.abs(h)),
					segments,
					bbox: {x, y, width: w, height: h},
				};
				paths.push(rectPath);
				cursor = {x, y};
				break;
			}
			case 'circle': {
				currentPath = finaliseCurrentPath(currentPath, paths);
				const cx = hint.cx ?? hint.x ?? 0;
				const cy = hint.cy ?? hint.y ?? 0;
				const r = hint.r ?? 48;
				const circlePath = {
					id: `cmd-${index}`,
					type: 'path',
					d: `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`,
					style,
					cmdIndices: [index],
					drawable: true,
					length: 2 * Math.PI * r,
					segments: [
						{
							type: 'arc',
							from: {x: cx - r, y: cy},
							to: {x: cx + r, y: cy},
							length: Math.PI * r,
						},
						{
							type: 'arc',
							from: {x: cx + r, y: cy},
							to: {x: cx - r, y: cy},
							length: Math.PI * r,
						},
					],
					bbox: {x: cx - r, y: cy - r, width: r * 2, height: r * 2},
				};
				paths.push(circlePath);
				cursor = {x: cx + r, y: cy};
				break;
			}
			case 'text': {
				currentPath = finaliseCurrentPath(currentPath, paths);
				const fontSize = hint.style?.fontSize ?? 18;
				const textPath = {
					id: `cmd-${index}`,
					type: 'text',
					text: hint.text ?? '',
					x: hint.x ?? 0,
					y: hint.y ?? 0,
					style,
					cmdIndices: [index],
					drawable: false,
					length: Math.max(40, (hint.text?.length ?? 8) * (fontSize * 0.45)),
					bbox: {
						x: hint.x ?? 0,
						y: (hint.y ?? 0) - fontSize,
						width: Math.max(80, (hint.text?.length ?? 8) * fontSize * 0.5),
						height: fontSize * 1.2,
					},
				};
				paths.push(textPath);
				break;
			}
			default: {
				currentPath = finaliseCurrentPath(currentPath, paths);
			}
		}
	});

	finaliseCurrentPath(currentPath, paths);

	const drawablePaths = paths.filter((path) => path.drawable !== false && path.type !== 'text');
	const totalLength =
		drawablePaths.reduce((sum, path) => sum + (path.length ?? 0), 0) || 1;

	drawablePaths.forEach((path) => {
		path.lengthShare = (path.length ?? 0) / totalLength;
	});

	return paths;
};

export const computeStrokeDuration = (path, totalDuration) => {
	const safeDuration = Math.max(0.1, totalDuration);
	const share =
		typeof path.lengthShare === 'number' && path.lengthShare > 0
			? path.lengthShare
			: 1 / Math.max(1, path.cmdIndices?.length ?? 1);

	return clamp(safeDuration * share, 0.2, safeDuration);
};

const evaluateSegment = (segment, t) => {
	switch (segment.type) {
		case 'line':
			return lerp(segment.from, segment.to, t);
		case 'bezier':
			return cubicBezierPoint(segment.from, segment.cp1, segment.cp2, segment.to, t);
		case 'arc':
			return lerp(segment.from, segment.to, t);
		default:
			return segment.to ?? segment.from;
	}
};

export const cmdIndexToPathPoint = (paths = [], cmdIndex, progress = 1) => {
	if (typeof cmdIndex !== 'number' || Number.isNaN(cmdIndex)) {
		return undefined;
	}

	const path = paths.find((candidate) =>
		Array.isArray(candidate.cmdIndices)
			? candidate.cmdIndices.includes(cmdIndex)
			: false
	);

	if (!path) {
		return undefined;
	}

	if (!TRACEABLE_TYPES.has(path.type)) {
		if (path.bbox) {
			return {
				x: path.bbox.x + (path.bbox.width ?? 0) / 2,
				y: path.bbox.y + (path.bbox.height ?? 0) / 2,
			};
		}
		return undefined;
	}

	const segments = path.segments ?? [];
	if (!segments.length || !path.length) {
		if (path.bbox) {
			return {
				x: path.bbox.x + (path.bbox.width ?? 0) / 2,
				y: path.bbox.y + (path.bbox.height ?? 0) / 2,
			};
		}
		return undefined;
	}

	const targetLength = (path.length ?? 0) * clamp(progress, 0, 1);
	let traversed = 0;

	for (const segment of segments) {
		const segLength = segment.length ?? 0;
		if (targetLength <= traversed + segLength) {
			const localT = segLength === 0 ? 1 : (targetLength - traversed) / segLength;
			return evaluateSegment(segment, localT);
		}
		traversed += segLength;
	}

	return evaluateSegment(segments[segments.length - 1], 1);
};

export const timeSecToFrame = (timeSec = 0, fps = 30) =>
	Math.max(0, Math.round(Number(timeSec) * fps));
