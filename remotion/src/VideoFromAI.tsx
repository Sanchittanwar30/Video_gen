import React from 'react';
import {
	AbsoluteFill,
	Sequence,
	Img,
	Video,
	Audio,
	useCurrentFrame,
	useVideoConfig,
	Easing,
	interpolate,
	staticFile,
} from 'remotion';
import { WhiteboardAnimatorPrecise } from '../../src/WhiteboardAnimatorPrecise';

export interface AIVideoFrame {
	id: string;
	type: 'whiteboard_diagram' | 'text_slide' | 'bullet_slide' | 'motion_scene';
	heading?: string;
	text?: string;
	// Optional: authoring-time raw texts; we will auto-truncate for readability
	bullets?: string[];
	duration?: number;
	asset?: string;
	animate?: boolean;
	vectorized?: {
		svgUrl: string;
		width: number;
		height: number;
	};
	// Optional: multiple vectorized items to compose a grid/montage
	vectorizedList?: Array<{
		svgUrl: string;
		width: number;
		height: number;
	}>;
	// Optional: multiple image assets for montage
	assetsList?: string[];
	voiceoverUrl?: string;
	voiceoverScript?: string;
	svgString?: string; // Pre-loaded SVG string content (loaded before render)
}

export interface AIVideoData {
	title: string;
	frames: AIVideoFrame[];
}

// Reduce text length for better readability in teaching flow
const truncateForDisplay = (value: string | undefined, maxChars: number): string | undefined => {
	if (!value) return value;
	const trimmed = value.trim();
	if (trimmed.length <= maxChars) return trimmed;
	// Try to cut at a word boundary
	const slice = trimmed.slice(0, maxChars);
	const lastSpace = slice.lastIndexOf(' ');
	const cut = lastSpace > 40 ? slice.slice(0, lastSpace) : slice;
	return `${cut}…`;
};

export const calculatePlanDurationInFrames = (plan: AIVideoData, fps: number): number => {
	const total = (plan.frames ?? []).reduce((sum, frame) => {
		// Whiteboard diagrams get 18 seconds total: ~65% for sketching phase, ~35% for hold/zoom phase
		// Other frames use their specified duration or default to 4 seconds
		let seconds: number;
		if (frame.type === 'whiteboard_diagram') {
			seconds = 18; // 18 seconds: lengthy sketch phase (~11.7s) + hold/zoom phase (~6.3s)
		} else {
			seconds = typeof frame.duration === 'number' && frame.duration > 0 ? frame.duration : 4;
		}
		return sum + Math.max(1, Math.round(seconds * fps));
	}, 0);
	return total > 0 ? total : Math.round(4 * fps);
};

const FALLBACK_PLAN: AIVideoData = {
	title: 'AI Storyboard',
	frames: [],
};

const TextSlide: React.FC<{frame: AIVideoFrame; startFrame: number; durationInFrames: number}> = ({
	frame,
	startFrame,
	durationInFrames,
}) => {
	const currentFrame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const progress = interpolate(
		currentFrame - startFrame,
		[0, Math.max(6, Math.round(0.5 * fps))],
		[0, 1],
		{
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
			easing: Easing.out(Easing.ease),
		}
	);

	return (
		<div
			style={{
				width: '100%',
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				padding: '120px',
				background: '#ffffff',
				color: '#0f172a',
				opacity: progress,
				transform: `translateY(${(1 - progress) * 35}px)`,
			}}
		>
			{frame.heading ? (
				<h1
					style={{
						fontSize: 72,
						fontWeight: 900,
						marginBottom: 28,
						textAlign: 'center',
						color: '#000',
						letterSpacing: 0,
						textRendering: 'geometricPrecision',
						WebkitTextStroke: '0.3px #000',
						textShadow: '0 0 1px #000, 0 0 0.5px #000',
						WebkitFontSmoothing: 'antialiased',
						MozOsxFontSmoothing: 'grayscale',
					}}
				>
					{truncateForDisplay(frame.heading, 70)}
				</h1>
			) : null}
			{frame.text ? (
				<p
					style={{
						fontSize: 40,
						lineHeight: 1.35,
						maxWidth: 900,
						textAlign: 'center',
						color: '#000',
						fontWeight: 900,
						letterSpacing: 0,
						textRendering: 'geometricPrecision',
						WebkitTextStroke: '0.25px #000',
						textShadow: '0 0 1px #000, 0 0 0.5px #000',
						WebkitFontSmoothing: 'antialiased',
						MozOsxFontSmoothing: 'grayscale',
					}}
				>
					{truncateForDisplay(frame.text, 140)}
				</p>
			) : null}
		</div>
	);
};

const BulletSlide: React.FC<{
	frame: AIVideoFrame;
	startFrame: number;
	durationInFrames: number;
}> = ({frame, startFrame}) => {
	const currentFrame = useCurrentFrame();
	const {fps} = useVideoConfig();

	return (
		<div
			style={{
				width: '100%',
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				padding: '120px',
				background: '#ffffff',
				color: '#0f172a',
			}}
		>
			{frame.heading ? (
				<h1
					style={{
						fontSize: 68,
						fontWeight: 900,
						marginBottom: 28,
						textAlign: 'center',
						color: '#000',
						letterSpacing: 0,
						textRendering: 'geometricPrecision',
						WebkitTextStroke: '0.3px #000',
						textShadow: '0 0 1px #000, 0 0 0.5px #000',
						WebkitFontSmoothing: 'antialiased',
						MozOsxFontSmoothing: 'grayscale',
					}}
				>
					{truncateForDisplay(frame.heading, 70)}
				</h1>
			) : null}
			<ul
				style={{
					listStyle: 'disc',
					paddingLeft: 24,
					margin: 0,
					display: 'flex',
					flexDirection: 'column',
					gap: 18,
					maxWidth: 900,
				}}
			>
				{(frame.bullets ?? []).map((bullet, index) => {
					const appearFrame = startFrame + Math.round(index * fps * 0.7);
					const progress = interpolate(currentFrame - appearFrame, [0, fps * 0.4], [0, 1], {
						extrapolateLeft: 'clamp',
						extrapolateRight: 'clamp',
						easing: Easing.out(Easing.ease),
					});
					return (
						<li
							key={`${frame.id}-bullet-${index}`}
							style={{
								fontSize: 34,
								lineHeight: 1.4,
								opacity: progress,
								transform: `translateY(${(1 - progress) * 15}px)`,
								color: '#000',
								fontWeight: 900,
								letterSpacing: 0,
								textRendering: 'geometricPrecision',
								WebkitTextStroke: '0.2px #000',
								textShadow: '0 0 1px #000, 0 0 0.5px #000',
								WebkitFontSmoothing: 'antialiased',
								MozOsxFontSmoothing: 'grayscale',
							}}
						>
							{truncateForDisplay(bullet, 80)}
						</li>
					);
				})}
			</ul>
		</div>
	);
};

// Helper component to animate a single path with natural easing
const AnimatedPath: React.FC<{d: string; progress: number}> = ({d, progress}) => {
	const pathRef = React.useRef<SVGPathElement>(null);
	const [pathLength, setPathLength] = React.useState(1000);

	React.useEffect(() => {
		if (pathRef.current) {
			const length = pathRef.current.getTotalLength();
			setPathLength(length || 1000);
		}
	}, [d]);

	// Apply EXTREMELY slow easing for very slow pen tracing
	// Multiple very slow curves to make each path feel very carefully and slowly drawn
	const easedProgress1 = interpolate(progress, [0, 1], [0, 1], {
		easing: Easing.bezier(0.05, 0.0, 0.01, 1), // Extremely slow, very deliberate
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	
	const easedProgress2 = interpolate(easedProgress1, [0, 1], [0, 1], {
		easing: Easing.bezier(0.1, 0.0, 0.05, 1), // Additional extremely slow curve
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	
	const easedProgress = interpolate(easedProgress2, [0, 1], [0, 1], {
		easing: Easing.bezier(0.15, 0.0, 0.1, 1), // Third slow curve for maximum slowness
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	return (
		<path
			ref={pathRef}
			d={d}
			style={{
				opacity: 1,
				strokeDasharray: pathLength,
				strokeDashoffset: pathLength * (1 - easedProgress),
			}}
		/>
	);
};

const SketchingSVG: React.FC<{
	svgUrl: string;
	width: number;
	height: number;
	durationInFrames: number;
	fallbackImage?: string;
}> = ({svgUrl, width, height, durationInFrames, fallbackImage}) => {
	const currentFrame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const [svgContent, setSvgContent] = React.useState<string | null>(null);
	const [paths, setPaths] = React.useState<string[]>([]);
	const [loadError, setLoadError] = React.useState(false);

	// Load SVG content
	React.useEffect(() => {
		const loadSvg = async (url: string) => {
			try {
				const res = await fetch(url, {
					mode: 'cors',
					credentials: 'omit',
				});
				if (!res.ok) {
					throw new Error(`HTTP ${res.status}: ${res.statusText}`);
				}
				const text = await res.text();
				setSvgContent(text);
			// Extract all path elements and sort by position (top-left to bottom-right)
			const parser = new DOMParser();
			const doc = parser.parseFromString(text, 'image/svg+xml');
			const pathElements = doc.querySelectorAll('path');
			const pathData: Array<{d: string; startY: number; startX: number}> = [];
			
			pathElements.forEach((path) => {
				const d = path.getAttribute('d');
				if (d) {
					// Split a single path into segments on Move commands to enforce strict top-to-bottom
					const parts: string[] = [];
					let current = '';
					for (let i = 0; i < d.length; i++) {
						const ch = d[i];
						if ((ch === 'M' || ch === 'm') && current.trim()) {
							parts.push(current.trim());
							current = ch;
						} else {
							current += ch;
						}
					}
					if (current.trim()) parts.push(current.trim());
					const segments = parts.length > 0 ? parts : [d];

					segments.forEach(seg => {
						const match = seg.match(/^[Mm]\s*([-\d.]+)[,\s]+([-\d.]+)/);
						const startX = match ? parseFloat(match[1]) || 0 : 0;
						const startY = match ? parseFloat(match[2]) || 0 : 0;
						pathData.push({ d: seg, startX, startY });
					});
				}
			});
			
			// Sort paths by position: top to bottom, then left to right
			pathData.sort((a, b) => {
				// First sort by Y (top to bottom)
				const yDiff = a.startY - b.startY;
				if (Math.abs(yDiff) > 10) {
					// If Y difference is significant (>10px), sort by Y
					return yDiff;
				}
				// If Y is similar, sort by X (left to right)
				return a.startX - b.startX;
			});
			
			const sortedPaths = pathData.map(p => p.d);
			setPaths(sortedPaths);
			} catch (err) {
				throw err;
			}
		};

		// Try absolute URL first (works in Remotion renderer)
		const absoluteUrl = svgUrl.startsWith('http')
			? svgUrl
			: `http://localhost:3000${svgUrl}`;
		
		loadSvg(absoluteUrl).catch(() => {
			// Fallback to relative URL if absolute fails
			loadSvg(svgUrl).catch((err) => {
				console.error('[SketchingSVG] Failed to load SVG:', err);
				setLoadError(true);
			});
		});
	}, [svgUrl]);

	// Fallback to original image if SVG fails to load
	if (loadError && fallbackImage) {
		console.warn('[SketchingSVG] Falling back to original image');
		return (
			<Img
				src={fallbackImage}
				style={{
					width: '100%',
					height: '100%',
					objectFit: 'contain',
					backgroundColor: '#ffffff',
				}}
			/>
		);
	}

	if (!svgContent || paths.length === 0) {
		return (
			<div style={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
				<div style={{color: '#475569'}}>Loading sketch...</div>
			</div>
		);
	}

	// Calculate which paths should be visible - real sketching experience
	// Split scene into two phases:
	// Phase 1: Sketch animation (80% of scene duration) - hand-drawn look, slower
	// Phase 2: Hold + zoom (20% of scene duration) - completed sketch with camera movement
	const sketchPhaseRatio = 0.8; // Use 80% of scene for sketching (slower draw)
	const sketchPhaseDurationInFrames = Math.floor(durationInFrames * sketchPhaseRatio);
	const holdPhaseDurationInFrames = durationInFrames - sketchPhaseDurationInFrames;
	
	// Add a brief delay before starting to draw (pen positioning and preparation)
	const delayFrames = Math.floor(fps * 0.3); // 0.3 second delay for anticipation
	const drawingStartFrame = delayFrames;
	const drawingDurationFrames = sketchPhaseDurationInFrames - delayFrames; // Rest of sketch phase for drawing
	
	// Determine if we're in sketch phase or hold phase
	const isSketchPhase = currentFrame < sketchPhaseDurationInFrames;
	const isHoldPhase = currentFrame >= sketchPhaseDurationInFrames;
	
	// Calculate progress: 0 during delay, then 0-1 during drawing
	// Ensure it's truly progressive - no immediate jumps
	let rawProgress = 0;
	if (currentFrame >= drawingStartFrame && isSketchPhase) {
		const drawingFrame = currentFrame - drawingStartFrame;
		rawProgress = Math.min(1, Math.max(0, drawingFrame / drawingDurationFrames));
	} else if (isHoldPhase) {
		// In hold phase, sketch is complete
		rawProgress = 1;
	}
	
	// Apply EXTREMELY slow, smooth easing for very deliberate, progressive pen tracing
	// Multiple very slow curves to create unhurried, careful, continuous pen movement
	const slowProgress1 = interpolate(rawProgress, [0, 1], [0, 1], {
		easing: Easing.bezier(0.05, 0.0, 0.01, 1), // Extremely slow, smooth start
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	
	const slowProgress2 = interpolate(slowProgress1, [0, 1], [0, 1], {
		easing: Easing.bezier(0.1, 0.0, 0.03, 1), // Additional very slow, smooth curve
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	
	const slowProgress3 = interpolate(slowProgress2, [0, 1], [0, 1], {
		easing: Easing.bezier(0.15, 0.0, 0.05, 1), // Third slow, smooth curve
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	
	// Final slow, smooth curve for maximum progressive slowness
	const progress = interpolate(slowProgress3, [0, 1], [0, 1], {
		easing: Easing.bezier(0.2, 0.0, 0.1, 1), // Smooth, extremely slow, progressive
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	// Animate paths SEQUENTIALLY (one after another) - progressive top-left to bottom-right
	// Each path gets equal time, with minimal pauses for continuous flow
	const pathCount = paths.length;
	const pauseBetweenPaths = 0.02; // 2% minimal pause for continuous flow (was 5%)
	const totalPauseTime = pauseBetweenPaths * Math.max(0, pathCount - 1);
	const availableTime = 1 - totalPauseTime;
	const timePerPath = availableTime / Math.max(1, pathCount);
	
	// Calculate which path is currently being drawn
	let currentPathIndex = 0;
	let accumulatedProgress = 0;
	
	for (let i = 0; i < pathCount; i++) {
		const pathStart = accumulatedProgress;
		const pathEnd = accumulatedProgress + timePerPath;
		
		if (progress >= pathStart && progress < pathEnd) {
			currentPathIndex = i;
			break;
		}
		
		accumulatedProgress = pathEnd + pauseBetweenPaths;
		if (i === pathCount - 1) {
			currentPathIndex = pathCount - 1;
		}
	}
	
	// Clamp to valid range
	if (currentPathIndex >= pathCount) {
		currentPathIndex = pathCount - 1;
	}
	
	// Calculate path start position accounting for pauses
	let pathStartProgress = 0;
	for (let i = 0; i < currentPathIndex; i++) {
		pathStartProgress += timePerPath + pauseBetweenPaths;
	}
	const pathEndProgress = pathStartProgress + timePerPath;
	
	// Progress within the current path (0 to 1)
	let currentPathProgress = 0;
	if (pathCount > 0 && progress >= pathStartProgress && progress < pathEndProgress) {
		currentPathProgress = Math.min(1, Math.max(0, (progress - pathStartProgress) / timePerPath));
	} else if (progress >= pathEndProgress) {
		currentPathProgress = 1;
	}
	
	// Determine completed paths: if current path is fully drawn, include it
	// In hold phase, all paths are completed
	const completedPathCount = isHoldPhase 
		? paths.length 
		: (currentPathProgress >= 1 ? currentPathIndex + 1 : currentPathIndex);

	// Zoom animation: subtle zoom during sketch, then more pronounced zoom during hold phase
	let zoomProgress = 1;
	if (isSketchPhase) {
		// Subtle zoom during sketch phase (gentle zoom in)
		zoomProgress = interpolate(
			currentFrame,
			[0, sketchPhaseDurationInFrames * 0.4],
			[1, 1.03],
			{
				easing: Easing.out(Easing.ease),
				extrapolateLeft: 'clamp',
				extrapolateRight: 'clamp',
			}
		);
	} else if (isHoldPhase) {
		// More pronounced zoom during hold phase (camera movement)
		const holdPhaseFrame = currentFrame - sketchPhaseDurationInFrames;
		const holdProgress = Math.min(1, holdPhaseFrame / holdPhaseDurationInFrames);
		zoomProgress = interpolate(
			holdProgress,
			[0, 1],
			[1.03, 1.08], // Continue zooming in during hold phase
			{
				easing: Easing.inOut(Easing.ease),
				extrapolateLeft: 'clamp',
				extrapolateRight: 'clamp',
			}
		);
	}

	return (
		<AbsoluteFill
			style={{
				backgroundColor: '#0d5c2f', // Green board/chalkboard color
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				padding: '0.5%', // Minimal padding
			}}
		>
			<div
				style={{
					transform: `scale(${zoomProgress})`,
					transition: 'transform 0.5s ease-out',
					width: '100%',
					height: '100%',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<svg
					width={width}
					height={height}
					viewBox={`0 0 ${width} ${height}`}
					preserveAspectRatio="xMidYMid meet"
					style={{
						maxWidth: '99%',
						maxHeight: '99%',
						width: 'auto',
						height: 'auto',
						filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08))', // Very subtle shadow
					}}
				>
				<g fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
					{isSketchPhase ? (
						<>
							{/* Show completed paths (fully drawn) */}
							{paths.slice(0, completedPathCount).map((d, i) => (
								<path key={`completed-${i}`} d={d} style={{opacity: 1}} vectorEffect="non-scaling-stroke" />
							))}
							{/* Animate current path being drawn - ONE path at a time, sequentially */}
							{currentPathIndex < paths.length && (
								<AnimatedPath
									d={paths[currentPathIndex]}
									progress={currentPathProgress}
								/>
							)}
						</>
					) : (
						/* In hold phase, show all paths completed */
						paths.map((d, i) => (
							<path key={`hold-${i}`} d={d} style={{opacity: 1}} vectorEffect="non-scaling-stroke" />
						))
					)}
				</g>
			</svg>
			</div>
		</AbsoluteFill>
	);
};

const WhiteboardFrame: React.FC<{
	asset?: string;
	animate?: boolean;
	vectorized?: {svgUrl: string; width: number; height: number};
	vectorizedList?: Array<{svgUrl: string; width: number; height: number}>;
	heading?: string;
	text?: string;
	svgString?: string; // Pre-loaded SVG string
}> = ({
	asset,
	animate = false,
	vectorized,
	vectorizedList,
	heading,
	text,
	svgString: providedSvgString,
}) => {
	const {durationInFrames, fps} = useVideoConfig();
	const [svgString, setSvgString] = React.useState<string | null>(providedSvgString || null);
	const [isLoading, setIsLoading] = React.useState(!providedSvgString);
	const [loadError, setLoadError] = React.useState(false);

	// Load SVG string from URL (only if not provided)
	React.useEffect(() => {
		if (!animate || !vectorized || providedSvgString) {
			setIsLoading(false);
			return;
		}

		const loadSvg = async () => {
			try {
				setIsLoading(true);
				setLoadError(false);

				// Use staticFile for Remotion public directory access
				const svgPath = vectorized.svgUrl.startsWith('/assets/')
					? staticFile(vectorized.svgUrl.replace(/^\//, ''))
					: vectorized.svgUrl;

				// Try fetching via staticFile path
				let response: Response;
				try {
					response = await fetch(svgPath, {
						mode: 'cors',
						credentials: 'omit',
					});
				} catch (e) {
					// Fallback: try with localhost if it's a relative URL
					const fallbackUrl = vectorized.svgUrl.startsWith('http')
						? vectorized.svgUrl
						: `http://localhost:3000${vectorized.svgUrl}`;
					response = await fetch(fallbackUrl, {
						mode: 'cors',
						credentials: 'omit',
					});
				}

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const svgText = await response.text();
				setSvgString(svgText);
				setIsLoading(false);
			} catch (error) {
				console.error('[WhiteboardFrame] Failed to load SVG:', error);
				setLoadError(true);
				setIsLoading(false);
			}
		};

		loadSvg();
	}, [vectorized?.svgUrl, animate, providedSvgString]);

	if (!asset) {
		return (
			<div
				style={{
					width: '100%',
					height: '100%',
					background: '#0d5c2f', // Green board/chalkboard color
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					fontSize: 32,
					color: '#ffffff',
				}}
			>
				Whiteboard asset unavailable
			</div>
		);
	}

	// Check if asset is a video (animated) or image (static)
	const isVideo = asset.match(/\.(mp4|webm|mov)$/i) || asset.includes('/animated-');

	if (isVideo) {
		return (
			<Video
				src={asset}
				style={{
					width: '100%',
					height: '100%',
					objectFit: 'contain',
					backgroundColor: '#0d5c2f', // Green board/chalkboard color
				}}
			/>
		);
	}

	// Use new WhiteboardAnimatorPrecise component for fast 3-second reveal
	if (animate && vectorizedList && vectorizedList.length > 0) {
		// Montage: up to 3 items laid out horizontally; draw sequentially top-to-bottom within scene
		const items = vectorizedList.slice(0, 3);
		const segmentFrames = Math.max(1, Math.floor(durationInFrames / items.length));
		return (
			<AbsoluteFill style={{ backgroundColor: '#0d5c2f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
				<div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: '32px', width: '92%', height: '92%' }}>
					{items.map((it, idx) => {
						const start = idx * segmentFrames;
						const segSeconds = segmentFrames / fps;
						// Each column renders within its own sub-sequence; draw for most of its segment
						return (
							<Sequence key={`grid-${idx}`} from={start} durationInFrames={segmentFrames}>
								<SketchingSVG
									svgUrl={it.svgUrl}
									width={it.width}
									height={it.height}
									durationInFrames={segmentFrames}
								/>
							</Sequence>
						);
					})}
				</div>
			</AbsoluteFill>
		);
	}

	// Use new WhiteboardAnimatorPrecise component for slower reveal
	if (animate && vectorized && svgString) {
		const sceneDurationSeconds = durationInFrames / fps;
		const revealSeconds = Math.min(
			Math.max(6, sceneDurationSeconds * 0.75),
			Math.max(1, sceneDurationSeconds - 1)
		);
		return (
			<WhiteboardAnimatorPrecise
				svgString={svgString}
				sceneDurationSeconds={sceneDurationSeconds}
				revealFinishSeconds={revealSeconds}
				revealStrategy="sequential"
				text={undefined}
				showText={false}
			/>
		);
	}

	// Loading state
	if (animate && vectorized && isLoading) {
		return (
			<AbsoluteFill
				style={{
					backgroundColor: '#0d5c2f', // Green board/chalkboard color
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<div style={{ color: '#ffffff', fontSize: 24 }}>Loading sketch...</div>
			</AbsoluteFill>
		);
	}

	// Error state - fallback to static image
	if (animate && vectorized && loadError) {
		return (
			<Img
				src={asset}
				style={{
					width: '100%',
					height: '100%',
					objectFit: 'contain',
					backgroundColor: '#0d5c2f', // Green board/chalkboard color
				}}
			/>
		);
	}

	// Fallback: Minimal reveal for static images (when no vectorized SVG) - no pen cursor, no heavy mask
	if (animate && !vectorized) {
		const currentFrame = useCurrentFrame();
		const animationDuration = Math.min(durationInFrames * 0.6, fps * 2.5); // short fade-in only
		
		// Simple fade
		const sketchProgress = interpolate(
			currentFrame,
			[0, animationDuration],
			[0, 1],
			{
				extrapolateLeft: 'clamp',
				extrapolateRight: 'clamp',
				easing: Easing.inOut(Easing.ease),
			}
		);

		// Fade in effect
		const fadeIn = interpolate(
			currentFrame,
			[0, Math.min(durationInFrames * 0.2, fps * 0.8)],
			[0, 1],
			{
				extrapolateLeft: 'clamp',
				extrapolateRight: 'clamp',
				easing: Easing.out(Easing.ease),
			}
		);

		return (
			<AbsoluteFill
				style={{
					backgroundColor: '#0d5c2f', // Green board/chalkboard color
					overflow: 'hidden',
				}}
			>
				<div
					style={{
						width: '100%',
						height: '100%',
						position: 'relative',
						opacity: fadeIn,
					}}
				>
					<Img
						src={asset}
						style={{
							width: '100%',
							height: '100%',
							objectFit: 'contain',
							filter: sketchProgress < 1 ? 'blur(0.5px)' : 'blur(0px)',
						}}
					/>
				</div>
			</AbsoluteFill>
		);
	}

	// Static image (no animation)
	return (
		<Img
			src={asset}
			style={{
				width: '100%',
				height: '100%',
				objectFit: 'contain',
				backgroundColor: '#0d5c2f', // Green board/chalkboard color
			}}
		/>
	);
};

// Smooth transition wrapper with fade and subtle zoom (golpo.ai style)
const FrameWithTransition: React.FC<{
	children: React.ReactNode;
	fadeInStart: number;
	fadeInEnd: number;
	fadeOutStart: number;
	fadeOutEnd: number;
	isFirst: boolean;
	isLast: boolean;
	currentStart: number;
	durationInFrames: number;
}> = ({children, fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd, isFirst, isLast, currentStart, durationInFrames}) => {
	const currentFrame = useCurrentFrame();
	const {fps} = useVideoConfig();
	
	// Smooth fade in/out with cross-fade effect
	const fadeIn = interpolate(
		currentFrame,
		[fadeInStart, fadeInEnd],
		[0, 1],
		{
			easing: Easing.out(Easing.ease),
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		}
	);
	
	const fadeOut = interpolate(
		currentFrame,
		[fadeOutStart, fadeOutEnd],
		[1, 0],
		{
			easing: Easing.in(Easing.ease),
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		}
	);
	
	const opacity = isFirst ? fadeIn : isLast ? fadeOut : Math.min(fadeIn, fadeOut);
	
	// Subtle zoom effect (golpo.ai style - gentle scale animation on frame start)
	const zoomProgress = interpolate(
		currentFrame,
		[currentStart, currentStart + Math.min(durationInFrames * 0.15, fps * 1.5)],
		[0.97, 1],
		{
			easing: Easing.out(Easing.ease),
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		}
	);
	
	return (
		<AbsoluteFill
			style={{
				opacity,
				transform: `scale(${zoomProgress})`,
			}}
		>
			{children}
		</AbsoluteFill>
	);
};

const MotionFrame: React.FC<{asset?: string}> = ({asset}) => {
	if (!asset) {
		return (
			<div
				style={{
					width: '100%',
					height: '100%',
					background: '#0f172a',
					color: '#f8fafc',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					fontSize: 32,
				}}
			>
				Motion scene unavailable
			</div>
		);
	}

	return (
		<Video
			src={asset}
			style={{
				width: '100%',
				height: '100%',
				objectFit: 'cover',
			}}
		/>
	);
};

export const VideoFromAI: React.FC<{data: AIVideoData}> = ({data}) => {
	const {fps} = useVideoConfig();
	const plan = data ?? FALLBACK_PLAN;

	let currentStart = 0;

	const filteredFrames = plan.frames.filter((frame) => frame.type === 'whiteboard_diagram' || frame.type === 'motion_scene');
	const transitionDuration = fps * 1.2; // 1.2 second smooth cross-fade for better continuity

	return (
		<AbsoluteFill style={{backgroundColor: '#0d5c2f', color: '#ffffff'}}>
			{filteredFrames.map((frame, index) => {
				// Give whiteboard diagrams 18 seconds total: lengthy sketch phase + hold/zoom phase
				let frameDuration = frame.duration ?? 4;
				if (frame.type === 'whiteboard_diagram') {
					frameDuration = 18; // 18 seconds: ~65% sketch phase (~11.7s) + ~35% hold/zoom phase (~6.3s)
				}
				const durationInFrames = Math.max(1, Math.round(frameDuration * fps));
				
				// Calculate smooth fade transitions
				const isFirst = index === 0;
				const isLast = index === filteredFrames.length - 1;
				const fadeInStart = currentStart;
				const fadeInEnd = currentStart + transitionDuration;
				const fadeOutStart = currentStart + durationInFrames - transitionDuration;
				const fadeOutEnd = currentStart + durationInFrames;
				
				// Prepare voiceover path using staticFile() for proper public directory access
				const voiceoverSrc = frame.voiceoverUrl
					? (frame.voiceoverUrl.startsWith('/')
						? staticFile(frame.voiceoverUrl.replace(/^\//, ''))
						: staticFile(frame.voiceoverUrl))
					: null;
				
				const sequence = (
					<Sequence key={frame.id} from={currentStart} durationInFrames={durationInFrames}>
						{/* Voiceover audio */}
						{voiceoverSrc && (
							<Audio
								src={voiceoverSrc}
								startFrom={0}
								volume={1}
							/>
						)}
						<FrameWithTransition
							fadeInStart={fadeInStart}
							fadeInEnd={fadeInEnd}
							fadeOutStart={fadeOutStart}
							fadeOutEnd={fadeOutEnd}
							isFirst={isFirst}
							isLast={isLast}
							currentStart={currentStart}
							durationInFrames={durationInFrames}
						>
							{frame.type === 'whiteboard_diagram' ? (
								<WhiteboardFrame 
									asset={frame.asset} 
									animate={frame.animate ?? false}
									vectorized={frame.vectorized}
									heading={frame.heading}
									text={frame.text}
									svgString={frame.svgString}
								/>
							) : (
								<MotionFrame asset={frame.asset} />
							)}
						</FrameWithTransition>
					</Sequence>
				);

				currentStart += durationInFrames;
				return sequence;
			})}
		</AbsoluteFill>
	);
};

export default VideoFromAI;


