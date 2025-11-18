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
import {loadFont} from '@remotion/google-fonts/Kalam';
import { WhiteboardAnimatorPrecise } from '../../src/WhiteboardAnimatorPrecise';
import { SubtitleOverlay } from './SubtitleOverlay';

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
	backgroundMusic?: string; // Optional background music URL or path
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
		// Use frame.duration if specified (flexible timing based on content), otherwise use defaults
		let seconds: number;
		// Use frame.duration if specified (flexible timing based on content/voiceover), otherwise use minimal defaults
		if (frame.type === 'whiteboard_diagram') {
			// For whiteboard diagrams, use duration from voiceover/content, or minimum 6 seconds
			seconds = typeof frame.duration === 'number' && frame.duration > 0 ? frame.duration : 6;
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
	// Load handwritten font for all text elements
	loadFont();
	
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
						fontWeight: 400,
						fontFamily: 'Kalam, "Caveat", "Dancing Script", "Indie Flower", "Shadows Into Light", cursive, sans-serif',
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
						fontWeight: 400,
						fontFamily: 'Kalam, "Caveat", "Dancing Script", "Indie Flower", "Shadows Into Light", cursive, sans-serif',
						lineHeight: 1.35,
						maxWidth: 900,
						textAlign: 'center',
						color: '#000',
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
	// Load handwritten font for all text elements
	loadFont();
	
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
						fontWeight: 400,
						fontFamily: 'Kalam, "Caveat", "Dancing Script", "Indie Flower", "Shadows Into Light", cursive, sans-serif',
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
								fontWeight: 400,
								fontFamily: 'Kalam, "Caveat", "Dancing Script", "Indie Flower", "Shadows Into Light", cursive, sans-serif',
								lineHeight: 1.4,
								opacity: progress,
								transform: `translateY(${(1 - progress) * 15}px)`,
								color: '#000',
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
					objectFit: 'cover',
					backgroundColor: '#000000',
				}}
			/>
		);
	}

	if (!svgContent || paths.length === 0) {
		loadFont(); // Load handwritten font for loading messages
		return (
			<div style={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
				<div style={{
					color: '#475569',
					fontFamily: 'Kalam, "Caveat", "Dancing Script", "Indie Flower", "Shadows Into Light", cursive, sans-serif'
				}}>Loading sketch...</div>
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
				backgroundColor: '#000000',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				padding: 0,
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
					width="100%"
					height="100%"
					viewBox={`0 0 ${width} ${height}`}
					preserveAspectRatio="xMidYMid meet"
					style={{
						width: '100%',
						height: '100%',
						filter: 'none',
					}}
				>
				<g fill="none" stroke="#000000" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
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
	sequenceDurationInFrames?: number; // CRITICAL: Individual sequence duration, not total video duration
}> = ({
	asset,
	animate = false,
	vectorized,
	vectorizedList,
	heading,
	text,
	svgString: providedSvgString,
	sequenceDurationInFrames,
}) => {
	const {fps} = useVideoConfig();
	// CRITICAL FIX: Use sequence duration if provided, otherwise fall back to total duration
	// This ensures each frame animates correctly, not just first and last
	const durationInFrames = sequenceDurationInFrames ?? useVideoConfig().durationInFrames;
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
		loadFont(); // Load handwritten font for error messages
		return (
			<div
				style={{
					width: '100%',
					height: '100%',
					background: '#000000',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					fontSize: 32,
					fontFamily: 'Kalam, "Caveat", "Dancing Script", "Indie Flower", "Shadows Into Light", cursive, sans-serif',
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
					objectFit: 'cover',
					backgroundColor: '#000000',
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
			<AbsoluteFill style={{ backgroundColor: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

	// Use new WhiteboardAnimatorPrecise component for flexible reveal based on content
	if (animate && vectorized && svgString) {
		// Validate SVG string is not empty
		if (!svgString || svgString.trim().length === 0) {
			console.error('[WhiteboardFrame] SVG string is empty, falling back to static image');
			return (
				<Img
					src={asset}
					style={{
						width: '100%',
						height: '100%',
						objectFit: 'cover',
						backgroundColor: '#ffffff',
					}}
				/>
			);
		}
		
		const sceneDurationSeconds = durationInFrames / fps;
		// Allocate 70-80% of scene time to sketching animation (flexible based on content/voiceover)
		const revealSeconds = Math.min(
			Math.max(4, sceneDurationSeconds * 0.75), // Minimum 4 seconds for sketching (flexible)
			Math.max(1, sceneDurationSeconds - 1)
		);
		
		return (
			<WhiteboardAnimatorPrecise
				svgString={svgString}
				sceneDurationSeconds={sceneDurationSeconds}
				revealFinishSeconds={revealSeconds}
				revealStrategy="sequential" // Top-to-bottom ordering (flexible based on input requirements)
				text={undefined}
				showText={false}
			/>
		);
	}

	// Loading state
	if (animate && vectorized && isLoading) {
		loadFont(); // Load handwritten font for loading messages
		return (
			<AbsoluteFill
				style={{
					backgroundColor: '#000000',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<div style={{ 
					color: '#ffffff', 
					fontSize: 24,
					fontFamily: 'Kalam, "Caveat", "Dancing Script", "Indie Flower", "Shadows Into Light", cursive, sans-serif'
				}}>Loading sketch...</div>
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
					objectFit: 'cover',
					backgroundColor: '#000000',
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
					backgroundColor: '#000000',
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
							objectFit: 'cover',
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
				objectFit: 'cover',
				backgroundColor: '#000000',
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
	
	// CRITICAL FIX: Convert absolute frame numbers to relative (sequence-based) frame numbers
	// useCurrentFrame() inside a Sequence returns frames relative to sequence start (0-based)
	// But fadeInStart, fadeInEnd, etc. are absolute frame numbers, so we need to subtract currentStart
	const relativeFadeInStart = fadeInStart - currentStart;
	const relativeFadeInEnd = fadeInEnd - currentStart;
	const relativeFadeOutStart = fadeOutStart - currentStart;
	const relativeFadeOutEnd = fadeOutEnd - currentStart;
	
	// Smooth fade in/out with cross-fade effect
	const fadeIn = interpolate(
		currentFrame,
		[relativeFadeInStart, relativeFadeInEnd],
		[0, 1],
		{
			easing: Easing.bezier(0.22, 0.0, 0.08, 1.0),
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		}
	);
	
	const fadeOut = interpolate(
		currentFrame,
		[relativeFadeOutStart, relativeFadeOutEnd],
		[1, 0],
		{
			easing: Easing.bezier(0.22, 0.0, 0.08, 1.0),
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		}
	);
	
	const opacity = isFirst ? fadeIn : isLast ? fadeOut : Math.min(fadeIn, fadeOut);
	
	// Disable micro-motion to avoid shaking; keep content stable
	const zoom = 1;
	
	return (
		<AbsoluteFill
			style={{
				opacity,
				transform: `scale(${zoom})`,
			}}
		>
			{children}
		</AbsoluteFill>
	);
};

const MotionFrame: React.FC<{asset?: string}> = ({asset}) => {
	if (!asset) {
		loadFont(); // Load handwritten font for error messages
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
					fontFamily: 'Kalam, "Caveat", "Dancing Script", "Indie Flower", "Shadows Into Light", cursive, sans-serif',
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
	const {fps, durationInFrames} = useVideoConfig();
	const currentFrame = useCurrentFrame();
	const plan = data ?? FALLBACK_PLAN;

	let currentStart = 0;

	const filteredFrames = plan.frames.filter((frame) => frame.type === 'whiteboard_diagram' || frame.type === 'motion_scene');
	// Faster transitions: ensure first content is visible almost immediately (<=150ms fade for first frame)
	const FIRST_FADE_FRAMES = Math.max(1, Math.round(fps * 0.1)); // ~100ms
	const OTHER_FADE_FRAMES = Math.max(1, Math.round(fps * 0.2)); // ~200ms
	const OVERLAP_FRAMES = Math.max(1, Math.round(fps * 0.15)); // ~150ms crossfade overlap

	// Calculate total video duration in frames for music fade
	const totalVideoFrames = filteredFrames.reduce((total, frame) => {
		// Use frame.duration if specified (flexible based on content/voiceover), otherwise minimal defaults
		const frameDuration = frame.duration ?? (frame.type === 'whiteboard_diagram' ? 6 : 4);
		return total + Math.max(1, Math.round(frameDuration * fps));
	}, 0);

	// Prepare background music path if provided
	// staticFile() expects paths relative to public/ directory (no leading /)
	const backgroundMusicSrc = plan.backgroundMusic
		? (plan.backgroundMusic.startsWith('http')
			? plan.backgroundMusic // External URL - use as is
			: plan.backgroundMusic.startsWith('/')
				? staticFile(plan.backgroundMusic.replace(/^\//, '')) // Remove leading / for staticFile
				: staticFile(plan.backgroundMusic)) // Already relative to public
		: null;

	// Calculate background music volume with fade-in and fade-out
	const musicFadeDuration = fps * 2; // 2 seconds fade-in/fade-out
	const maxMusicVolume = 0.05; // 5% volume (very quiet to not shadow voiceover)
	const musicFadeIn = interpolate(
		currentFrame,
		[0, musicFadeDuration],
		[0, maxMusicVolume], // Fade from 0 to 5% volume
		{
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		}
	);
	const musicFadeOut = interpolate(
		currentFrame,
		[totalVideoFrames - musicFadeDuration, totalVideoFrames],
		[maxMusicVolume, 0], // Fade from 5% to 0 volume
		{
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		}
	);
	const musicVolume = Math.min(musicFadeIn, musicFadeOut > 0 ? musicFadeOut : musicFadeIn);

	return (
		<AbsoluteFill style={{backgroundColor: '#000000', color: '#ffffff', overflow: 'hidden'}}>
			{/* Background music - plays throughout entire video with fade-in/fade-out and loops if needed */}
			{/* Only render if backgroundMusic is provided and valid */}
			{backgroundMusicSrc && backgroundMusicSrc.trim() !== '' && (
				<Audio
					src={backgroundMusicSrc}
					startFrom={0}
					volume={musicVolume} // Dynamic volume with fade-in/fade-out (max 5%)
					loop // Loop if video is longer than music track
				/>
			)}
			{filteredFrames.map((frame, index) => {
				// Use frame.duration if specified (flexible timing based on content/voiceover), otherwise use minimal defaults
				// Duration is fully flexible based on input requirements and voiceover length
				let frameDuration = frame.duration;
				if (!frameDuration || frameDuration <= 0) {
					// Use minimal defaults if duration not specified
					frameDuration = frame.type === 'whiteboard_diagram' ? 6 : 4;
				}
				// Ensure minimum 2.5 seconds for sketch animation to complete
				frameDuration = Math.max(2.5, frameDuration);
				const durationInFrames = Math.max(1, Math.round(frameDuration * fps));
				
				// Calculate smooth fade transitions (white fade) with minimal delay for first frame
				const isFirst = index === 0;
				const isLast = index === filteredFrames.length - 1;
				const fadeInStart = currentStart;
				const fadeInEnd = currentStart + (isFirst ? FIRST_FADE_FRAMES : OTHER_FADE_FRAMES);
				const fadeOutStart = currentStart + durationInFrames - OTHER_FADE_FRAMES;
				const fadeOutEnd = currentStart + durationInFrames;
				
				// Prepare voiceover path using staticFile() for proper public directory access
				// staticFile() automatically looks in public/ directory
				// Frame voiceoverUrl should be like: "assets/voiceovers/filename.mp3" (relative to public/)
				let voiceoverSrc: string | null = null;
				if (frame.voiceoverUrl) {
					if (frame.voiceoverUrl.startsWith('http')) {
						voiceoverSrc = frame.voiceoverUrl; // External URL - use as is
					} else {
						// Remove leading / if present, then use staticFile
						const cleanPath = frame.voiceoverUrl.replace(/^\//, '');
						voiceoverSrc = staticFile(cleanPath);
					}
				}
				
				const sequence = (
					<Sequence key={frame.id} from={currentStart} durationInFrames={durationInFrames}>
						{/* Voiceover audio - synchronized with sketching animation */}
						{/* Delay voiceover start to sync with sketching: start after 10% of scene or when sketching begins */}
						{(() => {
							const voiceoverDelayFrames = frame.type === 'whiteboard_diagram' && frame.animate 
								? Math.max(0, Math.floor(durationInFrames * 0.1))
								: 0;
							
							return voiceoverSrc ? (
								<Sequence from={voiceoverDelayFrames} durationInFrames={durationInFrames}>
									<Audio
										key={`voiceover-${frame.id}`}
										src={voiceoverSrc}
										startFrom={0}
										volume={1.0} // Full volume (100%) to be clearly audible over background music (5%)
									/>
								</Sequence>
							) : null;
						})()}
						
						{/* Subtitles - synchronized with voiceover (movie-style subtitles) */}
						{frame.voiceoverScript ? (
							(() => {
								// Calculate voiceover delay to match audio delay
								// Subtitles should start exactly when voiceover audio starts
								const hasVoiceover = !!frame.voiceoverUrl;
								const voiceoverDelayFrames = hasVoiceover && frame.type === 'whiteboard_diagram' && frame.animate 
									? Math.max(0, Math.floor(durationInFrames * 0.1))
									: 0; // No delay if no voiceover or not animated
								
								// Subtitles should show for the ENTIRE voiceover duration
								// Start when voiceover starts, end when sequence ends (or voiceover ends)
								return (
									<SubtitleOverlay
										text={frame.voiceoverScript}
										startFrame={0} // Always 0 since we're inside the Sequence (relative frames)
										durationInFrames={durationInFrames} // Show for entire sequence duration
										voiceoverDelayFrames={voiceoverDelayFrames} // Start when voiceover starts
									/>
								);
							})()
						) : null}
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
									sequenceDurationInFrames={durationInFrames} // CRITICAL: Pass individual frame duration
								/>
							) : (
								<MotionFrame asset={frame.asset} />
							)}
						</FrameWithTransition>
					</Sequence>
				);

				// Overlap next scene to avoid sudden jumps
				const overlap = index < filteredFrames.length - 1 ? OVERLAP_FRAMES : 0;
				currentStart += Math.max(1, durationInFrames - overlap);
				return sequence;
			})}
		</AbsoluteFill>
	);
};

export default VideoFromAI;


