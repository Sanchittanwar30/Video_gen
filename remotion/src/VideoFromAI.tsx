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

export interface AIVideoFrame {
	id: string;
	type: 'whiteboard_diagram' | 'text_slide' | 'bullet_slide' | 'motion_scene';
	heading?: string;
	text?: string;
	bullets?: string[];
	duration?: number;
	asset?: string;
	animate?: boolean;
	vectorized?: {
		svgUrl: string;
		width: number;
		height: number;
	};
	voiceoverUrl?: string;
	voiceoverScript?: string;
}

export interface AIVideoData {
	title: string;
	frames: AIVideoFrame[];
}

export const calculatePlanDurationInFrames = (plan: AIVideoData, fps: number): number => {
	const total = (plan.frames ?? []).reduce((sum, frame) => {
		// Whiteboard diagrams get 18 seconds for slow pen tracing
		// Other frames use their specified duration or default to 4 seconds
		let seconds: number;
		if (frame.type === 'whiteboard_diagram') {
			seconds = 18; // 18 seconds: 3s delay + 15s slow pen tracing
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
				background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
				color: '#0f172a',
				opacity: progress,
				transform: `translateY(${(1 - progress) * 35}px)`,
			}}
		>
			{frame.heading ? (
				<h1 style={{fontSize: 64, fontWeight: 700, marginBottom: 32, textAlign: 'center'}}>
					{frame.heading}
				</h1>
			) : null}
			{frame.text ? (
				<p style={{fontSize: 32, lineHeight: 1.5, maxWidth: 960, textAlign: 'center'}}>
					{frame.text}
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
				background: '#f9fafb',
				color: '#0f172a',
			}}
		>
			{frame.heading ? (
				<h1 style={{fontSize: 60, fontWeight: 700, marginBottom: 36, textAlign: 'center'}}>
					{frame.heading}
				</h1>
			) : null}
			<ul
				style={{
					listStyle: 'disc',
					paddingLeft: 0,
					margin: 0,
					display: 'flex',
					flexDirection: 'column',
					gap: 20,
					maxWidth: 960,
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
								fontSize: 28,
								lineHeight: 1.5,
								opacity: progress,
								transform: `translateY(${(1 - progress) * 15}px)`,
							}}
						>
							{bullet}
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
					// Extract starting coordinates from path data
					// Path data format: "M x,y ..." or "m dx,dy ..."
					const match = d.match(/^[Mm]\s*([-\d.]+)[,\s]+([-\d.]+)/);
					let startX = 0;
					let startY = 0;
					
					if (match) {
						startX = parseFloat(match[1]) || 0;
						startY = parseFloat(match[2]) || 0;
					}
					
					pathData.push({d, startX, startY});
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
					backgroundColor: '#f8fafc',
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
	// Use 18 seconds (540 frames at 30fps) for slow, deliberate pen tracing
	const sketchingDurationInFrames = fps * 18; // 18 seconds = 540 frames at 30fps
	
	// Add a 3-second delay before starting to draw (pen positioning and preparation)
	const delayFrames = fps * 3; // 3 seconds delay for anticipation
	const drawingStartFrame = delayFrames;
	const drawingDurationFrames = sketchingDurationInFrames - delayFrames; // 15 seconds for slow pen tracing
	
	// Calculate progress: 0 during delay, then 0-1 during drawing
	// Ensure it's truly progressive - no immediate jumps
	let rawProgress = 0;
	if (currentFrame >= drawingStartFrame) {
		const drawingFrame = currentFrame - drawingStartFrame;
		rawProgress = Math.min(1, Math.max(0, drawingFrame / drawingDurationFrames));
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
	const completedPathCount = currentPathProgress >= 1 ? currentPathIndex + 1 : currentPathIndex;

	// Subtle zoom animation during drawing (golpo.ai style)
	const zoomProgress = interpolate(
		currentFrame,
		[0, sketchingDurationInFrames * 0.3],
		[1, 1.02],
		{
			easing: Easing.out(Easing.ease),
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		}
	);

	return (
		<AbsoluteFill
			style={{
				backgroundColor: '#f8fafc',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				padding: '0.5%', // Minimal padding - almost no white space
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
				<g fill="none" stroke="#000000" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
					{/* Show completed paths (fully drawn) */}
					{paths.slice(0, completedPathCount).map((d, i) => (
						<path key={`completed-${i}`} d={d} style={{opacity: 1}} />
					))}
					{/* Animate current path being drawn - ONE path at a time, sequentially */}
					{currentPathIndex < paths.length && (
						<AnimatedPath
							d={paths[currentPathIndex]}
							progress={currentPathProgress}
						/>
					)}
				</g>
			</svg>
			</div>
		</AbsoluteFill>
	);
};

const WhiteboardFrame: React.FC<{asset?: string; animate?: boolean; vectorized?: {svgUrl: string; width: number; height: number}}> = ({
	asset,
	animate = false,
	vectorized,
}) => {
	const currentFrame = useCurrentFrame();
	const {durationInFrames, fps} = useVideoConfig();

	if (!asset) {
		return (
			<div
				style={{
					width: '100%',
					height: '100%',
					background: '#f8fafc',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					fontSize: 32,
					color: '#475569',
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
					backgroundColor: '#f8fafc',
				}}
			/>
		);
	}

	// True line-by-line sketching animation using vectorized SVG
	if (animate && vectorized) {
		return (
			<SketchingSVG
				svgUrl={vectorized.svgUrl}
				width={vectorized.width}
				height={vectorized.height}
				durationInFrames={durationInFrames}
				fallbackImage={asset}
			/>
		);
	}

	// Fallback: Simple animated effects for static images
	if (animate) {
		const animationDuration = Math.min(durationInFrames * 0.7, fps * 3); // 3 seconds or 70% of duration
		
		// Overall progress for the sketching animation
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

		// Create a more organic reveal pattern - simulates drawing from top-left, following a path
		// Uses a combination of diagonal and circular reveals for a more natural sketching feel
		const diagonalProgress = sketchProgress;
		const circularReveal = Math.sin(sketchProgress * Math.PI * 2) * 0.3 + 0.7; // Oscillating reveal
		
		// Mask that reveals in a sketching pattern (top-left to bottom-right with variations)
		const maskWidth = Math.min(100, diagonalProgress * 120); // Slightly overshoots for smoothness
		const maskHeight = Math.min(100, diagonalProgress * 110);
		
		// Pen cursor position (follows the reveal)
		const penX = interpolate(sketchProgress, [0, 1], [10, 90], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
		const penY = interpolate(sketchProgress, [0, 1], [15, 85], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

		return (
			<AbsoluteFill
				style={{
					backgroundColor: '#f8fafc',
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
					{/* Main image */}
					<Img
						src={asset}
						style={{
							width: '100%',
							height: '100%',
							objectFit: 'contain',
							filter: sketchProgress < 1 ? 'blur(0.5px)' : 'blur(0px)', // Slight blur during drawing
						}}
					/>
					
					{/* Sketching reveal mask - creates organic drawing effect */}
					<div
						style={{
							position: 'absolute',
							top: 0,
							left: 0,
							width: '100%',
							height: '100%',
							background: `linear-gradient(
								135deg,
								#f8fafc ${(1 - maskWidth) * 100}%,
								transparent ${(1 - maskWidth * 0.7) * 100}%
							)`,
							clipPath: sketchProgress < 1 
								? `polygon(0% 0%, ${maskWidth}% 0%, ${maskWidth * 0.9}% ${maskHeight}%, 0% ${maskHeight}%)`
								: 'none',
							transition: 'clip-path 0.05s linear',
						}}
					/>
					
					{/* Optional: Pen cursor effect (visual indicator of drawing) */}
					{sketchProgress < 0.95 && (
						<div
							style={{
								position: 'absolute',
								left: `${penX}%`,
								top: `${penY}%`,
								width: '20px',
								height: '20px',
								borderRadius: '50%',
								background: 'rgba(59, 130, 246, 0.6)',
								border: '2px solid rgba(59, 130, 246, 0.9)',
								transform: 'translate(-50%, -50%)',
								boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)',
								pointerEvents: 'none',
								opacity: fadeIn * 0.8,
							}}
						/>
					)}
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
				backgroundColor: '#f8fafc',
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
		<AbsoluteFill style={{backgroundColor: '#f8fafc', color: '#0f172a'}}>
			{filteredFrames.map((frame, index) => {
				// Give whiteboard diagrams 18 seconds total for slow pen tracing
				let frameDuration = frame.duration ?? 4;
				if (frame.type === 'whiteboard_diagram') {
					frameDuration = 18; // 18 seconds: 3s delay + 15s slow pen tracing (no hold, transitions handle it)
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


