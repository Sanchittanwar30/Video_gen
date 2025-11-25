import { Router, Request, Response } from 'express';
import { config } from '../config';
import rateLimit from 'express-rate-limit';
import { callGeminiText } from '../services/gemini';
import { synthesizeSpeech } from '../services/deepgram';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { renderTemplateToMp4 } from '../../render/index';
import { renderMermaidToSvg } from '../services/mermaid-renderer';

const router = Router();

const diagramsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many diagram generation requests. Please wait a moment and try again.',
  },
});

/**
 * POST /api/diagrams/generate
 * Generate an architectural diagram from user input
 * Flow: LLM → Mermaid → SVG → Render
 */
router.post('/generate', diagramsLimiter, async (req: Request, res: Response) => {
  let browser: any = null;
  try {
    const { description, diagramType = 'sequenceDiagram' } = req.body;

    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    if (!config.ai.geminiApiKey) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    // Create prompt for Gemini to generate Mermaid sequence diagram
    const prompt = `You are a diagram generation assistant. Based on the user's description, generate ONLY Mermaid ${diagramType} code.

User request: ${description.trim()}

IMPORTANT RULES:
1. Output ONLY valid Mermaid ${diagramType} code
2. No markdown, no backticks, no explanations
3. Use simple participant names (max 20 participants)
4. Keep interactions concise (max 50 interactions)
5. For sequence diagrams, use proper syntax:
   - participant A as NameA
   - participant B as NameB
   - A->>B: Message
   - B-->>A: Response
6. Never include HTML, JS, SVG, or links

Generate the Mermaid code now:`;

    let mermaidCode: string;
    try {
      const rawResponse = await callGeminiText(prompt);
      
      // Clean up the response - remove markdown code blocks if present
      let cleaned = rawResponse.trim();
      
      // Remove markdown code blocks
      cleaned = cleaned.replace(/^```(?:mermaid)?\s*\n?/i, '').replace(/\n?```$/i, '');
      cleaned = cleaned.replace(/^~~~(?:mermaid)?\s*\n?/i, '').replace(/\n?~~~$/i, '');
      
      // Extract just the diagram code
      mermaidCode = cleaned.trim();
      
      // Basic validation - check if it starts with sequenceDiagram or other diagram types
      if (!mermaidCode.match(/^(sequenceDiagram|graph|flowchart|erDiagram|classDiagram|stateDiagram|gantt|pie|journey|gitgraph)/i)) {
        return res.status(502).json({ 
          error: 'Invalid Mermaid diagram code generated',
          message: 'The AI did not generate valid Mermaid code. Please try again with a clearer description.'
        });
      }
    } catch (error: any) {
      console.error('Gemini diagram generation failed:', error);
      return res.status(502).json({
        error: 'Failed to generate diagram',
        message: error?.message || 'AI response was invalid.',
      });
    }

    // Convert Mermaid code to SVG using Puppeteer
    let svg: string;
    try {
      // Launch browser
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      });
      
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Create HTML page with Mermaid
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: white;
    }
  </style>
</head>
<body>
  <div class="mermaid">
${mermaidCode}
  </div>
  <script>
    mermaid.initialize({ 
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose'
    });
  </script>
</body>
</html>`;

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        // Wait for Mermaid to render
        await page.waitForSelector('.mermaid svg', { timeout: 15000 });
        
        // Extract SVG
        svg = await page.$eval('.mermaid svg', (el) => {
          const svgElement = el as SVGElement;
          svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          return svgElement.outerHTML;
        });
      } finally {
        if (browser) {
          await browser.close().catch((err: any) => {
            console.warn('Error closing browser:', err);
          });
        }
      }
    } catch (error: any) {
      console.error('Mermaid rendering failed:', error);
      
      // Ensure browser is closed even on error
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.warn('Error closing browser on error:', closeError);
        }
      }
      
      return res.status(500).json({
        error: 'Failed to render diagram',
        message: error?.message || 'Invalid Mermaid syntax or Puppeteer error.',
        mermaidCode: mermaidCode, // Return the code for debugging
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      });
    }

    // Return the SVG and Mermaid code
    res.json({
      success: true,
      svg: svg,
      mermaidCode: mermaidCode,
      diagramType: diagramType,
    });
  } catch (error: any) {
    console.error('Error generating diagram:', error);
    
    // Ensure browser is closed on any error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.warn('Error closing browser:', closeError);
      }
    }
    
    const status = error?.response?.status || 500;
    const message = error?.response?.data?.error?.message || error?.message || 'Failed to generate diagram';
    res.status(status).json({ 
      error: 'Failed to generate diagram', 
      message,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
    });
  }
});

/**
 * POST /api/diagrams/generate-video
 * Generate a video from diagram with voiceover and subtitles
 * Flow: LLM → Mermaid → SVG → Voiceover Script → TTS Audio → Video Template → Video
 */
router.post('/generate-video', diagramsLimiter, async (req: Request, res: Response) => {
  let jobId: string | null = null;
  let tempDir: string | null = null;
  // Note: Using direct SVG animation now (no PNG/sketch video conversion needed)
  
  try {
    const { description, diagramType = 'sequenceDiagram', durationSeconds } = req.body;

    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    if (!config.ai.geminiApiKey) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    jobId = uuidv4();
    tempDir = path.join(process.cwd(), 'temp', `diagram-video-${jobId}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Step 1: Generate Mermaid diagram code with intelligent type selection
    const diagramPrompt = `You are an AI diagram generator for a text-to-video pipeline.

Your ONLY job is to convert a user's natural-language description into the correct Mermaid diagram code.

You MUST choose the correct Mermaid diagram type based on user intent:

━━━━━━━━━━━━━━━━━━
 DIAGRAM SELECTION (PRIORITY ORDER)
━━━━━━━━━━━━━━━━━━

CRITICAL: Check in this EXACT order - use the FIRST match:

1. ARCHITECTURE/ SYSTEM DESIGN (HIGHEST PRIORITY):
   If user mentions ANY of these keywords → Use graph LR or graph TD:
   - "architectural diagram", "architecture diagram", "architectural"
   - "system design", "system architecture", "system diagram"
   - "components", "services", "microservices", "service architecture"
   - "deployment diagram", "infrastructure", "tech stack"
   - "API architecture", "application architecture", "software architecture"
   - "cloud architecture", "distributed system", "system components"
   
   REQUIRED: Include FontAwesome icons for architectural components:
   - :fa:database: for databases
   - :fa:server: for servers/services
   - :fa:cloud: for cloud services
   - :fa:lock: for authentication/security
   - :fa:globe: for load balancers/gateways

2. SEQUENCE FLOW:
   If user asks for:
   - "sequence diagram", "sequence flow"
   - "API call flow", "request/response flow"
   - "interaction flow", "communication flow"
   - "user journey steps", "step-by-step flow"
   → Use sequenceDiagram

3. FLOWCHART/PROCESS:
   If user asks for:
   - "flowchart", "process flow"
   - "decision diagram", "workflow"
   - "business process", "algorithm flow"
   → Use flowchart LR (Mermaid flowchart)

4. ERD/DATABASE (LOWEST PRIORITY - ONLY if explicitly requested):
   ONLY if user EXPLICITLY asks for:
   - "ERD" or "Entity Relationship Diagram"
   - "database schema" (and clearly means tables/entities, not architecture)
   - "data model" with tables and relationships
   - "database design" with entities and foreign keys
   → Use erDiagram

   ⚠️ DO NOT use erDiagram for system/component architectures!

━━━━━━━━━━━━━━━━━━
 GLOBAL RULES
━━━━━━━━━━━━━━━━━━

1. Output ONLY Mermaid code — no explanation, no markdown, no backticks.
2. Keep IDs simple: letters, numbers, underscores only.
3. For labels with spaces, wrap using "label text".
4. Max 25 nodes/entities.
5. Never include HTML, JS, URLs, script tags, or SVG markup.
6. Do not mix diagram types. Only return one valid diagram.
7. PRIORITY RULES:
   - If user says "architectural" or "architecture" → MUST use graph LR/TD (NOT erDiagram)
   - If user mentions system/component/services → MUST use graph LR/TD
   - ERD should ONLY be used if explicitly requested with "ERD", "Entity Relationship", or "database schema" (tables)
   - When in doubt between architecture and ERD → choose architecture (graph LR/TD)
8. For architecture/system design diagrams, include icons using Mermaid icon syntax:
   - Use :fa: or :fontawesome: prefixes for FontAwesome icons
   - Examples: :fa:database:Database, :fa:server:Server, :fa:cloud:Cloud, :fa:lock:Auth
   - Include icons for: databases, servers, APIs, queues, caches, storage, load balancers

━━━━━━━━━━━━━━━━━━
 ER DIAGRAM RULES
━━━━━━━━━━━━━━━━━━

Use:
erDiagram
  ENTITY {
    type field PK?
    type field
  }
  ENTITY ||--o{ OTHER : relationship_name

Allowed types: int, string, float, boolean, datetime.

━━━━━━━━━━━━━━━━━━
 ARCHITECTURE DIAGRAM RULES
━━━━━━━━━━━━━━━━━━

Use:
graph LR
  subgraph GroupName
    ID1["Label"]
    ID2["Label"]
  end
  ID1 --> ID2

Use subgraphs for layers/services. Include FontAwesome icons where appropriate.

━━━━━━━━━━━━━━━━━━
 SEQUENCE DIAGRAM RULES
━━━━━━━━━━━━━━━━━━

Use:
sequenceDiagram
  participant A as "Label"
  A->>B: Message

Use ->>, -->> arrows. Keep order realistic and clean.

━━━━━━━━━━━━━━━━━━
 FLOWCHART DIAGRAM RULES
━━━━━━━━━━━━━━━━━━

Use:
flowchart LR
  A["Start"] --> B["Process"]

━━━━━━━━━━━━━━━━━━
 OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━

You must output ONLY the Mermaid diagram code.
No text above.
No text below.
No markdown.
No backticks.

━━━━━━━━━━━━━━━━━━
 EXAMPLES
━━━━━━━━━━━━━━━━━━

USER: "architectural diagram of a microservices ecommerce app"
OUTPUT (graph LR):
graph LR
  subgraph Client
    FE["Frontend :fa:globe:"]
  end
  subgraph "API Layer"
    API["API Gateway :fa:server:"]
  end
  subgraph Services
    AUTH["Auth Service :fa:lock:"]
    ORDER["Order Service :fa:server:"]
    PAY["Payment Service :fa:server:"]
  end
  subgraph Data
    DB["Database :fa:database:"]
    CACHE["Cache :fa:database:"]
  end
  FE --> API
  API --> AUTH
  API --> ORDER
  API --> PAY
  ORDER --> DB
  ORDER --> CACHE

USER: "ERD for hotel booking system"
OUTPUT (erDiagram):
erDiagram
  USER {
    int user_id PK
    string name
    string email
  }
  BOOKING {
    int booking_id PK
    datetime check_in
    datetime check_out
  }
  HOTEL {
    int hotel_id PK
    string name
  }
  USER ||--o{ BOOKING : makes
  HOTEL ||--o{ BOOKING : has

━━━━━━━━━━━━━━━━━━
 USER REQUEST
━━━━━━━━━━━━━━━━━━

User request: "${description.trim()}"

User specified diagram type (optional): ${diagramType || 'auto-detect'}

━━━━━━━━━━━━━━━━━━

CRITICAL: 
1. First check if the user request contains "architectural", "architecture", "system design", "components", "services", "microservices"
   → If YES, use graph LR or graph TD (NOT erDiagram)
2. Then check for sequence/flowchart keywords
3. ERD should ONLY be used if explicitly requested with "ERD" or "Entity Relationship"

Based on the user's request above, select the appropriate diagram type and generate the Mermaid code now.`;

    let mermaidCode: string;
    try {
      const rawResponse = await callGeminiText(diagramPrompt);
      let cleaned = rawResponse.trim();
      cleaned = cleaned.replace(/^```(?:mermaid)?\s*\n?/i, '').replace(/\n?```$/i, '');
      cleaned = cleaned.replace(/^~~~(?:mermaid)?\s*\n?/i, '').replace(/\n?~~~$/i, '');
      mermaidCode = cleaned.trim();
      
      if (!mermaidCode.match(/^(sequenceDiagram|graph|flowchart|erDiagram|classDiagram|stateDiagram|gantt|pie|journey|gitgraph)/i)) {
        return res.status(502).json({ 
          error: 'Invalid Mermaid diagram code generated',
          message: 'The AI did not generate valid Mermaid code. Please try again with a clearer description.'
        });
      }
      
      // Validate diagram type matches user intent (especially for architectural diagrams)
      const descriptionLower = description.trim().toLowerCase();
      const isArchitectureRequest = /architectur|system\s+design|components|services|microservices|deployment|infrastructure/.test(descriptionLower);
      const isErdRequest = /erd|entity\s+relationship|database\s+schema|tables?\s+and\s+relationships/.test(descriptionLower);
      const generatedType = mermaidCode.trim().split(/\s/)[0].toLowerCase();
      
      // If user requested architecture but got ERD, regenerate with stronger prompt
      if (isArchitectureRequest && !isErdRequest && generatedType === 'erdiagram') {
        console.warn('[Diagram] Architecture request generated ERD, regenerating with stronger prompt...');
        const architecturePrompt = `The user explicitly requested an ARCHITECTURAL DIAGRAM. Generate a graph LR or graph TD diagram showing system architecture with components, services, and infrastructure. Use FontAwesome icons.

User request: ${description.trim()}

Generate ONLY graph LR or graph TD code with icons (NOT erDiagram):`;
        
        const retryResponse = await callGeminiText(architecturePrompt);
        let retryCleaned = retryResponse.trim();
        retryCleaned = retryCleaned.replace(/^```(?:mermaid)?\s*\n?/i, '').replace(/\n?```$/i, '');
        retryCleaned = retryCleaned.replace(/^~~~(?:mermaid)?\s*\n?/i, '').replace(/\n?~~~$/i, '');
        
        if (retryCleaned.match(/^graph\s+(LR|TD)/i)) {
          mermaidCode = retryCleaned.trim();
          console.log('[Diagram] Successfully regenerated as architecture diagram');
        }
      }
    } catch (error: any) {
      console.error('Gemini diagram generation failed:', error);
      return res.status(502).json({
        error: 'Failed to generate diagram',
        message: error?.message || 'AI response was invalid.',
      });
    }

    // Step 2: Convert Mermaid to SVG using MCP-like rendering service
    let svg: string;
    try {
      console.log('[Diagram] Rendering Mermaid diagram to SVG using MCP service...');
      svg = await renderMermaidToSvg(mermaidCode);
      console.log('[Diagram] ✓ Successfully rendered Mermaid diagram to SVG');
    } catch (error: any) {
      console.error('[Diagram] Mermaid rendering failed:', error);
      return res.status(500).json({
        error: 'Failed to render diagram',
        message: error?.message?.includes('Mermaid') 
          ? error.message 
          : 'Invalid Mermaid syntax or rendering error. Please check your diagram description and try again.',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
        mermaidCode: process.env.NODE_ENV === 'development' ? mermaidCode : undefined,
      });
    }

    // Step 3: Generate voiceover script with automatic camera region detection
    const voiceoverPrompt = `Based on this Mermaid diagram code, create a natural, engaging, and comprehensive voiceover script (8-12 sentences) that thoroughly describes the architecture, flow, interactions, and key components. Additionally, identify 3-6 key regions or components that should be highlighted with camera focus.

Mermaid Diagram:
${mermaidCode}

User Description: ${description.trim()}

Your response MUST be valid JSON in this exact format:
{
  "script": "The full voiceover script as a single string, 8-12 sentences...",
  "regions": [
    {
      "component": "Component Name (e.g., Database, API Gateway, Frontend)",
      "sentenceIndex": 2,
      "x": 30,
      "y": 40,
      "zoom": 1.8,
      "description": "Brief description of what this region shows"
    }
  ]
}

IMPORTANT GUIDELINES:
1. Script: Write 8-12 natural, educational sentences that flow well. Each sentence should mention specific components.
2. Regions: Identify 3-6 key components/areas that should be highlighted:
   - For sequence diagrams: focus on participants (left to right, typically 10-30% spacing)
   - For flowcharts/graphs: identify major nodes (distributed across diagram)
   - X coordinates: 0-100 (0=left, 50=center, 100=right)
   - Y coordinates: 0-100 (0=top, 50=center, 100=bottom)
   - Zoom: 1.5-2.5 (1.5=mild zoom, 2.0=moderate, 2.5=close-up)
   - sentenceIndex: Which sentence number (0-based) mentions this component first
3. Distribute regions across the diagram to show different areas
4. Ensure regions don't overlap too much
5. For architectural diagrams, focus on: databases, APIs, servers, queues, storage, load balancers, etc.

Example for a sequence diagram with 4 participants:
{
  "script": "This diagram shows a microservices architecture with four key components. First, the API Gateway receives requests from clients. Then it forwards requests to the Authentication Service. After authentication, the request goes to the Business Logic Service. Finally, data is stored in the Database.",
  "regions": [
    {"component": "API Gateway", "sentenceIndex": 1, "x": 15, "y": 50, "zoom": 2.0},
    {"component": "Authentication Service", "sentenceIndex": 2, "x": 35, "y": 50, "zoom": 2.0},
    {"component": "Business Logic Service", "sentenceIndex": 3, "x": 65, "y": 50, "zoom": 2.0},
    {"component": "Database", "sentenceIndex": 4, "x": 85, "y": 50, "zoom": 2.0}
  ]
}

Generate the JSON response now (ONLY JSON, no markdown, no explanations):`;

    let voiceoverScript: string;
    let cameraRegions: Array<{
      component: string;
      sentenceIndex: number;
      x: number;
      y: number;
      zoom: number;
      description?: string;
    }> = [];
    
    try {
      const scriptResponse = await callGeminiText(voiceoverPrompt);
      let cleaned = scriptResponse.trim();
      
      // Remove markdown code blocks if present
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```$/i, '');
      cleaned = cleaned.replace(/^~~~(?:json)?\s*\n?/i, '').replace(/\n?~~~$/i, '');
      
      try {
        const parsed = JSON.parse(cleaned);
        voiceoverScript = parsed.script || scriptResponse.trim();
        cameraRegions = parsed.regions || [];
        
        console.log(`[Diagram Video] Generated ${cameraRegions.length} camera regions for automatic pan/zoom`);
      } catch (parseError) {
        // If JSON parsing fails, fall back to plain text
        console.warn('[Diagram Video] Failed to parse voiceover as JSON, using plain text');
        voiceoverScript = cleaned.replace(/^["']|["']$/g, '').trim();
        cameraRegions = [];
      }
      
      // Clean up any remaining quotes
      voiceoverScript = voiceoverScript.replace(/^["']|["']$/g, '').trim();
      
      if (!voiceoverScript || voiceoverScript.length < 80) {
        voiceoverScript = `This diagram illustrates a detailed sequence of interactions between components in the system. Each participant plays a crucial role in the process, and the arrows show the direction and timing of communications. The flow begins with an initial request and progresses through multiple steps where different components exchange information. Understanding this flow helps us see how different parts of the system work together to accomplish the overall goal. The sequence demonstrates the coordination required between various elements to complete the process successfully.`;
        cameraRegions = [];
      }
    } catch (error: any) {
      console.error('Voiceover script generation failed:', error);
      voiceoverScript = `This diagram illustrates the flow of interactions in the system. Each component communicates in a specific sequence to complete the process.`;
      cameraRegions = [];
    }

    // Step 4: Generate TTS audio from script with premium quality (same as main storyboard)
    let audioBuffer: Buffer;
    let audioDataUrl: string;
    try {
      // Use premium model for high-quality voiceover (same as main storyboard)
      audioBuffer = await synthesizeSpeech({
        text: voiceoverScript,
        model: 'aura-athena-2', // Premium model for best quality
        upbeat: true, // Upbeat delivery for educational content
      });
      audioDataUrl = `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`;
    } catch (error: any) {
      console.error('TTS generation failed:', error);
      return res.status(500).json({
        error: 'Failed to generate voiceover',
        message: error?.message || 'TTS service unavailable.',
      });
    }

    // Final validation: Ensure SVG is valid before proceeding
    if (!svg || !svg.trim().startsWith('<svg') || svg.includes('mermaid-error') || svg.includes('Diagram Error')) {
      console.error('[Diagram Video] Invalid SVG detected, aborting video generation');
      return res.status(500).json({
        error: 'Invalid diagram',
        message: 'The generated diagram contains errors. Please check your diagram description and try again with clearer instructions.',
      });
    }
    
    // Step 5: Prepare SVG for direct animation (no PNG conversion needed!)
    console.log('[Diagram Video] ✓ Using SVG directly for path-by-path animation');
    const svgPath = path.join(tempDir, 'diagram.svg');
    await fs.writeFile(svgPath, svg, 'utf-8');
    const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

    // Step 6: Estimate video duration from audio (rough estimate: 150 words per minute)
    const wordCount = voiceoverScript.split(/\s+/).length;
    const estimatedDurationSeconds = Math.max(
      durationSeconds || 10,
      Math.ceil((wordCount / 150) * 60) + 2 // Add 2 seconds buffer
    );
    const fps = 30;
    const totalFrames = estimatedDurationSeconds * fps;

    // Step 7: Create video template with enhanced animations (matching main storyboard quality)
    const introDuration = Math.floor(totalFrames * 0.15); // Intro period
    
    // Prepare word-by-word subtitles (YouTube-style)
    const words = voiceoverScript.split(/\s+/).filter(w => w.trim().length > 0);
    const wordsPerChunk = 2; // Show 2 words at a time for word-by-word effect
    const subtitleStartFrame = Math.floor(totalFrames * 0.2);
    const subtitleDuration = totalFrames - subtitleStartFrame;
    const framesPerChunk = Math.max(10, Math.floor(subtitleDuration / Math.ceil(words.length / wordsPerChunk)));
    
    // Build subtitle tracks for word-by-word display
    const subtitleTracks: any[] = [];
    for (let i = 0; i < words.length; i += wordsPerChunk) {
      const chunkWords = words.slice(i, i + wordsPerChunk);
      const chunkText = chunkWords.join(' ');
      const chunkIndex = Math.floor(i / wordsPerChunk);
      const chunkStartFrame = subtitleStartFrame + (chunkIndex * framesPerChunk);
      const chunkEndFrame = Math.min(totalFrames, chunkStartFrame + framesPerChunk + 5); // Small overlap
      
      subtitleTracks.push({
        type: 'text',
        content: chunkText,
        style: {
          fontSize: 32,
          fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
          color: '#FFFFFF',
          textAlign: 'center',
          x: 960,
          y: 980,
          width: 1600,
          anchor: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: '12px 24px',
          borderRadius: '8px',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
          textShadow: '0 1px 2px rgba(0,0,0,0.9)',
          lineHeight: '1.3',
          fontWeight: '400',
        },
        animation: { 
          type: 'fade-in', 
          duration: 0.15, 
          delay: 0 
        },
        startFrame: chunkStartFrame,
        endFrame: chunkEndFrame,
      });
    }
    
    // Generate automatic camera keyframes from regions and voiceover script
    const generateCameraKeyframes = () => {
      if (cameraRegions.length === 0) {
        return [];
      }
      
      // Split script into sentences
      const sentences = voiceoverScript.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      // Calculate timing for each sentence
      const introFrames = Math.floor(totalFrames * 0.15); // Intro period
      const contentFrames = totalFrames - introFrames - Math.floor(totalFrames * 0.1); // Content minus outro
      const framesPerSentence = Math.floor(contentFrames / Math.max(1, sentences.length));
      
      const keyframes: Array<{
        frame: number;
        scale: number;
        x: number;
        y: number;
      }> = [];
      
      // Start with overview (no zoom, centered)
      keyframes.push({
        frame: 0,
        scale: 1.0,
        x: 50,
        y: 50,
      });
      
      // Sort regions by sentence index
      const sortedRegions = [...cameraRegions].sort((a, b) => a.sentenceIndex - b.sentenceIndex);
      
      const transitionDuration = Math.floor(fps * 0.8); // 0.8 seconds transition
      const holdDuration = Math.floor(fps * 2.5); // Hold on each region for 2.5 seconds
      
      sortedRegions.forEach((region, index) => {
        const sentenceStartFrame = introFrames + (region.sentenceIndex * framesPerSentence);
        const zoomInFrame = sentenceStartFrame - transitionDuration / 2;
        const focusStartFrame = sentenceStartFrame;
        const focusEndFrame = sentenceStartFrame + holdDuration;
        const zoomOutFrame = focusEndFrame + transitionDuration / 2;
        
        // Zoom in to region
        keyframes.push({
          frame: Math.max(0, zoomInFrame),
          scale: 1.0,
          x: 50,
          y: 50,
        });
        
        keyframes.push({
          frame: focusStartFrame,
          scale: region.zoom || 1.8,
          x: Math.max(0, Math.min(100, region.x)),
          y: Math.max(0, Math.min(100, region.y)),
        });
        
        // Hold at focus
        keyframes.push({
          frame: focusEndFrame,
          scale: region.zoom || 1.8,
          x: Math.max(0, Math.min(100, region.x)),
          y: Math.max(0, Math.min(100, region.y)),
        });
        
        // Zoom out to overview (or next region)
        const nextRegionFrame = index < sortedRegions.length - 1
          ? introFrames + (sortedRegions[index + 1].sentenceIndex * framesPerSentence) - transitionDuration / 2
          : totalFrames - Math.floor(totalFrames * 0.1);
        
        keyframes.push({
          frame: Math.min(totalFrames - 1, zoomOutFrame),
          scale: index < sortedRegions.length - 1 ? 1.0 : 1.0,
          x: 50,
          y: 50,
        });
      });
      
      // End with overview
      keyframes.push({
        frame: totalFrames - 1,
        scale: 1.0,
        x: 50,
        y: 50,
      });
      
      // Remove duplicate keyframes and sort
      const uniqueKeyframes = keyframes
        .filter((kf, idx, arr) => {
          const prev = arr[idx - 1];
          return !prev || kf.frame !== prev.frame || kf.scale !== prev.scale || kf.x !== prev.x || kf.y !== prev.y;
        })
        .sort((a, b) => a.frame - b.frame);
      
      console.log(`[Diagram Video] Generated ${uniqueKeyframes.length} camera keyframes for automatic pan/zoom`);
      
      return uniqueKeyframes;
    };
    
    const cameraKeyframes = generateCameraKeyframes();
    
    // Build tracks array with direct SVG animation (no PNG conversion needed)
    const tracks: any[] = [
      // Enhanced background with gradient (like main storyboard)
      {
        type: 'background',
        src: 'linear-gradient(135deg, #1f2937 0%, #0f172a 50%, #1e293b 100%)',
        startFrame: 0,
        endFrame: totalFrames,
        style: { objectFit: 'cover' },
      },
    ];
    
    // Add diagram track with direct SVG animation (path-by-path drawing)
    const diagramSvgTrack: any = {
      type: 'image', // Using image type for SVG (will be rendered as animated SVG)
      src: '{{diagramSvg}}',
      style: {
        x: 960, // Center
        y: 540, // Center
        width: 3840, // Large diagram size for pan/zoom (4K)
        height: 2160, // Large diagram size for pan/zoom (4K)
        anchor: 'center',
        objectFit: 'contain',
      },
      // Enhanced animation: slide up from bottom with fade (like main storyboard)
      animation: { 
        type: 'slide', 
        duration: 1.2, 
        delay: 0.5,
        from: 'bottom' // Slide up from bottom with fade
      },
      // Using static SVG for now - path animation will be added once WhiteboardAnimatorPrecise is fixed for Mermaid
      animatePaths: false,
      startFrame: Math.floor(totalFrames * 0.1), // Start early, during intro
      endFrame: totalFrames,
    };
    
    // Add automatic camera pan/zoom keyframes if regions were detected
    if (cameraKeyframes.length > 0) {
      diagramSvgTrack.camera = {
        keyframes: cameraKeyframes,
      };
      console.log(`[Diagram Video] ✓ Added automatic camera pan/zoom with ${cameraKeyframes.length} keyframes`);
    }
    
    tracks.push(diagramSvgTrack);
    console.log(`[Diagram Video] Using static SVG rendering${cameraKeyframes.length > 0 ? ' with automatic camera pan/zoom' : ''}`);
    
    const template = {
      timeline: { duration: totalFrames, fps },
      tracks: [
        ...tracks,
        // Enhanced title track (appears first, like main storyboard)
        {
          type: 'text',
          content: '{{title}}',
          style: {
            fontSize: 64,
            fontFamily: 'Inter, Arial, sans-serif',
            color: '#f8fafc',
            fontWeight: 700,
            textAlign: 'center',
            x: 960,
            y: 180,
            width: 1500,
            anchor: 'center',
            textShadow: '0 12px 30px rgba(15, 23, 42, 0.45)',
          },
          animation: { 
            type: 'fade-in', 
            duration: 1.0, 
            delay: 0.4 
          },
          startFrame: Math.floor(totalFrames * 0.05),
          endFrame: Math.floor(totalFrames * 0.35), // Show title for first portion
        },
        // Word-by-word subtitle tracks (YouTube-style, like main storyboard)
        ...subtitleTracks,
        // Voiceover audio track with full volume
        {
          type: 'voiceover',
          src: '{{voiceoverAudio}}',
          startFrame: 0,
          endFrame: totalFrames,
          volume: 1.0,
        },
      ],
    };

    // Generate a better title from the diagram description using AI
    let diagramTitle: string;
    try {
      const titlePrompt = `Based on this diagram description, generate a concise, professional title (maximum 8 words) for a video about this diagram. The title should be clear and descriptive, not just repeat the description.

Description: ${description.trim()}

Respond with ONLY the title text, no quotes, no explanation, just the title.`;
      
      const titleResponse = await callGeminiText(titlePrompt);
      diagramTitle = titleResponse.trim()
        .replace(/^["']|["']$/g, '') // Remove quotes
        .replace(/^Title:\s*/i, '') // Remove "Title:" prefix if present
        .trim();
      
      // Validate and fallback if title is too long or empty
      if (!diagramTitle || diagramTitle.length > 80) {
        throw new Error('Title too long or empty');
      }
    } catch (titleError) {
      console.warn('[Diagram Video] Failed to generate AI title, using fallback');
      // Create a better fallback title from description
      const words = description.trim().split(/\s+/).slice(0, 6).join(' ');
      diagramTitle = words.length > 0 && words.length < 60
        ? words.charAt(0).toUpperCase() + words.slice(1)
        : 'System Architecture Diagram';
    }
    
    const input: Record<string, any> = {
      title: diagramTitle,
      subtitle: voiceoverScript, // Same as voiceover for subtitles
      diagramSvg: svgDataUrl,
      voiceoverAudio: audioDataUrl,
    };
    
    // SVG is used directly - no additional inputs needed

    // Step 8: Save template and input to files for rendering
    const templatePath = path.join(tempDir, 'template.json');
    const inputPath = path.join(tempDir, 'input.json');
    
    await fs.writeFile(templatePath, JSON.stringify(template, null, 2), 'utf-8');
    await fs.writeFile(inputPath, JSON.stringify(input, null, 2), 'utf-8');

    // Step 9: Render video
    const outputDir = path.join(process.cwd(), 'output');
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `${jobId}.mp4`);

    try {
      // Use same high-quality settings as AI storyboard videos
      // Resolution: 1920x1080, FPS: 30, Codec: h264, CRF: 18, Audio: AAC 320k
      await renderTemplateToMp4({
        templatePath,
        inputPath,
        outPath: outputPath,
        fps: 30, // Match AI storyboard FPS
        duration: totalFrames,
        width: 1920, // Full HD resolution (same as AI storyboard)
        height: 1080, // Full HD resolution (same as AI storyboard)
        lowResolution: false, // Use full quality (same as AI storyboard)
        highQuality: true, // Enable high quality: CRF 18, AAC 320k (matching AI storyboard)
      });
    } catch (renderError: any) {
      console.error('Video rendering failed:', renderError);
      throw new Error(`Failed to render video: ${renderError?.message || 'Unknown error'}`);
    }

    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp dir:', error);
    }

    // Return video URL and transcript
    res.json({
      success: true,
      videoUrl: `/output/${jobId}.mp4`,
      transcript: voiceoverScript,
      transcriptUrl: `/output/${jobId}.txt`, // We'll create this below
      mermaidCode: mermaidCode,
      diagramSvg: svgDataUrl,
      jobId: jobId,
    });

    // Save transcript file
    const transcriptPath = path.join(outputDir, `${jobId}.txt`);
    await fs.writeFile(transcriptPath, voiceoverScript, 'utf-8');

  } catch (error: any) {
    console.error('Error generating diagram video:', error);
    console.error('Error stack:', error?.stack);
    
    // Cleanup temp directory on error
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp dir on error:', cleanupError);
      }
    }
    
    const status = error?.response?.status || 500;
    const message = error?.response?.data?.error?.message || error?.message || 'Failed to generate diagram video';
    res.status(status).json({ 
      error: 'Failed to generate diagram video', 
      message,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
    });
  }
});

export default router;

