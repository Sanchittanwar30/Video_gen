/**
 * Whiteboard Diagram Schema
 * 
 * Defines the JSON structure for diagrams that will be rendered to SVG.
 * NO ERD tables, NO UML shapes - only whiteboard-style diagrams.
 */

export interface DiagramPalette {
	bg: string;        // Background color
	surface: string;   // Card/box fill color
	primary: string;   // Primary accent color
	accent: string;   // Secondary accent color
	muted: string;     // Muted text/line color
}

export const DEFAULT_PALETTE: DiagramPalette = {
	bg: '#F7FAFC',
	surface: '#FFFFFF',
	primary: '#0B6E99',
	accent: '#E76F51',
	muted: '#94A3B8',
};

export interface FrameMeta {
	width: number;
	height: number;
	padding: number;
}

export type NodeType = 'card' | 'text' | 'circle';
export type ConnectorType = 'line' | 'curve' | 'arrow';
export type ColorKey = 'primary' | 'accent' | 'muted' | 'surface';

export interface DiagramNode {
	id: string;
	type: NodeType;         // "card", "text", or "circle"
	x: number;              // X coordinate (must fit within frame)
	y: number;              // Y coordinate (must fit within frame)
	w?: number;             // Width (for cards)
	h?: number;             // Height (for cards)
	text: string;           // Text content (plain text, required, max 240 chars)
	label?: string;         // Label (duplicate fallback, same as text)
	textSize?: number;      // Font size (default: 28)
	colorKey: ColorKey;    // Color reference
	meta?: {
		icon?: string;      // Optional icon URL
		note?: string;      // Optional note
	};
}

export interface DiagramConnector {
	from: string;           // Source node ID
	to: string;           // Target node ID
	type: ConnectorType;   // Connector type
	arrow?: boolean;       // Whether to show arrowhead
	colorKey?: ColorKey;   // Optional color override
	label?: string;        // Optional label text
}

export interface SceneAnimation {
	stroke_draw_frames: number;    // Stroke drawing duration
	fill_fade_start_frame: number; // When fill starts fading in
	text_fade_start_frame: number; // When text starts fading in
	stagger_ms: number;            // Stagger between node reveals
}

export interface DiagramScene {
	id: string;
	duration_frames: number;        // Minimum 75 frames (~2.5s at 30fps)
	nodes: DiagramNode[];
	connectors: DiagramConnector[];
	animation: SceneAnimation;
}

export interface DiagramStoryboard {
	meta: {
		title: string;
		frame: FrameMeta;
		palette: DiagramPalette;
	};
	scenes: DiagramScene[];
}

/**
 * Validates that all coordinates are within frame bounds
 */
export function validateStoryboardBounds(storyboard: DiagramStoryboard): { valid: boolean; errors: string[] } {
	const errors: string[] = [];
	const {width, height, padding} = storyboard.meta.frame;
	const minX = padding;
	const maxX = width - padding;
	const minY = padding;
	const maxY = height - padding;
	
	for (const scene of storyboard.scenes) {
		// Validate duration
		if (scene.duration_frames < 75) {
			errors.push(`Scene ${scene.id}: duration_frames ${scene.duration_frames} is less than minimum 75`);
		}
		
		// Validate animation fields
		if (!scene.animation) {
			errors.push(`Scene ${scene.id}: missing animation object`);
		} else {
			if (scene.animation.stroke_draw_frames <= 0) {
				errors.push(`Scene ${scene.id}: stroke_draw_frames must be > 0`);
			}
		}
		
		// Validate nodes
		for (const node of scene.nodes) {
			// Validate text fields (CRITICAL)
			if (typeof node.text !== 'string') {
				errors.push(`Scene ${scene.id}, Node ${node.id}: "text" field must be a string, got ${typeof node.text}`);
			}
			if (node.text.length > 240) {
				errors.push(`Scene ${scene.id}, Node ${node.id}: "text" field exceeds 240 characters (${node.text.length} chars)`);
			}
			if (node.label !== undefined && typeof node.label !== 'string') {
				errors.push(`Scene ${scene.id}, Node ${node.id}: "label" field must be a string, got ${typeof node.label}`);
			}
			if (node.label !== undefined && node.label.length > 240) {
				errors.push(`Scene ${scene.id}, Node ${node.id}: "label" field exceeds 240 characters (${node.label.length} chars)`);
			}
			
			if (node.x < minX || node.x > maxX) {
				errors.push(`Scene ${scene.id}, Node ${node.id}: x coordinate ${node.x} is outside ${minX}-${maxX} range`);
			}
			if (node.y < minY || node.y > maxY) {
				errors.push(`Scene ${scene.id}, Node ${node.id}: y coordinate ${node.y} is outside ${minY}-${maxY} range`);
			}
			if (node.type === 'card') {
				if (!node.w || !node.h) {
					errors.push(`Scene ${scene.id}, Node ${node.id}: card type requires w and h`);
				} else {
					if (node.x + node.w > maxX) {
						errors.push(`Scene ${scene.id}, Node ${node.id}: extends beyond right edge (x: ${node.x}, w: ${node.w})`);
					}
					if (node.y + node.h > maxY) {
						errors.push(`Scene ${scene.id}, Node ${node.id}: extends beyond bottom edge (y: ${node.y}, h: ${node.h})`);
					}
				}
			}
		}
		
		// Validate connectors reference existing nodes
		const nodeIds = new Set(scene.nodes.map(n => n.id));
		for (const connector of scene.connectors) {
			if (!nodeIds.has(connector.from)) {
				errors.push(`Scene ${scene.id}, Connector: from node "${connector.from}" does not exist`);
			}
			if (!nodeIds.has(connector.to)) {
				errors.push(`Scene ${scene.id}, Connector: to node "${connector.to}" does not exist`);
			}
		}
	}
	
	return { valid: errors.length === 0, errors };
}

