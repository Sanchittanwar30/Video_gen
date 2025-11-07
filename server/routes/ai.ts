import { Router, Request, Response } from 'express';
import { config } from '../config';
import axios from 'axios';
import rateLimit from 'express-rate-limit';

const router = Router();

const createSvgDataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const createBackgroundDataUrl = (from: string, to: string) =>
  createSvgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#grad)"/></svg>`
  );

const createLogoDataUrl = (text: string) =>
  createSvgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="100%" height="100%" fill="#ffffff"/><text x="50%" y="50%" font-family="Arial, sans-serif" font-size="48" fill="#1f2937" text-anchor="middle" dominant-baseline="middle">${text}</text></svg>`
  );

const routerLimiterMessage = 'Too many AI content generation requests. Please wait a moment and try again.';

// Simple exponential backoff helper
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const MIN_GEMINI_INTERVAL_MS = parseInt(process.env.GEMINI_MIN_INTERVAL_MS || process.env.OPENAI_MIN_INTERVAL_MS || '4000', 10);
let lastGeminiCall = 0;

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many AI content generation requests. Please wait a moment and try again.',
  },
});

async function callGemini(prompt: string, attempt = 1): Promise<string> {
  if (!config.ai.geminiApiKey) {
    throw new Error('Gemini API key not configured');
  }

  try {
    const now = Date.now();
    const elapsed = now - lastGeminiCall;
    if (elapsed < MIN_GEMINI_INTERVAL_MS) {
      await wait(MIN_GEMINI_INTERVAL_MS - elapsed);
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.ai.geminiModel}:generateContent?key=${config.ai.geminiApiKey}`;

    const response = await axios.post(
      url,
      {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${prompt}

Return only valid JSON with keys: title, subtitle, backgroundImage, logoImage${prompt.includes('voiceover') ? ', voiceoverScript' : ''}.` ,
              },
            ],
          },
        ],
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      }
    );

    lastGeminiCall = Date.now();

    const candidates = response.data?.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('Gemini returned no content');
    }

    const parts = candidates[0]?.content?.parts || [];
    const text = parts.map((p: any) => p.text || '').join('').trim();
    if (!text) {
      throw new Error('Gemini returned empty response');
    }
    return text;
  } catch (error: any) {
    const status = error.response?.status;
    if (status === 429 && attempt < 5) {
      const delay = MIN_GEMINI_INTERVAL_MS * Math.pow(2, attempt - 1);
      console.warn(`Gemini rate limit hit (attempt ${attempt}). Retrying in ${delay}ms.`);
      await wait(delay);
      return callGemini(prompt, attempt + 1);
    }
    throw error;
  }
}

const DEFAULT_BACKGROUNDS: Record<string, string> = {
  professional: createBackgroundDataUrl('#1f2937', '#0f172a'),
  casual: createBackgroundDataUrl('#2563eb', '#1d4ed8'),
  creative: createBackgroundDataUrl('#8b5cf6', '#7c3aed'),
  minimalist: createBackgroundDataUrl('#111827', '#0f172a'),
  default: createBackgroundDataUrl('#1f2937', '#0f172a'),
};

const FALLBACK_LOGO = createLogoDataUrl('Your Logo');

const sanitizeAssetUrl = (value: any, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('data:')) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
};

router.post('/generate-content', aiLimiter, async (req: Request, res: Response) => {
  try {
    const {
      topic,
      description = '',
      style = 'professional',
      duration = 10,
      includeAudio = false,
      backgroundType = 'image',
      backgroundColor = '#667eea',
    } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    if (!config.ai.geminiApiKey) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const prompt = `Create a video script for a ${duration}-second ${style} video about: ${topic}.

Additional context:
${description}

Requirements:
- Generate a compelling title (max 60 characters)
- Generate a subtitle/description (max 120 characters)
- Suggest a background image URL (use Unsplash or similar)
- Provide a logo image URL (placeholder is acceptable)
- Style: ${style}`;

    const geminiText = await callGemini(prompt);
    let rawText = geminiText.trim();
    if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
    }
    let generated: any;
    try {
      generated = JSON.parse(rawText);
    } catch (err) {
      console.error('Failed to parse Gemini response as JSON:', geminiText);
      return res.status(502).json({ error: 'Invalid response from Gemini', message: 'AI response was not valid JSON.' });
    }

    // Build template
    const fps = 30;
    const totalFrames = duration * fps;

    const fallbackBackground = DEFAULT_BACKGROUNDS[style] || DEFAULT_BACKGROUNDS.default;
    const backgroundImageUrl = sanitizeAssetUrl(generated.backgroundImage, fallbackBackground);
    const logoImageUrl = sanitizeAssetUrl(generated.logoImage, FALLBACK_LOGO);

    const template: any = {
      timeline: { duration: totalFrames, fps },
      tracks: [
        {
          type: 'background',
          src:
            backgroundType === 'image'
              ? '{{backgroundImage}}'
              : backgroundType === 'gradient'
              ? `linear-gradient(135deg, ${backgroundColor} 0%, #764ba2 100%)`
              : backgroundColor,
          startFrame: 0,
          endFrame: totalFrames,
          style: { objectFit: 'cover' },
        },
        {
          type: 'text',
          content: '{{title}}',
          style: {
            fontSize: 72,
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
            fontWeight: 'bold',
            textAlign: 'center',
            x: 960,
            y: 400,
            width: 1400,
          },
          animation: { type: 'fade-in', duration: 1.0, delay: 0.5 },
          startFrame: Math.floor(totalFrames * 0.1),
          endFrame: Math.floor(totalFrames * 0.6),
        },
        {
          type: 'text',
          content: '{{subtitle}}',
          style: {
            fontSize: 48,
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
            textAlign: 'center',
            x: 960,
            y: 550,
            width: 1400,
          },
          animation: { type: 'slide', duration: 1.0, delay: 1.0, from: 'bottom' },
          startFrame: Math.floor(totalFrames * 0.2),
          endFrame: Math.floor(totalFrames * 0.8),
        },
      ],
    };

    if (logoImageUrl) {
      template.tracks.push({
        type: 'image',
        src: '{{logoImage}}',
        style: { x: 760, y: 700, width: 400, height: 200, objectFit: 'contain' },
        animation: { type: 'fade-in', duration: 0.8, delay: 1.5 },
        startFrame: Math.floor(totalFrames * 0.3),
        endFrame: Math.floor(totalFrames * 0.9),
      });
    }

    const input: Record<string, any> = {
      title: generated.title || topic,
      subtitle: generated.subtitle || `Learn more about ${topic}`,
    };
    if (description) input.description = description;
    if (backgroundType === 'image') input.backgroundImage = backgroundImageUrl;
    if (logoImageUrl) input.logoImage = logoImageUrl;

    res.json({
      template,
      input,
      generatedContent: {
        title: generated.title,
        subtitle: generated.subtitle,
        voiceoverScript: generated.voiceoverScript,
      },
    });
  } catch (error: any) {
    console.error('Error generating content:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.error?.message || error.message || 'Failed to generate content';
    res.status(status).json({ error: 'Failed to generate content', message });
  }
});

export default router;