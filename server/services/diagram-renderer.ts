/**
 * Diagram Renderer
 * 
 * Converts JSON diagram data to clean SVG following whiteboard style rules.
 * NO ERD tables, NO UML shapes - only whiteboard elements.
 */

import { DiagramStoryboard, DiagramScene, DiagramNode, DiagramConnector, DEFAULT_PALETTE, DiagramPalette } from './diagram-schema';

const CARD_RX = 16; // Corner radius for cards
const STROKE_WIDTH = 2.5;
const DEFAULT_TEXT_SIZE = 28;

/**
 * Renders a storyboard scene to SVG string
 */
export function renderStoryboardToSVG(storyboard: DiagramStoryboard, scene: DiagramScene): string {
	const palette = storyboard.meta.palette || DEFAULT_PALETTE;
	const {width, height} = storyboard.meta.frame;
	
	// Build SVG defs (shadows, gradients, etc.)
	const defs = buildSVGDefs(palette);
	
	// Render nodes
	const nodeElements: string[] = [];
	const textElements: string[] = [];
	
	for (const node of scene.nodes) {
		const color = palette[node.colorKey];
		const textSize = node.textSize || DEFAULT_TEXT_SIZE;
		
		// Get text content: prefer "text" field, fallback to "label"
		const nodeText = (node.text || node.label || '').trim();
		
		// Render shape based on type - CONVERT ALL TO PATHS for animation compatibility
		if (node.type === 'card') {
			const w = node.w || 200;
			const h = node.h || 100;
			// Convert rect to path (rounded rectangle outline)
			// Rounded rectangle path: Start top-left (after corner), go clockwise
			const x = node.x;
			const y = node.y;
			const rx = CARD_RX;
			const pathD = `M ${x + rx},${y} L ${x + w - rx},${y} Q ${x + w},${y} ${x + w},${y + rx} L ${x + w},${y + h - rx} Q ${x + w},${y + h} ${x + w - rx},${y + h} L ${x + rx},${y + h} Q ${x},${y + h} ${x},${y + h - rx} L ${x},${y + rx} Q ${x},${y} ${x + rx},${y} Z`;
			nodeElements.push(
				`<path d="${pathD}" fill="${palette.surface}" stroke="${color}" stroke-width="${STROKE_WIDTH}" filter="url(#softShadow)"/>`
			);
			// Text for card (centered)
			if (nodeText) {
				textElements.push(
					`<text x="${node.x + w / 2}" y="${node.y + h / 2}" ` +
					`font-size="${textSize}" fill="${color}" text-anchor="middle" ` +
					`dominant-baseline="middle" font-family="system-ui, -apple-system, sans-serif">${escapeXML(nodeText)}</text>`
				);
			}
		} else if (node.type === 'circle') {
			// For circles, use w as diameter if provided, otherwise default radius
			const radius = node.w ? node.w / 2 : 50;
			// Convert circle to path (circle outline)
			// Circle path using 4 arcs: M cx,cy-r A r,r 0 0,1 cx,cy+r A r,r 0 0,1 cx,cy-r Z
			const pathD = `M ${node.x},${node.y - radius} A ${radius},${radius} 0 0,1 ${node.x},${node.y + radius} A ${radius},${radius} 0 0,1 ${node.x},${node.y - radius} Z`;
			nodeElements.push(
				`<path d="${pathD}" fill="${palette.surface}" stroke="${color}" stroke-width="${STROKE_WIDTH}" filter="url(#softShadow)"/>`
			);
			// Text for circle (centered)
			if (nodeText) {
				textElements.push(
					`<text x="${node.x}" y="${node.y}" font-size="${textSize}" ` +
					`fill="${color}" text-anchor="middle" dominant-baseline="middle" ` +
					`font-family="system-ui, -apple-system, sans-serif">${escapeXML(nodeText)}</text>`
				);
			}
		} else if (node.type === 'text') {
			// Text-only node (no shape, just text)
			if (nodeText) {
				textElements.push(
					`<text x="${node.x}" y="${node.y}" font-size="${textSize}" ` +
					`fill="${color}" font-family="system-ui, -apple-system, sans-serif">${escapeXML(nodeText)}</text>`
				);
			}
		}
	}
	
	// Render connectors
	const connectorElements: string[] = [];
	for (const connector of scene.connectors) {
		const fromNode = scene.nodes.find(n => n.id === connector.from);
		const toNode = scene.nodes.find(n => n.id === connector.to);
		
		if (!fromNode || !toNode) continue;
		
		const color = connector.colorKey ? palette[connector.colorKey] : palette.primary;
		
		// Calculate connector endpoints based on node types
		let fromX = fromNode.x;
		let fromY = fromNode.y;
		let toX = toNode.x;
		let toY = toNode.y;
		
		// Adjust endpoints for cards (connect to edge)
		if (fromNode.type === 'card' && fromNode.w && fromNode.h) {
			const centerX = fromNode.x + fromNode.w / 2;
			const centerY = fromNode.y + fromNode.h / 2;
			const angle = Math.atan2(toY - centerY, toX - centerX);
			fromX = centerX + Math.cos(angle) * (fromNode.w / 2);
			fromY = centerY + Math.sin(angle) * (fromNode.h / 2);
		}
		if (toNode.type === 'card' && toNode.w && toNode.h) {
			const centerX = toNode.x + toNode.w / 2;
			const centerY = toNode.y + toNode.h / 2;
			const angle = Math.atan2(centerY - fromY, centerX - fromX);
			toX = centerX - Math.cos(angle) * (toNode.w / 2);
			toY = centerY - Math.sin(angle) * (toNode.h / 2);
		} else if (toNode.type === 'circle') {
			const radius = toNode.w ? toNode.w / 2 : 50;
			const angle = Math.atan2(toY - fromY, toX - fromX);
			toX = toNode.x - Math.cos(angle) * radius;
			toY = toNode.y - Math.sin(angle) * radius;
		}
		
		// Convert all connectors to paths for animation compatibility
		if (connector.type === 'line' || (connector.type === 'curve' && !connector.arrow)) {
			if (connector.type === 'line') {
				// Convert line to path
				connectorElements.push(
					`<path d="M ${fromX} ${fromY} L ${toX} ${toY}" ` +
					`fill="none" stroke="${color}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round"/>`
				);
			} else {
				// Curve
				const midX = (fromX + toX) / 2;
				const midY = (fromY + toY) / 2;
				const controlY = midY - 50; // Curve upward
				connectorElements.push(
					`<path d="M ${fromX} ${fromY} Q ${midX} ${controlY} ${toX} ${toY}" ` +
					`fill="none" stroke="${color}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round"/>`
				);
			}
		} else if (connector.type === 'arrow' || connector.arrow) {
			// Arrow: line path + arrowhead path
			const angle = Math.atan2(toY - fromY, toX - fromX);
			const arrowLength = 20;
			const arrowAngle = Math.PI / 6; // 30 degrees
			const arrowX = toX - Math.cos(angle) * arrowLength;
			const arrowY = toY - Math.sin(angle) * arrowLength;
			const arrowX1 = arrowX - Math.cos(angle - arrowAngle) * 15;
			const arrowY1 = arrowY - Math.sin(angle - arrowAngle) * 15;
			const arrowX2 = arrowX - Math.cos(angle + arrowAngle) * 15;
			const arrowY2 = arrowY - Math.sin(angle + arrowAngle) * 15;
			
			// Line part as path
			connectorElements.push(
				`<path d="M ${fromX} ${fromY} L ${arrowX} ${arrowY}" ` +
				`fill="none" stroke="${color}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round"/>`
			);
			// Arrowhead as path
			connectorElements.push(
				`<path d="M ${toX} ${toY} L ${arrowX1} ${arrowY1} L ${arrowX2} ${arrowY2} Z" ` +
				`fill="${color}" stroke="${color}" stroke-width="${STROKE_WIDTH}"/>`
			);
		}
		
		// Label if provided
		if (connector.label) {
			const labelX = (fromX + toX) / 2;
			const labelY = (fromY + toY) / 2 - 20;
			textElements.push(
				`<text x="${labelX}" y="${labelY}" font-size="20" fill="${palette.muted}" ` +
				`text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">${escapeXML(connector.label)}</text>`
			);
		}
	}
	
	// Combine all elements
	const svgContent = [
		defs,
		'<g id="connectors">',
		...connectorElements,
		'</g>',
		'<g id="nodes">',
		...nodeElements,
		'</g>',
		'<g id="text">',
		...textElements,
		'</g>',
	].join('\n\t');
	
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
	${svgContent}
</svg>`;
}

/**
 * Builds SVG defs section (filters, gradients, etc.)
 */
function buildSVGDefs(palette: DiagramPalette): string {
	return `<defs>
		<filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
			<feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
			<feOffset dx="0" dy="2" result="offsetblur"/>
			<feComponentTransfer>
				<feFuncA type="linear" slope="0.3"/>
			</feComponentTransfer>
			<feMerge>
				<feMergeNode/>
				<feMergeNode in="SourceGraphic"/>
			</feMerge>
		</filter>
		<style>
			:root {
				--bg: ${palette.bg};
				--surface: ${palette.surface};
				--primary: ${palette.primary};
				--accent: ${palette.accent};
				--muted: ${palette.muted};
			}
		</style>
	</defs>`;
}

/**
 * Escapes XML special characters
 */
function escapeXML(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Cleans SVG by removing unwanted elements
 */
export function cleanSVG(svgString: string): string {
	let cleaned = svgString;
	
	// Remove unwanted rect elements (except those in our nodes)
	// We'll keep rects that are part of card shapes (they have rx attribute)
	cleaned = cleaned.replace(/<rect(?![^>]*rx=)[^>]*>/gi, (match) => {
		// Check if it's a full-frame background
		const widthMatch = match.match(/width\s*=\s*["']([^"']+)["']/i);
		const heightMatch = match.match(/height\s*=\s*["']([^"']+)["']/i);
		if (widthMatch && heightMatch) {
			const w = parseFloat(widthMatch[1]);
			const h = parseFloat(heightMatch[1]);
			// Remove if it's a full-frame background (>95% coverage)
			if (w >= 1920 * 0.95 && h >= 1080 * 0.95) {
				return '';
			}
		}
		return match; // Keep other rects
	});
	
	// Remove foreignObject elements
	cleaned = cleaned.replace(/<foreignObject[^>]*>[\s\S]*?<\/foreignObject>/gi, '');
	
	// Remove invisible elements
	cleaned = cleaned.replace(/<[^>]*(?:display\s*:\s*none|visibility\s*:\s*hidden)[^>]*>[\s\S]*?<\/[^>]+>/gi, '');
	cleaned = cleaned.replace(/<[^>]*(?:display\s*=\s*["']none["']|visibility\s*=\s*["']hidden["'])[^>]*\/>/gi, '');
	
	// Ensure viewBox is exactly "0 0 1920 1080"
	cleaned = cleaned.replace(/viewBox\s*=\s*["'][^"']*["']/gi, 'viewBox="0 0 1920 1080"');
	
	// Remove stray transforms that might cause issues
	// (We keep transforms in our generated elements, but remove unexpected ones)
	// This is a conservative approach - we'll be more specific if needed
	
	return cleaned;
}

