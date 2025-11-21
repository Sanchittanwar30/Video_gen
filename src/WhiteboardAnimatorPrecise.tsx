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
	topY: number; // Topmost Y coordinate of bounding box (for proper top-to-bottom sorting)
	bottomY: number; // Bottommost Y coordinate of bounding box
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
	// Allocate 90% of reveal for drawing, 10% for dwell - smoother sketching
	const drawWindowFrames = Math.max(1, Math.floor(revealDurationInFrames * 0.90));
	const holdStartFrame = drawWindowFrames;
	const holdDurationInFrames = sceneDurationInFrames - drawWindowFrames;

	// Parse SVG and extract paths
	// ALL HOOKS MUST BE CALLED UNCONDITIONALLY AT THE TOP LEVEL - NO CONDITIONAL HOOKS
	// FIXED: All hooks are now called unconditionally in the same order on every render
	const [paths, setPaths] = React.useState<PathData[]>([]);
	const [svgWidth, setSvgWidth] = React.useState<number>(1920);
	const [svgHeight, setSvgHeight] = React.useState<number>(1080);
	const [isLoading, setIsLoading] = React.useState(true);
	
	// Extract paths length as primitive for stable dependency comparison
	// This ensures useMemo dependencies are primitives, not object references
	// CRITICAL: pathsLengthPrimitive is a number, which is compared by value, not reference
	const pathsLengthPrimitive = paths.length;

	React.useEffect(() => {
		try {
			if (!svgString || svgString.trim().length === 0) {
				console.warn('[WhiteboardAnimatorPrecise] Empty SVG string provided');
				setIsLoading(false);
				return;
			}
			
			const parser = new DOMParser();
			const doc = parser.parseFromString(svgString, 'image/svg+xml');
			
			// Check for parsing errors
			const parserError = doc.querySelector('parsererror');
			if (parserError) {
				console.error('[WhiteboardAnimatorPrecise] SVG parsing error:', parserError.textContent);
				setIsLoading(false);
				return;
			}
			
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
			console.log(`[WhiteboardAnimatorPrecise] Found ${pathElements.length} path elements in SVG`);
			
			if (pathElements.length === 0) {
				console.warn('[WhiteboardAnimatorPrecise] No path elements found in SVG. SVG content preview:', svgString.substring(0, 500));
			}
			
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
					
					// Helper to detect if path is closed (for colorful fills)
					const detectIsClosed = (pathD: string): boolean => {
						// Must be closed (explicitly or implicitly)
						const isExplicitlyClosed = /[Zz]\s*$/.test(pathD.trim());
						
						// Extract all coordinates to estimate bounding box
						const coords = pathD.match(/[-\d.]+/g)?.map(Number).filter(n => !isNaN(n)) || [];
						if (coords.length < 4) return false;
						
						// Check if path is implicitly closed (start and end close together)
						const firstMove = pathD.match(/^[Mm]\s*([-\d.]+)[,\s]+([-\d.]+)/);
						let isClosed = isExplicitlyClosed;
						if (!isClosed && firstMove) {
							const startX = parseFloat(firstMove[1]) || 0;
							const startY = parseFloat(firstMove[2]) || 0;
							const lastX = coords[coords.length - 2];
							const lastY = coords[coords.length - 1];
							const distance = Math.sqrt(Math.pow(lastX - startX, 2) + Math.pow(lastY - startY, 2));
							// Use 10px threshold to catch closed shapes
							isClosed = distance < 10;
						}
						
						return isClosed;
					};
					
					// Helper to detect if path is a character hole (small closed paths inside letters like B, A, R, Q, O, D, P)
					// These should NOT be filled with colors - only larger diagram shapes should be filled
					const detectIsCharacterHole = (pathD: string): boolean => {
						if (!detectIsClosed(pathD)) return false;
						
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
						
						// Character holes are SMALL closed paths (interior holes in letters like B, A, R, Q, O, D, P)
						// These are typically < 3% of SVG area and < 8% of width/height
						const maxArea = (width * height) * 0.03;  // 3% of SVG area
						const maxWidth = width * 0.08;  // Max 8% of width
						const maxHeight = height * 0.08; // Max 8% of height
						
						return area < maxArea && bboxWidth < maxWidth && bboxHeight < maxHeight;
					};
					
					// Helper to detect if path should be filled (small closed paths = text glyphs only)
					// Only fill small closed paths to avoid big white blocks - these are text character interiors
					const detectShouldFill = (pathD: string): boolean => {
						// Use same logic as character hole detection (for text glyphs)
						return detectIsCharacterHole(pathD);
					};
					
					// Helper to calculate bounding box top/bottom Y for a path
					const calculateBoundingBoxY = (pathD: string): { topY: number; bottomY: number } => {
						const coords = pathD.match(/[-\d.]+/g)?.map(Number).filter(n => !isNaN(n)) || [];
						if (coords.length < 2) {
							// Fallback to startY if no coordinates
							const coordMatch = pathD.match(/^[Mm]\s*([-\d.]+)[,\s]+([-\d.]+)/);
							const y = coordMatch ? parseFloat(coordMatch[2]) || 0 : 0;
							return { topY: y, bottomY: y };
						}
						const ys = coords.filter((_, i) => i % 2 === 1); // All Y coordinates
						const topY = Math.min(...ys);
						const bottomY = Math.max(...ys);
						return { topY, bottomY };
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
							
							// Calculate bounding box Y coordinates for proper top-to-bottom sorting
							const { topY, bottomY } = calculateBoundingBoxY(segment);
							
							// Estimate path length for this segment
							const estimatedLength = estimatePathLength(segment, width, height);
							// If SVG has fill attribute, use it; otherwise detect from path shape
							const isTextLike = hasFill || detectShouldFill(segment);
							const isClosed = detectIsClosed(segment);
							
							pathData.push({ d: segment, length: estimatedLength, startX, startY, topY, bottomY, isTextLike, isClosed });
						});
					} else if (parts.length === 1) {
						// Single segment
						const segment = parts[0];
						const coordMatch = segment.match(/^[Mm]\s*([-\d.]+)[,\s]+([-\d.]+)/);
						const startX = coordMatch ? parseFloat(coordMatch[1]) || 0 : 0;
						const startY = coordMatch ? parseFloat(coordMatch[2]) || 0 : 0;
						
						// Calculate bounding box Y coordinates for proper top-to-bottom sorting
						const { topY, bottomY } = calculateBoundingBoxY(segment);
						
						const estimatedLength = estimatePathLength(segment, width, height);
						// If SVG has fill attribute, use it; otherwise detect from path shape
						const isTextLike = hasFill || detectShouldFill(segment);
						const isClosed = detectIsClosed(segment);
						pathData.push({ d: segment, length: estimatedLength, startX, startY, topY, bottomY, isTextLike, isClosed });
					} else {
						// No segments found - treat entire path as one
						const coordMatch = d.match(/^[Mm]\s*([-\d.]+)[,\s]+([-\d.]+)/);
						const startX = coordMatch ? parseFloat(coordMatch[1]) || 0 : 0;
						const startY = coordMatch ? parseFloat(coordMatch[2]) || 0 : 0;
						
						// Calculate bounding box Y coordinates for proper top-to-bottom sorting
						const { topY, bottomY } = calculateBoundingBoxY(d);
						
						const estimatedLength = estimatePathLength(d, width, height);
						// If SVG has fill attribute, use it; otherwise detect from path shape
						const isTextLike = hasFill || detectShouldFill(d);
						const isClosed = detectIsClosed(d);
						pathData.push({ d, length: estimatedLength, startX, startY, topY, bottomY, isTextLike, isClosed });
					}
				}
			});

			// Sort paths based on strategy
			if (revealStrategy === 'sequential') {
				// Sort by topmost Y coordinate (bounding box top) for true top-to-bottom ordering
				// This ensures boxes/fills at the bottom don't appear before elements above are complete
				pathData.sort((a, b) => {
					const topYDiff = a.topY - b.topY;
					// Use smaller tolerance (2px) for stricter top-to-bottom ordering
					if (Math.abs(topYDiff) > 2) return topYDiff;
					// If same top Y (within 2px), sort by bottom Y (smaller first - top elements complete first)
					const bottomYDiff = a.bottomY - b.bottomY;
					if (Math.abs(bottomYDiff) > 2) return bottomYDiff;
					// If same vertical position, sort left-to-right
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

			if (pathData.length === 0) {
				console.error('[WhiteboardAnimatorPrecise] No paths extracted from SVG! SVG preview:', svgString.substring(0, 500));
				setIsLoading(false);
				return;
			}
			
			setPaths(pathData);
			setIsLoading(false);
			console.log(`[WhiteboardAnimatorPrecise] Successfully parsed ${pathData.length} path segments`);
		} catch (error) {
			console.error('[WhiteboardAnimatorPrecise] Failed to parse SVG:', error);
			console.error('[WhiteboardAnimatorPrecise] SVG string length:', svgString?.length);
			console.error('[WhiteboardAnimatorPrecise] SVG preview:', svgString?.substring(0, 500));
			setIsLoading(false);
		}
	}, [svgString, revealStrategy]);

	// Path lengths are already measured in the parsing effect above
	// No need for additional measurement during render

	// Determine current phase
	const isRevealPhase = currentFrame < drawWindowFrames;
	const isHoldPhase = currentFrame >= drawWindowFrames;

	// Calculate overall progress (0 to 1) for reveal phase
	const revealProgress = isRevealPhase
		? Math.min(1, currentFrame / drawWindowFrames)
		: 1;

	// Precompute per-stroke schedule for constant-velocity drawing
	// speedSeconds = 0.0025 * lengthPixels (user-specified), with slight overlap between strokes (20ms)
	// CRITICAL FIX: Read paths directly but use pathsLengthPrimitive in dependency array
	// paths state is stable (only changes via setPaths), so reading it is safe
	const strokeSchedule = React.useMemo(() => {
		if (paths.length === 0) return [] as Array<{start: number; end: number; length: number}>;
		const secondsPerPixel = 0.0025;
		const overlapSeconds = 0.02; // 20ms
		const schedule: Array<{start: number; end: number; length: number}> = [];

		let cursorSeconds = 0;
		for (let i = 0; i < paths.length; i++) {
			const p = paths[i];
			const len = Math.max(1, p.length);
			const durSeconds = Math.max(1 / fps, len * secondsPerPixel);
			
			// For sequential strategy: strict top-to-bottom ordering
			// Wait for paths above to complete before starting paths below
			if (revealStrategy === 'sequential' && i > 0) {
				const prevPath = paths[i - 1];
				const prevSchedule = schedule[i - 1]; // Get previous schedule entry
				// If current path's top is below previous path's bottom, wait for previous to finish
				// Use 2px tolerance for strict ordering
				if (p.topY > prevPath.bottomY + 2) { // 2px gap tolerance
					// Start current path only after previous path is complete
					cursorSeconds = prevSchedule.end;
				}
				// If overlapping or close vertically (within 2px), allow slight overlap
				// cursorSeconds remains as is (allows natural overlap)
			}
			
			const start = cursorSeconds;
			const end = start + durSeconds;
			schedule.push({start, end, length: len});
			
			// Update cursor for next path (with overlap for non-sequential or overlapping paths)
			if (revealStrategy !== 'sequential' || i === 0 || (i > 0 && paths[i].topY <= paths[i - 1].bottomY + 2)) {
				cursorSeconds = end - overlapSeconds;
			} else {
				cursorSeconds = end; // No overlap for non-overlapping sequential paths
			}
		}

		// Fit into reveal duration
		const totalSecondsNeeded = schedule.length > 0 ? schedule[schedule.length - 1].end : 0;
		const revealSeconds = drawWindowFrames / fps;
		if (totalSecondsNeeded > 0 && totalSecondsNeeded > revealSeconds) {
			const scale = revealSeconds / totalSecondsNeeded;
			for (let i = 0; i < schedule.length; i++) {
				schedule[i] = {
					start: schedule[i].start * scale,
					end: schedule[i].end * scale,
					length: schedule[i].length,
				};
			}
		}

		// Convert to frames
		const frameSchedule = schedule.map((s) => ({
			start: Math.floor(s.start * fps),
			end: Math.max(Math.floor(s.end * fps), Math.floor(s.start * fps) + 1),
			length: s.length,
		}));
		
		// Ensure all paths have valid start/end frames and minimum duration
		// CRITICAL FIX: Ensure minimum duration of at least 2 frames per path for visible animation
		// Allow flexible start time (not forced to frame 0)
		for (let i = 0; i < frameSchedule.length; i++) {
			const s = frameSchedule[i];
			if (s.start < 0) s.start = 0;
			// Ensure minimum duration of 2 frames for visible animation
			const minDuration = 2;
			if (s.end <= s.start) {
				s.end = s.start + minDuration;
			} else if (s.end - s.start < minDuration) {
				// Extend duration to minimum if too short
				s.end = Math.min(s.start + minDuration, drawWindowFrames);
			}
			if (s.end > drawWindowFrames) s.end = drawWindowFrames;
		}
		
		return frameSchedule;
		// CRITICAL FIX: Use pathsLengthPrimitive (number) as dependency, not paths array
		// Reading paths inside useMemo is safe because paths only changes via setPaths (stable)
		// Using pathsLengthPrimitive ensures recalculation when paths length changes
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pathsLengthPrimitive, fps, drawWindowFrames, revealStrategy]);


	// Calculate path animation progress based on precomputed constant-velocity schedule
	const getPathProgress = (pathIndex: number): number => {
		const sched = strokeSchedule[pathIndex];
		if (!sched) {
			// If no schedule, check if we're past draw window - show fully drawn
			return currentFrame >= drawWindowFrames ? 1 : 0;
		}
		
		// CRITICAL FIX: Ensure currentFrame is relative to sequence start (0-based within sequence)
		// In Remotion, useCurrentFrame() inside a Sequence returns frames relative to sequence start
		// Use currentFrame clamped to draw window
		const t = Math.max(0, Math.min(currentFrame, drawWindowFrames));
		
		// Debug logging for troubleshooting (only log for first path at frame 0 to avoid spam)
		if (pathIndex === 0 && currentFrame === 0 && paths.length > 0) {
			console.log(`[WhiteboardAnimatorPrecise] Animation start: currentFrame=${currentFrame}, drawWindowFrames=${drawWindowFrames}, totalPaths=${paths.length}, schedule[0]={start:${sched.start}, end:${sched.end}}`);
		}

		// Fast-draw fallback: compress remaining schedule if behind
		let accel = 1;
		let remainingPlanned = 0;
		for (let i = 0; i < strokeSchedule.length; i++) {
			const s = strokeSchedule[i];
			if (s.end <= t) continue;
			const segStart = Math.max(t, s.start);
			remainingPlanned += Math.max(0, s.end - segStart);
		}
		const remainingWindow = Math.max(1, drawWindowFrames - t);
		if (remainingPlanned > remainingWindow && remainingWindow > 0) {
			accel = remainingPlanned / remainingWindow;
		}
		const effectiveEnd = sched.end > t ? Math.floor(t + Math.max(1, (sched.end - t) / accel)) : sched.end;
		const effectiveStart = Math.max(0, sched.start);

		if (t < effectiveStart) return 0;
		if (t >= effectiveEnd) return 1;
		// CRITICAL FIX: Ensure span is at least 1 to avoid division by zero or instant completion
		const span = Math.max(1, effectiveEnd - effectiveStart);
		const raw = (t - effectiveStart) / span; // linear in-stroke
		
		// Smoother easing for more natural pen movement
		// Use smooth bezier curve for continuous, fluid drawing motion
		return interpolate(raw, [0, 1], [0, 1], {
			easing: Easing.bezier(0.25, 0.1, 0.25, 1), // Smooth, natural pen movement
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		});
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

	// Compute bounding box of all paths to scale up to fill canvas
	// CRITICAL FIX: Read paths directly but use pathsLengthPrimitive in dependency array
	// paths state is stable (only changes via setPaths), so reading it is safe
	const bbox = React.useMemo(() => {
		if (paths.length === 0) return null;
		let minX = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;

		const updateFromD = (d: string) => {
			const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number).filter((n) => !isNaN(n)) || [];
			for (let i = 0; i + 1 < nums.length; i += 2) {
				const x = nums[i];
				const y = nums[i + 1];
				if (typeof x === 'number' && typeof y === 'number') {
					if (x < minX) minX = x;
					if (x > maxX) maxX = x;
					if (y < minY) minY = y;
					if (y > maxY) maxY = y;
				}
			}
		};

		paths.forEach((p) => updateFromD(p.d));

		if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
			return null;
		}
		return {minX, maxX, minY, maxY};
		// CRITICAL FIX: Use pathsLengthPrimitive (number) as dependency, not paths array
		// Reading paths inside useMemo is safe because paths only changes via setPaths (stable)
		// Using pathsLengthPrimitive ensures recalculation when paths length changes
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pathsLengthPrimitive]);

	// Build a transform that scales and centers the path bbox to fit with margins and consistent coverage
	// Extract values as primitives - these are stable once bbox is set
	const bboxMinX = bbox ? bbox.minX : null;
	const bboxMaxX = bbox ? bbox.maxX : null;
	const bboxMinY = bbox ? bbox.minY : null;
	const bboxMaxY = bbox ? bbox.maxY : null;
	const pathsLength = pathsLengthPrimitive;
	
	const groupTransform = React.useMemo(() => {
		if (bboxMinX === null || bboxMaxX === null || bboxMinY === null || bboxMaxY === null) {
			console.warn('[WhiteboardAnimatorPrecise] No bounding box available, using identity transform');
			return undefined;
		}
		const minX = bboxMinX;
		const maxX = bboxMaxX;
		const minY = bboxMinY;
		const maxY = bboxMaxY;
		const bboxWidth = Math.max(1, maxX - minX);
		const bboxHeight = Math.max(1, maxY - minY);

		// Validate bounding box is reasonable
		if (!isFinite(bboxWidth) || !isFinite(bboxHeight) || bboxWidth <= 0 || bboxHeight <= 0) {
			console.error('[WhiteboardAnimatorPrecise] Invalid bounding box:', {minX, maxX, minY, maxY, bboxWidth, bboxHeight});
			return undefined;
		}

		// Target framing parameters
		const paddingFraction = 0.07; // 7% padding (6–8% range)
		const targetCoverage = 0.78; // 72–82% coverage target

		// Available area after padding
		const availableWidth = svgWidth * (1 - 2 * paddingFraction);
		const availableHeight = svgHeight * (1 - 2 * paddingFraction);

		// Desired content size for consistent framing (independent of bbox aspect)
		const desiredWidth = svgWidth * targetCoverage;
		const desiredHeight = svgHeight * targetCoverage;

		// Compute scale candidates: coverage-based and padding-based clamp
		const scaleForCoverageW = desiredWidth / bboxWidth;
		const scaleForCoverageH = desiredHeight / bboxHeight;
		const scaleForPaddingW = availableWidth / bboxWidth;
		const scaleForPaddingH = availableHeight / bboxHeight;

		let scale = Math.min(scaleForCoverageW, scaleForCoverageH, scaleForPaddingW, scaleForPaddingH);

		// Validate scale is reasonable (prevent extreme scaling)
		if (!isFinite(scale) || scale <= 0 || scale > 100) {
			console.error('[WhiteboardAnimatorPrecise] Invalid scale calculated:', scale, {bboxWidth, bboxHeight, svgWidth, svgHeight});
			// Fallback: use a safe default scale
			scale = Math.min(svgWidth / bboxWidth, svgHeight / bboxHeight, 1);
			if (!isFinite(scale) || scale <= 0) {
				console.error('[WhiteboardAnimatorPrecise] Fallback scale also invalid, using identity');
				return undefined;
			}
		}

		// Small-zoom bonus for scenes with many small elements (improve legibility)
		const manySmallElements =
			pathsLength >= 80 ||
			(bboxWidth / svgWidth < 0.4 && bboxHeight / svgHeight < 0.4 && pathsLength >= 40);
		if (manySmallElements) {
			scale *= 1.1; // +10%
			// Re-clamp to padding
			scale = Math.min(scale, scaleForPaddingW, scaleForPaddingH);
		}

		const contentWidth = bboxWidth * scale;
		const contentHeight = bboxHeight * scale;

		// Center inside safe area
		const safeLeft = (svgWidth - availableWidth) / 2;
		const safeTop = (svgHeight - availableHeight) / 2;
		const offsetX = safeLeft + (availableWidth - contentWidth) / 2;
		const offsetY = safeTop + (availableHeight - contentHeight) / 2;

		// Validate offsets are finite
		if (!isFinite(offsetX) || !isFinite(offsetY)) {
			console.error('[WhiteboardAnimatorPrecise] Invalid offsets:', {offsetX, offsetY});
			return undefined;
		}

		// translate to origin, scale, then center
		return `translate(${offsetX},${offsetY}) scale(${scale}) translate(${-minX},${-minY})`;
	}, [bboxMinX, bboxMaxX, bboxMinY, bboxMaxY, svgWidth, svgHeight, pathsLength]);

	// Compute final transform with fallback if needed
	// CRITICAL FIX: This useMemo MUST be called BEFORE any early returns
	// Moving it here ensures all hooks are called unconditionally in the same order
	const finalTransform = React.useMemo(() => {
		if (groupTransform) {
			return groupTransform;
		}
		// Fallback: use a safe transform that centers and scales to fit
		// This ensures paths are always visible even if bounding box calculation fails
		// Only warn if paths are actually loaded (avoid false warnings during initial render)
		if (paths.length > 0) {
			console.warn('[WhiteboardAnimatorPrecise] No transform available - using fallback transform. Paths:', paths.length);
		}
		const fallbackScale = Math.min(svgWidth / 1920, svgHeight / 1080, 0.9);
		const fallbackTranslateX = (svgWidth - 1920 * fallbackScale) / 2;
		const fallbackTranslateY = (svgHeight - 1080 * fallbackScale) / 2;
		return `translate(${fallbackTranslateX},${fallbackTranslateY}) scale(${fallbackScale})`;
	}, [groupTransform, svgWidth, svgHeight]);

	return (
		<AbsoluteFill
			style={{
				backgroundColor: '#ffffff', // White background for black marker sketching
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				padding: 0,
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
					width="100%"
					height="100%"
					viewBox={`0 0 ${svgWidth} ${svgHeight}`}
					preserveAspectRatio="xMidYMid meet"
					style={{
						width: '100%',
						height: '100%',
					}}
				>
					{/* Stroke layer: black marker on white background; no fills */}
					<g
						fill="none"
						stroke="#000000"
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeMiterlimit="10"
						shapeRendering="geometricPrecision"
						transform={finalTransform}
					>
						{/* Last-resort small fade-in for non-incremental elements */}
						<g style={{opacity: interpolate(currentFrame, [0, Math.max(1, Math.round(fps * 0.06))], [0.98, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
						{paths.map((path, index) => {
							// Performance: Early skip if path is not in animation window
							const sched = strokeSchedule[index];
							if (!isHoldPhase && sched) {
								// CRITICAL FIX: Only skip if we're definitely before the start frame
								// Allow paths to render even slightly before start for smoother animation
								// Don't skip paths that are currently animating or already complete (they should be visible)
								if (currentFrame < Math.max(0, sched.start - 1)) {
									// Path hasn't started yet - skip rendering
									return null;
								}
							}
							
							// Skip border-like artifacts (unwanted boxes/bars at edges) - more aggressive filtering
							// Memoize border detection per path (computed once during parsing, stored in path metadata)
							// For now, compute inline but optimize with early returns
							const nums = path.d.match(/-?\d+(\.\d+)?/g)?.map(Number).filter((n) => !isNaN(n)) || [];
							if (nums.length < 4) {
								// Not enough coordinates for border detection
								const pathProgress = isHoldPhase ? 1 : getPathProgress(index);
								const estimatedPathLength = path.length;
								const minDashLength = Math.max(500, Math.sqrt(svgWidth * svgHeight) * 0.3);
								const dashLength = Math.max(minDashLength, estimatedPathLength * 2.5);
								const dashArray = `${dashLength} ${dashLength * 1000}`;
								const dashOffset = dashLength * (1 - pathProgress);
								
								return (
									<path
										key={`path-${index}`}
										d={path.d}
										strokeDasharray={dashArray}
										strokeDashoffset={dashOffset}
										vectorEffect="non-scaling-stroke"
										fill="none"
										stroke="#000000"
										strokeWidth="2.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								);
							}
							
							let pMinX = Infinity, pMaxX = -Infinity, pMinY = Infinity, pMaxY = -Infinity;
							for (let i = 0; i + 1 < nums.length; i += 2) {
								const x = nums[i], y = nums[i + 1];
								if (x < pMinX) pMinX = x;
								if (x > pMaxX) pMaxX = x;
								if (y < pMinY) pMinY = y;
								if (y > pMaxY) pMaxY = y;
							}
							const pW = Math.max(0, pMaxX - pMinX);
							const pH = Math.max(0, pMaxY - pMinY);
							
							// Skip bounding box rectangles (exact or very close to canvas dimensions)
							if (Math.abs(pW - svgWidth) < 10 && Math.abs(pH - svgHeight) < 10) {
								return null;
							}
							
							// Early exit for obvious borders (performance optimization - more aggressive)
							if (pW >= svgWidth * 0.85 && pH >= svgHeight * 0.85) {
								const nearLeft = pMinX <= svgWidth * 0.05;
								const nearRight = (svgWidth - pMaxX) <= svgWidth * 0.05;
								const nearTop = pMinY <= svgHeight * 0.05;
								const nearBottom = (svgHeight - pMaxY) <= svgHeight * 0.05;
								if ((nearLeft || nearRight) && (nearTop || nearBottom)) {
									return null;
								}
							}
							
							// Border box (large rectangle near edges - more aggressive)
							if (pW >= svgWidth * 0.80 && pH >= svgHeight * 0.80) {
								const nearLeft = pMinX <= svgWidth * 0.05;
								const nearRight = (svgWidth - pMaxX) <= svgWidth * 0.05;
								const nearTop = pMinY <= svgHeight * 0.05;
								const nearBottom = (svgHeight - pMaxY) <= svgHeight * 0.05;
								if ((nearLeft || nearRight) && (nearTop || nearBottom)) {
									return null;
								}
							}
							
							// Tall thin side bars (more aggressive - thinner threshold)
							if (pW <= svgWidth * 0.05 && pH >= svgHeight * 0.5) {
								const nearLeft = pMinX <= svgWidth * 0.05;
								const nearRight = (svgWidth - pMaxX) <= svgWidth * 0.05;
								if (nearLeft || nearRight) {
									return null;
								}
							}
							
							// Wide thin top/bottom bars (more aggressive - thinner threshold)
							if (pH <= svgHeight * 0.05 && pW >= svgWidth * 0.5) {
								const nearTop = pMinY <= svgHeight * 0.05;
								const nearBottom = (svgHeight - pMaxY) <= svgHeight * 0.05;
								if (nearTop || nearBottom) {
									return null;
								}
							}
							
							const pathProgress = isHoldPhase ? 1 : getPathProgress(index);
							
							// Performance: Skip fully drawn paths (already visible) - render without animation
							if (pathProgress >= 1) {
								return (
									<path
										key={`path-${index}`}
										d={path.d}
										fill="none"
										stroke="#000000"
										strokeWidth="2.5"
										strokeLinecap="round"
										strokeLinejoin="round"
										vectorEffect="non-scaling-stroke"
									/>
								);
							}
							
							// Performance: Skip paths that haven't started yet
							if (pathProgress <= 0) {
								return null;
							}
							
							// Calculate dash array and offset for progressive drawing animation
							// Memoize dash length calculation (based on path length, computed once)
							const estimatedPathLength = path.length; // pixels
							const minDashLength = Math.max(500, Math.sqrt(svgWidth * svgHeight) * 0.3);
							const dashLength = Math.max(minDashLength, estimatedPathLength * 2.5);
							const dashArray = `${dashLength} ${dashLength * 1000}`;
							const dashOffset = dashLength * (1 - pathProgress);

							// Black marker strokes for visible sketching animation on white background
							return (
								<path
									key={`path-${index}`}
									d={path.d}
									strokeDasharray={dashArray}
									strokeDashoffset={dashOffset}
									vectorEffect="non-scaling-stroke"
									fill="none"
									stroke="#000000"
									strokeWidth="2.5"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							);
						})}
						</g>
					</g>
				</svg>

				{/* Overlay text removed */}
			</div>
		</AbsoluteFill>
	);
};

