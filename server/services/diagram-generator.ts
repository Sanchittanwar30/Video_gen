/**
 * Diagram Generator Service
 * 
 * Generates JSON diagram data from prompts using Gemini.
 * The LLM outputs JSON, NOT SVG - the renderer converts JSON to SVG.
 */

import {callGeminiText} from './gemini';
import {DiagramStoryboard, validateStoryboardBounds, DEFAULT_PALETTE} from './diagram-schema';
import {renderStoryboardToSVG, cleanSVG} from './diagram-renderer';
import path from 'path';
import {promises as fs} from 'fs';
import {v4 as uuidv4} from 'uuid';

const DEFAULT_ASSETS_SUBDIR = path.join('public', 'assets');

const ensureAssetsDir = async () => {
	const configured = process.env.ASSETS_DIR;
	const absoluteDir = configured
		? path.resolve(process.cwd(), configured)
		: path.join(process.cwd(), DEFAULT_ASSETS_SUBDIR);
	await fs.mkdir(absoluteDir, {recursive: true});
	return absoluteDir;
};

const assetUrlFromPath = (absolutePath: string): string => {
	const configured = process.env.ASSETS_DIR
		? path.resolve(process.cwd(), process.env.ASSETS_DIR)
		: path.join(process.cwd(), DEFAULT_ASSETS_SUBDIR);
	const relative = path.relative(configured, absolutePath);
	return `/assets/${relative.replace(/\\/g, '/')}`;
};

export interface GeneratedDiagram {
	storyboard: DiagramStoryboard;
	svgUrl: string;
	width: number;
	height: number;
}

/**
 * Generates a diagram from a prompt
 * Returns JSON diagram data and renders it to SVG
 */
export async function generateDiagramFromPrompt(
	prompt: string,
	topic: string
): Promise<GeneratedDiagram | undefined> {
	try {
		console.log(`[Diagram Generator] Generating diagram for: ${prompt.substring(0, 100)}...`);
		
		// Create prompt for Gemini to generate JSON storyboard
		const generationPrompt = `Generate storyboards for whiteboard-style diagrams. OUTPUT ONLY valid JSON (no raw SVG, no HTML, no XML, no markdown, no code blocks). If you produce anything other than strict JSON the response is invalid.

### REQUIRED JSON SCHEMA (strict)

Output a single JSON object with these top-level keys:

{
  "meta": {
    "title": "<short title>",
    "frame": { "width": 1920, "height": 1080, "padding": 40 },
    "palette": {
      "bg":"#F7FAFC",
      "surface":"#FFFFFF",
      "primary":"#0B6E99",
      "accent":"#E76F51",
      "muted":"#94A3B8"
    }
  },
  "scenes": [
    {
      "id": "s1",
      "duration_frames": 75,
      "nodes": [
        {
          "id":"n1",
          "type":"card",
          "x":200, "y":150, "w":420, "h":120,
          "text":"Newton's First Law",
          "label":"Newton's First Law",
          "textSize":28,
          "colorKey":"primary",
          "meta": { "icon":"optional", "note":"optional" }
        }
      ],
      "connectors": [
        { "from":"n1", "to":"n2", "type":"curve", "arrow":true }
      ],
      "animation": {
        "stroke_draw_frames": 30,
        "fill_fade_start_frame": 18,
        "text_fade_start_frame": 36,
        "stagger_ms": 80
      }
    }
  ]
}

### HARD RULES (enforced)

1. NEVER output <svg>, <rect>, <foreignObject>, raw SVG elements, inline CSS, or any HTML/XML. Only the JSON schema above.
2. Do NOT output ERD tables, UML, or multi-column table shapes. Use only node types: "card", "text", "circle".
3. All coordinates (x,y,w,h) MUST be integers and lie fully inside [padding, width-padding] and [padding, height-padding] from meta.frame.
4. palette must use semantic keys only (bg,surface,primary,accent,muted).
5. duration_frames must be >= 75 for each scene.
6. animation fields must be present for each scene.
7. Provide meaningful ids (no duplicates) and human-readable text for nodes.
8. Keep output as compact JSON — no comments or extra fields outside schema unless under node.meta.

### TEXT FIELD REQUIREMENTS (CRITICAL)

9. EVERY node MUST include both "text" and "label" fields as plain text strings (double-quoted JSON strings).
10. "text" and "label" must contain the SAME content (label is a duplicate fallback).
11. Text must be plain text only — NO HTML, NO <foreignObject>, NO SVG, NO arrays, NO objects.
12. If text is longer than 240 characters, truncate to 240 chars and append "…".
13. If a node has no text, set both "text" and "label" to empty string "" (do not omit the fields).
14. Example valid node: { "id":"n1","type":"card","x":200,"y":150,"w":420,"h":120,"text":"Short plain text","label":"Short plain text","colorKey":"primary" }

Topic: ${topic}
Diagram Description: ${prompt}

Generate ONE scene that demonstrates the concept with 3-5 nodes (mix of card, circle, text types), 2-3 connectors, and proper animation timings. Ensure nodes are arranged with balanced spacing and coordinates inside the frame bounds.`;

		const jsonResponse = await callGeminiText(generationPrompt);
		
		// Parse JSON response
		let storyboard: DiagramStoryboard;
		try {
			// Remove markdown code blocks if present
			const cleanedJson = jsonResponse
				.replace(/```json\n?/g, '')
				.replace(/```\n?/g, '')
				.trim();
			storyboard = JSON.parse(cleanedJson);
		} catch (error) {
			console.error('[Diagram Generator] Failed to parse JSON:', error);
			console.error('[Diagram Generator] Response was:', jsonResponse.substring(0, 500));
			return undefined;
		}
		
		// Validate storyboard
		const validation = validateStoryboardBounds(storyboard);
		if (!validation.valid) {
			console.warn('[Diagram Generator] Storyboard validation errors:', validation.errors);
			// Try to fix coordinates that are out of bounds
			const {width, height, padding} = storyboard.meta.frame;
			for (const scene of storyboard.scenes) {
				// Ensure minimum duration
				if (scene.duration_frames < 75) {
					scene.duration_frames = 75;
				}
				// Fix node coordinates and normalize text fields
				for (const node of scene.nodes) {
					node.x = Math.max(padding, Math.min(width - padding, node.x));
					node.y = Math.max(padding, Math.min(height - padding, node.y));
					if (node.type === 'card' && node.w && node.h) {
						if (node.x + node.w > width - padding) {
							node.w = width - padding - node.x;
						}
						if (node.y + node.h > height - padding) {
							node.h = height - padding - node.y;
						}
					}
					
					// Normalize text and label fields (CRITICAL)
					// Convert to plain string, remove HTML/SVG, handle arrays/objects
					const normalizeText = (value: any): string => {
						if (value === null || value === undefined) return '';
						if (typeof value === 'string') {
							// Remove HTML tags, SVG elements, foreignObject
							let cleaned = value
								.replace(/<[^>]*>/g, '') // Remove HTML tags
								.replace(/&lt;/g, '<')
								.replace(/&gt;/g, '>')
								.replace(/&amp;/g, '&')
								.replace(/&quot;/g, '"')
								.replace(/&#39;/g, "'")
								.trim();
							// Truncate to 240 chars
							if (cleaned.length > 240) {
								cleaned = cleaned.substring(0, 240) + '…';
							}
							return cleaned;
						}
						if (Array.isArray(value)) {
							// Join array elements with space
							return normalizeText(value.join(' '));
						}
						if (typeof value === 'object') {
							// Try to extract text from object
							if (value.text) return normalizeText(value.text);
							if (value.label) return normalizeText(value.label);
							if (value.content) return normalizeText(value.content);
							return '';
						}
						return String(value).trim();
					};
					
					// Normalize text field
					const normalizedText = normalizeText(node.text);
					node.text = normalizedText;
					
					// Set label to same as text (duplicate fallback)
					if (node.label !== undefined) {
						node.label = normalizeText(node.label);
						// If label differs from text, prefer text
						if (node.label !== normalizedText) {
							node.label = normalizedText;
						}
					} else {
						node.label = normalizedText;
					}
					
					// Ensure both fields exist (even if empty)
					if (!node.text) node.text = '';
					if (!node.label) node.label = '';
				}
			}
		}
		
		// Ensure palette exists
		if (!storyboard.meta.palette) {
			storyboard.meta.palette = DEFAULT_PALETTE;
		}
		
		// Render storyboard to SVG (use first scene for now)
		const firstScene = storyboard.scenes[0];
		if (!firstScene) {
			console.error('[Diagram Generator] No scenes in storyboard');
			return undefined;
		}
		
		const svgString = renderStoryboardToSVG(storyboard, firstScene);
		
		// Clean SVG (remove unwanted elements)
		const cleanedSvg = cleanSVG(svgString);
		
		// Save SVG file
		const assetsDir = await ensureAssetsDir();
		const svgFilename = `diagram-${uuidv4()}.svg`;
		const svgPath = path.join(assetsDir, svgFilename);
		await fs.writeFile(svgPath, cleanedSvg, 'utf-8');
		
		const svgUrl = assetUrlFromPath(svgPath);
		
		const nodeCount = firstScene.nodes.length;
		const connectorCount = firstScene.connectors.length;
		console.log(`[Diagram Generator] ✓ Storyboard generated: Scene ${firstScene.id} with ${nodeCount} nodes, ${connectorCount} connectors`);
		console.log(`[Diagram Generator] SVG saved to: ${svgUrl}`);
		
		return {
			storyboard,
			svgUrl,
			svgString: cleanedSvg, // Include SVG content for direct use
			width: storyboard.meta.frame.width,
			height: storyboard.meta.frame.height,
		};
	} catch (error: any) {
		console.error('[Diagram Generator] Failed to generate diagram:', error.message);
		return undefined;
	}
}

