import React from 'react';
import {
	AbsoluteFill,
	useCurrentFrame,
	useVideoConfig,
	interpolate,
	Easing,
} from 'remotion';

export interface WhiteboardAnimatorPreciseProps {
	svgString: string;
	sceneDurationSeconds: number;
	revealFinishSeconds?: number;
	revealStrategy?: 'sequential' | 'parallel' | 'balanced';
	text?: string;
	showText?: boolean;
}

interface PathData {
	d: string;
	length: number;
	startX: number;
	startY: number;
	isTextLike?: boolean; // Small, closed paths likely to be text glyphs
}

/**
 * Estimate path length from path data string without DOM access.
 * This works by parsing path commands and calculating approximate distances.
 */
function estimatePathLength(pathData: string, svgWidth: number, svgHeight: number): number {
	if (!pathData) return 1000;
	
	let totalLength = 0;
	let currentX = 0;
	let currentY = 0;
	let startX = 0;
	let startY = 0;
	let isFirstMove = true;
	
	// Parse path data - handle both absolute (uppercase) and relative (lowercase) commands
	// Split by command letters but keep them
	const parts: string[] = [];
	let currentPart = '';
	for (let i = 0; i < pathData.length; i++) {
		const char = pathData[i];
		if (/[MLHVCSQTAZ]/i.test(char) && currentPart.trim()) {
			parts.push(currentPart.trim());
			currentPart = char;
		} else {
			currentPart += char;
		}
	}
	if (currentPart.trim()) {
		parts.push(currentPart.trim());
	}
	
	for (const part of parts) {
		if (!part) continue;
		
		const isRelative = /[a-z]/.test(part[0]);
		const command = part[0].toUpperCase();
		const coordsStr = part.slice(1).trim();
		const coords = coordsStr.split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
		
		if (command === 'M') {
			// Move: set position, don't add to length (unless relative)
			if (coords.length >= 2) {
				if (isRelative) {
					currentX += coords[0];
					currentY += coords[1];
				} else {
					currentX = coords[0];
					currentY = coords[1];
				}
				if (isFirstMove) {
					startX = currentX;
					startY = currentY;
					isFirstMove = false;
				}
				// Handle multiple coordinate pairs (treated as Line commands)
				for (let i = 2; i < coords.length; i += 2) {
					if (i + 1 < coords.length) {
						let x = coords[i];
						let y = coords[i + 1];
						if (isRelative) {
							x += currentX;
							y += currentY;
						}
						const dx = x - currentX;
						const dy = y - currentY;
						totalLength += Math.sqrt(dx * dx + dy * dy);
						currentX = x;
						currentY = y;
					}
				}
			}
		} else if (command === 'L') {
			// Line: calculate distance for each coordinate pair
			for (let i = 0; i < coords.length; i += 2) {
				if (i + 1 < coords.length) {
					let x = coords[i];
					let y = coords[i + 1];
					if (isRelative) {
						x += currentX;
						y += currentY;
					}
					const dx = x - currentX;
					const dy = y - currentY;
					totalLength += Math.sqrt(dx * dx + dy * dy);
					currentX = x;
					currentY = y;
				}
			}
		} else if (command === 'H') {
			// Horizontal line
			for (let i = 0; i < coords.length; i++) {
				let x = coords[i];
				if (isRelative) {
					x += currentX;
				}
				totalLength += Math.abs(x - currentX);
				currentX = x;
			}
		} else if (command === 'V') {
			// Vertical line
			for (let i = 0; i < coords.length; i++) {
				let y = coords[i];
				if (isRelative) {
					y += currentY;
				}
				totalLength += Math.abs(y - currentY);
				currentY = y;
			}
		} else if (command === 'C') {
			// Cubic Bezier: approximate length
			for (let i = 0; i < coords.length; i += 6) {
				if (i + 5 < coords.length) {
					let x1 = coords[i];
					let y1 = coords[i + 1];
					let x2 = coords[i + 2];
					let y2 = coords[i + 3];
					let x = coords[i + 4];
					let y = coords[i + 5];
					
					if (isRelative) {
						x1 += currentX; y1 += currentY;
						x2 += currentX; y2 += currentY;
						x += currentX; y += currentY;
					}
					
					// Approximate Bezier curve length
					const d1 = Math.sqrt((x1 - currentX) ** 2 + (y1 - currentY) ** 2);
					const d2 = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
					const d3 = Math.sqrt((x - x2) ** 2 + (y - y2) ** 2);
					totalLength += (d1 + d2 + d3) * 0.85; // Good approximation for Bezier curves
					currentX = x;
					currentY = y;
				}
			}
		} else if (command === 'Q') {
			// Quadratic Bezier
			for (let i = 0; i < coords.length; i += 4) {
				if (i + 3 < coords.length) {
					let x1 = coords[i];
					let y1 = coords[i + 1];
					let x = coords[i + 2];
					let y = coords[i + 3];
					
					if (isRelative) {
						x1 += currentX; y1 += currentY;
						x += currentX; y += currentY;
					}
					
					const d1 = Math.sqrt((x1 - currentX) ** 2 + (y1 - currentY) ** 2);
					const d2 = Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
					totalLength += (d1 + d2) * 0.75;
					currentX = x;
					currentY = y;
				}
			}
		} else if (command === 'Z') {
			// Close path
			const dx = startX - currentX;
			const dy = startY - currentY;
			totalLength += Math.sqrt(dx * dx + dy * dy);
			currentX = startX;
			currentY = startY;
		} else if (command === 'A') {
			// Arc: approximate as line
			for (let i = 0; i < coords.length; i += 7) {
				if (i + 6 < coords.length) {
					let x = coords[i + 5];
					let y = coords[i + 6];
					if (isRelative) {
						x += currentX;
						y += currentY;
					}
					const dx = x - currentX;
					const dy = y - currentY;
					totalLength += Math.sqrt(dx * dx + dy * dy) * 1.2; // Arcs are typically longer
					currentX = x;
					currentY = y;
				}
			}
		} else {
			// Other commands (S, T): approximate based on end point
			if (coords.length >= 2) {
				let x = coords[coords.length - 2];
				let y = coords[coords.length - 1];
				if (isRelative) {
					x += currentX;
					y += currentY;
				}
				const dx = x - currentX;
				const dy = y - currentY;
				totalLength += Math.sqrt(dx * dx + dy * dy) * 0.8;
				currentX = x;
				currentY = y;
			}
		}
	}
	
	// Ensure minimum length and scale based on SVG dimensions
	// Paths in larger SVGs should have proportionally longer estimated lengths
	const dimensionScale = Math.sqrt((svgWidth * svgHeight) / (1920 * 1080));
	return Math.max(50, totalLength * dimensionScale);
}

/**
 * Fast whiteboard-style SVG sketch animation component.
 * Reveals all strokes within EXACTLY revealFinishSeconds (default 3s),
 * then holds the completed sketch for the remaining scene duration.
 */
export const WhiteboardAnimatorPrecise: React.FC<WhiteboardAnimatorPreciseProps> = ({
	svgString,
	sceneDurationSeconds,
	revealFinishSeconds = 3,
	revealStrategy = 'balanced',
	text,
	showText = false,
}) => {
	const currentFrame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// Calculate frame ranges
	const sceneDurationInFrames = Math.floor(sceneDurationSeconds * fps);
	const revealDurationInFrames = Math.floor(revealFinishSeconds * fps);
	const holdStartFrame = revealDurationInFrames;
	const holdDurationInFrames = sceneDurationInFrames - revealDurationInFrames;

	// Parse SVG and extract paths
	const [paths, setPaths] = React.useState<PathData[]>([]);
	const [svgWidth, setSvgWidth] = React.useState<number>(1920);
	const [svgHeight, setSvgHeight] = React.useState<number>(1080);
	const [isLoading, setIsLoading] = React.useState(true);

	React.useEffect(() => {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(svgString, 'image/svg+xml');
			
			// Extract viewBox or width/height
			const svgElement = doc.documentElement;
			const viewBox = svgElement.getAttribute('viewBox');
			let width = 1920;
			let height = 1080;
			
			if (viewBox) {
				const [, , w, h] = viewBox.split(/\s+|,/).map(Number);
				width = w || 1920;
				height = h || 1080;
			} else {
				width = parseFloat(svgElement.getAttribute('width') || '1920');
				height = parseFloat(svgElement.getAttribute('height') || '1080');
			}
			setSvgWidth(width);
			setSvgHeight(height);

			// Extract all path elements
			const pathElements = doc.querySelectorAll('path');
			const pathData: PathData[] = [];

			pathElements.forEach((pathElement) => {
				const d = pathElement.getAttribute('d');
				const fillAttr = pathElement.getAttribute('fill');
				const hasFill = fillAttr && fillAttr !== 'none';
				
				if (d) {
					// Split path into segments based on Move commands (M or m)
					// Each Move command starts a new drawing segment that should animate independently
					
					// Simple approach: Split by Move commands that appear at word boundaries
					// Look for " M " or " m " (with spaces) or at start of string "M" or "m"
					// This avoids matching M/m inside other commands like "CM" or "ZM"
					const parts: string[] = [];
					let currentPart = '';
					
					// Split the path string manually, looking for Move commands
					let i = 0;
					while (i < d.length) {
						const char = d[i];
						
						// Check if this is a Move command at a valid position
						if ((char === 'M' || char === 'm') && 
						    (i === 0 || /[\s,]/.test(d[i - 1])) &&
						    /[-\d.]/.test(d[i + 1])) {
							// Found a Move command - save previous part and start new one
							if (currentPart.trim()) {
								parts.push(currentPart.trim());
							}
							currentPart = char;
							i++;
							// Continue reading coordinates until we hit another command or end
							while (i < d.length && /[-\d.,\s]/.test(d[i])) {
								currentPart += d[i];
								i++;
							}
							// Back up one character (the command we just read)
							if (i < d.length) {
								i--;
							}
						} else {
							currentPart += char;
						}
						i++;
					}
					
					// Add the last part
					if (currentPart.trim()) {
						parts.push(currentPart.trim());
					}
					
					// Helper to detect if path should be filled (small closed paths = text glyphs only)
					// Only fill small closed paths to avoid big white blocks - these are text character interiors
					const detectShouldFill = (pathD: string): boolean => {
						// Must be closed (explicitly or implicitly)
						const isExplicitlyClosed = /[Zz]\s*$/.test(pathD.trim());
						
						// Extract all coordinates to estimate bounding box
						const coords = pathD.match(/[-\d.]+/g)?.map(Number).filter(n => !isNaN(n)) || [];
						if (coords.length < 4) return false;
						
						const xs = coords.filter((_, i) => i % 2 === 0);
						const ys = coords.filter((_, i) => i % 2 === 1);
						const minX = Math.min(...xs);
						const maxX = Math.max(...xs);
						const minY = Math.min(...ys);
						const maxY = Math.max(...ys);
						
						const bboxWidth = maxX - minX;
						const bboxHeight = maxY - minY;
						const area = bboxWidth * bboxHeight;
						
						// Check if path is implicitly closed (start and end close together)
						// Use larger threshold to catch more closed paths that might have slight gaps
						const firstMove = pathD.match(/^[Mm]\s*([-\d.]+)[,\s]+([-\d.]+)/);
						let isClosed = isExplicitlyClosed;
						if (!isClosed && firstMove) {
							const startX = parseFloat(firstMove[1]) || 0;
							const startY = parseFloat(firstMove[2]) || 0;
							const lastX = coords[coords.length - 2];
							const lastY = coords[coords.length - 1];
							const distance = Math.sqrt(Math.pow(lastX - startX, 2) + Math.pow(lastY - startY, 2));
							// Increased threshold from 2px to 5px to catch more closed paths
							isClosed = distance < 5;
						}
						
						if (!isClosed) return false;
						
						// Fill SMALL closed paths (character interior holes like 'o', 'a', 'e', 'b', 'd', 'p', 'q')
						// NOT large letter outlines like 'D', 'A' - those should stay outline-only
						// Slightly increased threshold to catch more character holes
						const maxArea = (width * height) * 0.02;  // 2% of SVG area (was 1%)
						const maxWidth = width * 0.06;  // Max 6% of width (was 4%)
						const maxHeight = height * 0.06; // Max 6% of height (was 4%)
						
						return area < maxArea && bboxWidth < maxWidth && bboxHeight < maxHeight;
					};
					
					// Process parts - each part should be a valid path segment
					if (parts.length > 1) {
						// Multiple segments - process each independently for animation
						parts.forEach((segment) => {
							if (!segment) return;
							
							// Extract starting coordinates
							const coordMatch = segment.match(/^[Mm]\s*([-\d.]+)[,\s]+([-\d.]+)/);
							const startX = coordMatch ? parseFloat(coordMatch[1]) || 0 : 0;
							const startY = coordMatch ? parseFloat(coordMatch[2]) || 0 : 0;
							
							// Estimate path length for this segment
							const estimatedLength = estimatePathLength(segment, width, height);
							// If SVG has fill attribute, use it; otherwise detect from path shape
							const isTextLike = hasFill || detectShouldFill(segment);
							
							pathData.push({ d: segment, length: estimatedLength, startX, startY, isTextLike });
						});
					} else if (parts.length === 1) {
						// Single segment
						const segment = parts[0];
						const coordMatch = segment.match(/^[Mm]\s*([-\d.]+)[,\s]+([-\d.]+)/);
						const startX = coordMatch ? parseFloat(coordMatch[1]) || 0 : 0;
						const startY = coordMatch ? parseFloat(coordMatch[2]) || 0 : 0;
						const estimatedLength = estimatePathLength(segment, width, height);
						// If SVG has fill attribute, use it; otherwise detect from path shape
						const isTextLike = hasFill || detectShouldFill(segment);
						pathData.push({ d: segment, length: estimatedLength, startX, startY, isTextLike });
					} else {
						// No segments found - treat entire path as one
						const coordMatch = d.match(/^[Mm]\s*([-\d.]+)[,\s]+([-\d.]+)/);
						const startX = coordMatch ? parseFloat(coordMatch[1]) || 0 : 0;
						const startY = coordMatch ? parseFloat(coordMatch[2]) || 0 : 0;
						const estimatedLength = estimatePathLength(d, width, height);
						// If SVG has fill attribute, use it; otherwise detect from path shape
						const isTextLike = hasFill || detectShouldFill(d);
						pathData.push({ d, length: estimatedLength, startX, startY, isTextLike });
					}
				}
			});

			// Sort paths based on strategy
			if (revealStrategy === 'sequential') {
				// Sort top-to-bottom, left-to-right
				pathData.sort((a, b) => {
					const yDiff = a.startY - b.startY;
					if (Math.abs(yDiff) > 10) return yDiff;
					return a.startX - b.startX;
				});
			} else if (revealStrategy === 'parallel') {
				// Keep original order (all animate simultaneously)
				// No sorting needed
			} else {
				// balanced: Sort by position but group nearby paths
				pathData.sort((a, b) => {
					const yDiff = a.startY - b.startY;
					if (Math.abs(yDiff) > 20) return yDiff;
					const xDiff = a.startX - b.startX;
					if (Math.abs(xDiff) > 20) return xDiff;
					// Group by length for balanced animation
					return a.length - b.length;
				});
			}

			setPaths(pathData);
			setIsLoading(false);
		} catch (error) {
			console.error('[WhiteboardAnimatorPrecise] Failed to parse SVG:', error);
			setIsLoading(false);
		}
	}, [svgString, revealStrategy]);

	// Path lengths are already measured in the parsing effect above
	// No need for additional measurement during render

	// Determine current phase
	const isRevealPhase = currentFrame < revealDurationInFrames;
	const isHoldPhase = currentFrame >= revealDurationInFrames;

	// Calculate overall progress (0 to 1) for reveal phase
	const revealProgress = isRevealPhase
		? Math.min(1, currentFrame / revealDurationInFrames)
		: 1;

	// Apply smooth easing for reveal
	const easedRevealProgress = interpolate(revealProgress, [0, 1], [0, 1], {
		easing: Easing.bezier(0.25, 0.1, 0.25, 1), // Smooth ease-in-out
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});


	// Calculate path animation progress based on strategy
	const getPathProgress = (pathIndex: number, totalPaths: number): number => {
		if (revealStrategy === 'parallel') {
			// All paths animate simultaneously
			return easedRevealProgress;
		} else if (revealStrategy === 'sequential') {
			// Paths animate one after another
			const pathStart = pathIndex / totalPaths;
			const pathEnd = (pathIndex + 1) / totalPaths;
			if (easedRevealProgress < pathStart) return 0;
			if (easedRevealProgress > pathEnd) return 1;
			return (easedRevealProgress - pathStart) / (pathEnd - pathStart);
		} else {
			// balanced: Overlapping animation with staggered start
			const staggerAmount = 0.15; // 15% overlap between paths
			const pathStart = (pathIndex / totalPaths) * (1 - staggerAmount);
			const pathEnd = Math.min(1, pathStart + (1 / totalPaths) + staggerAmount);
			
			if (easedRevealProgress < pathStart) return 0;
			if (easedRevealProgress > pathEnd) return 1;
			
			const pathProgress = (easedRevealProgress - pathStart) / (pathEnd - pathStart);
			// Apply easing to individual path for smooth drawing
			return interpolate(pathProgress, [0, 1], [0, 1], {
				easing: Easing.out(Easing.ease),
				extrapolateLeft: 'clamp',
				extrapolateRight: 'clamp',
			});
		}
	};

	// Camera zoom during hold phase
	const zoomProgress = isHoldPhase
		? interpolate(
				currentFrame - holdStartFrame,
				[0, holdDurationInFrames],
				[1, 1.05], // Subtle zoom from 1x to 1.05x
				{
					easing: Easing.inOut(Easing.ease),
					extrapolateLeft: 'clamp',
					extrapolateRight: 'clamp',
				}
		  )
		: 1;

	// Keep overlay text disabled (per preference)
	const textOpacity = 0;

	if (isLoading) {
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

	if (paths.length === 0) {
		return (
			<AbsoluteFill
				style={{
					backgroundColor: '#0d5c2f', // Green board/chalkboard color
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<div style={{ color: '#ffffff', fontSize: 24 }}>No paths found in SVG</div>
			</AbsoluteFill>
		);
	}

	return (
		<AbsoluteFill
			style={{
				backgroundColor: '#0d5c2f', // Green board/chalkboard color
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				padding: '2%',
			}}
		>
			<div
				style={{
					transform: `scale(${zoomProgress})`,
					width: '100%',
					height: '100%',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
				}}
			>
				<svg
					width={svgWidth}
					height={svgHeight}
					viewBox={`0 0 ${svgWidth} ${svgHeight}`}
					preserveAspectRatio="xMidYMid meet"
					style={{
						maxWidth: '100%',
						maxHeight: '100%',
						width: 'auto',
						height: 'auto',
					}}
				>
					{/* Fill layer: white fill for all closed paths (rendered BEHIND strokes) */}
					<g fill="#ffffff" stroke="none" fillRule="evenodd">
						{paths.map((path, index) => {
							if (!path.isTextLike) return null;
							
							const pathProgress = isHoldPhase ? 1 : getPathProgress(index, paths.length);
							
							// Fill appears as soon as stroke starts (50% progress) to fill gaps immediately
							const fillProgress = interpolate(
								pathProgress,
								[0.5, 1],
								[0, 1], // Solid white fill (100% opacity) to completely fill gaps
								{
									extrapolateLeft: 'clamp',
									extrapolateRight: 'clamp',
									easing: Easing.inOut(Easing.ease),
								}
							);
							
							if (fillProgress <= 0) return null;
							
							return (
								<path
									key={`fill-${index}`}
									d={path.d}
									opacity={fillProgress}
									fillOpacity={1} // Explicitly set to ensure full opacity
								/>
							);
						})}
					</g>
					{/* Stroke layer: outline animation - white/chalk color on green board */}
					<g fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10">
						{paths.map((path, index) => {
							const pathProgress = isHoldPhase ? 1 : getPathProgress(index, paths.length);
							
							// Calculate dash array and offset for progressive drawing animation
							// For a drawing effect, we want the path to appear as if it's being drawn from start to finish
							// 
							// Technique:
							// 1. Create a dash pattern: [very_long_dash, huge_gap]
							//    - The dash must be long enough to cover the entire path when visible
							//    - The gap must be huge so only one dash is ever visible
							// 2. Animate the offset:
							//    - Start with offset = pathLength (dash is off-path, path is invisible)
							//    - End with offset = 0 (dash covers path, path is fully visible)
							//    - As offset decreases, the dash moves onto the path, revealing it progressively
							const estimatedPathLength = path.length;
							
							// Use a dash that's guaranteed to be longer than the path
							// Be conservative: multiply by 2.5 to ensure full coverage even if estimate is low
							// Minimum dash length based on SVG dimensions to ensure animation works for all paths
							const minDashLength = Math.max(500, Math.sqrt(svgWidth * svgHeight) * 0.3);
							const dashLength = Math.max(minDashLength, estimatedPathLength * 2.5);
							
							// Create dash pattern: [dash_length, huge_gap]
							// The huge gap (1000x dash length) ensures only one dash is visible at a time
							// This creates a continuous drawing effect without gaps
							const dashArray = `${dashLength} ${dashLength * 1000}`;
							
							// Calculate offset:
							// - When pathProgress = 0: offset = dashLength (dash is completely off-path, path hidden)
							// - When pathProgress = 1: offset = 0 (dash fully covers path, path visible)
							// - As pathProgress increases, offset decreases, revealing the path progressively
							const dashOffset = dashLength * (1 - pathProgress);

							return (
								<path
									key={`path-${index}`}
									d={path.d}
									strokeDasharray={dashArray}
									strokeDashoffset={dashOffset}
									vectorEffect="non-scaling-stroke"
								/>
							);
						})}
					</g>
				</svg>

				{/* Overlay text removed */}
			</div>
		</AbsoluteFill>
	);
};

