import { Router, Request, Response } from 'express';
import { config } from '../config';
import rateLimit from 'express-rate-limit';
import {callGeminiText} from '../services/gemini';

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

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many AI content generation requests. Please wait a moment and try again.',
  },
});

const DEFAULT_BACKGROUNDS: Record<string, string> = {
  professional: createBackgroundDataUrl('#1f2937', '#0f172a'),
  casual: createBackgroundDataUrl('#2563eb', '#1d4ed8'),
  creative: createBackgroundDataUrl('#8b5cf6', '#7c3aed'),
  minimalist: createBackgroundDataUrl('#111827', '#0f172a'),
  default: createBackgroundDataUrl('#1f2937', '#0f172a'),
};

const FALLBACK_LOGO = createLogoDataUrl('Your Logo');

const PLACEHOLDER_HOSTS = [
  'placeholder.com',
  'via.placeholder.com',
  'placehold.it',
  'dummyimage.com',
  'placehold.co',
];

const sanitizeAssetUrl = (value: any, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('data:')) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return fallback;
    if (PLACEHOLDER_HOSTS.some((host) => url.hostname.includes(host))) {
      return fallback;
    }
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
      backgroundType = 'gradient',
      backgroundColor = '#667eea',
      includeAudio = true,
      includeLogo = false,
      callToAction,
      sections: manualSections,
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

Return ONLY JSON with the following shape:
{
  "title": string;
  "subtitle": string;
  "backgroundImage"?: string;
  "logoImage"?: string;
  "voiceoverScript"?: string;
  "voiceoverAudio"?: string;
  "sections": Array<{
    "heading"?: string;
    "body"?: string;
    "title"?: string;
    "summary"?: string;
    "content"?: string;
    "text"?: string;
  }>;
}`;

    interface GeminiAiResponse {
      title?: string;
      subtitle?: string;
      backgroundImage?: string;
      logoImage?: string;
      voiceoverScript?: string;
      voiceoverAudio?: string;
      sections?: Array<Record<string, unknown>>;
    }

    let generated: GeminiAiResponse;
    try {
      const raw = await callGeminiText(prompt);
      generated = JSON.parse(raw) as GeminiAiResponse;
    } catch (error) {
      console.error('Gemini content generation failed:', error);
      return res.status(502).json({
        error: 'Invalid response from Gemini',
        message:
          error instanceof Error ? error.message : 'Gemini did not return valid JSON content.',
      });
    }

    if (!generated || typeof generated !== 'object') {
      return res.status(502).json({error: 'Invalid response from Gemini', message: 'AI response was empty.'});
    }

    // Build template
    const fps = 30;
    const totalFrames = duration * fps;

    const fallbackBackground = DEFAULT_BACKGROUNDS[style] || DEFAULT_BACKGROUNDS.default;
    const backgroundImageUrl = sanitizeAssetUrl(generated.backgroundImage, fallbackBackground);
    const logoImageUrl = includeLogo ? sanitizeAssetUrl(generated.logoImage, FALLBACK_LOGO) : '';
    const voiceoverScript = typeof generated.voiceoverScript === 'string' ? generated.voiceoverScript.trim() : '';
    const voiceoverAudioUrl = sanitizeAssetUrl(generated.voiceoverAudio, '');

    type SectionCandidate = {
      heading?: string;
      body?: string;
    };

    const isDefined = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined;

    const normalizeSection = (section: unknown): SectionCandidate | null => {
      if (typeof section === 'string') {
        const trimmed = section.trim();
        return trimmed ? { body: trimmed } : null;
      }

      if (section && typeof section === 'object') {
        const record = section as Record<string, unknown>;
        const headingCandidate = [record.heading, record.title].find(
          (value): value is string => typeof value === 'string' && value.trim().length > 0
        );
        const bodyCandidate = [record.summary, record.body, record.content, record.text].find(
          (value): value is string => typeof value === 'string' && value.trim().length > 0
        );

        if (headingCandidate || bodyCandidate) {
          return {
            heading: headingCandidate?.trim(),
            body: bodyCandidate?.trim(),
          };
        }
      }

      return null;
    };

    const normalizedManualSections: SectionCandidate[] = Array.isArray(manualSections)
      ? manualSections.map(normalizeSection).filter(isDefined)
      : [];

    const generatedSections: SectionCandidate[] = Array.isArray(generated.sections)
      ? generated.sections.map(normalizeSection).filter(isDefined)
      : [];

    const sectionSources: SectionCandidate[] = [...normalizedManualSections, ...generatedSections];

    const fallbackSentencesSource = voiceoverScript || generated.subtitle || description;
    const fallbackSections: SectionCandidate[] =
      sectionSources.length === 0 && fallbackSentencesSource
        ? fallbackSentencesSource
            .split(/(?<=[.?!])\s+/)
            .map((sentence: string) => sentence.trim())
            .filter((sentence: string) => sentence.length > 0)
            .map((sentence: string) => ({ body: sentence }))
        : [];

    const combinedSections: SectionCandidate[] = [...sectionSources, ...fallbackSections].filter(isDefined);

    type SectionContent = { heading: string; body: string };

    const maxSections = Math.min(4, Math.max(1, combinedSections.length || 3));
    let sectionsToUse: SectionContent[] = combinedSections.slice(0, maxSections).map((section, index) => {
      const heading = section.heading && section.heading.length > 0 ? section.heading : `Key Point ${index + 1}`;
      const bodyText = section.body && section.body.length > 0 ? section.body : heading;
      const formattedBody = bodyText.replace(/\s+/g, ' ').trim();
      return {
        heading,
        body: formattedBody,
      };
    });

    if (sectionsToUse.length === 0) {
      sectionsToUse = [
        { heading: `What is ${topic}?`, body: `Get a quick overview of ${topic} and why it matters.` },
        { heading: 'Core Ideas', body: `Highlight the most important concepts to remember about ${topic}.` },
        { heading: 'Next Steps', body: `Explore practical ways to apply ${topic} in real situations.` },
      ];
    }

    const outroMessage =
      typeof callToAction === 'string' && callToAction.trim().length > 0
        ? callToAction.trim()
        : `Keep exploring ${topic} to grow your knowledge!`;

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
            fontFamily: 'Inter, Arial, sans-serif',
            color: '#f8fafc',
            fontWeight: 700,
            textAlign: 'center',
            x: 960,
            y: 320,
            width: 1500,
            anchor: 'center',
            textShadow: '0 12px 30px rgba(15, 23, 42, 0.45)',
          },
          animation: { type: 'fade-in', duration: 1.0, delay: 0.4 },
          startFrame: Math.floor(totalFrames * 0.05),
          endFrame: Math.floor(totalFrames * 0.35),
        },
        {
          type: 'text',
          content: '{{subtitle}}',
          style: {
            fontSize: 46,
            fontFamily: 'Inter, Arial, sans-serif',
            color: '#e2e8f0',
            textAlign: 'center',
            x: 960,
            y: 450,
            width: 1500,
            anchor: 'center',
          },
          animation: { type: 'slide', duration: 1.0, delay: 0.9, from: 'bottom' },
          startFrame: Math.floor(totalFrames * 0.12),
          endFrame: Math.floor(totalFrames * 0.45),
        },
      ],
    };

    const introDuration = Math.floor(totalFrames * 0.2);
    const outroDuration = Math.floor(totalFrames * 0.15);
    const sectionWindow = Math.max(totalFrames - introDuration - outroDuration, totalFrames * 0.4);
    const perSectionDuration = Math.floor(sectionWindow / Math.max(1, sectionsToUse.length));

    sectionsToUse.forEach((section, index) => {
      const startFrame = Math.min(
        totalFrames - outroDuration - 10,
        Math.floor(introDuration + index * perSectionDuration)
      );
      const endFrame = Math.min(totalFrames - 1, startFrame + perSectionDuration);
      const key = `section_${index + 1}`;

      template.tracks.push({
        type: 'text',
        content: `{{${key}}}`,
        style: {
          fontSize: 44,
          fontFamily: 'Inter, Arial, sans-serif',
          color: '#f8fafc',
          textAlign: 'center',
          x: 960,
          y: 600,
          width: 1500,
          anchor: 'center',
          padding: '32px',
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          borderRadius: '24px',
          backdropFilter: 'blur(6px)',
          boxShadow: '0 18px 50px rgba(15, 23, 42, 0.45)',
        },
        animation: {
          type: 'slide',
          duration: 0.9,
          delay: 0.15,
          from: index % 2 === 0 ? 'left' : 'right',
        },
        startFrame,
        endFrame,
      });
    });

    template.tracks.push({
      type: 'text',
      content: '{{callToAction}}',
      style: {
        fontSize: 38,
        fontFamily: 'Inter, Arial, sans-serif',
        color: '#e2e8f0',
        textAlign: 'center',
        x: 960,
        y: 860,
        width: 1600,
        anchor: 'center',
      },
      animation: { type: 'fade-in', duration: 0.8, delay: 0.2 },
      startFrame: Math.max(totalFrames - outroDuration, introDuration),
      endFrame: totalFrames,
    });

    if (includeLogo && logoImageUrl) {
      template.tracks.push({
        type: 'image',
        src: '{{logoImage}}',
        style: {
          x: 1700,
          y: 940,
          width: 200,
          height: 100,
          anchor: 'center',
          objectFit: 'contain',
          opacity: 0.9,
        },
        animation: { type: 'fade-in', duration: 0.8, delay: 1.5 },
        startFrame: Math.floor(totalFrames * 0.4),
        endFrame: totalFrames,
      });
    }

    if (includeAudio && voiceoverAudioUrl) {
      template.tracks.push({
        type: 'voiceover',
        src: '{{voiceoverAudio}}',
        startFrame: 0,
        endFrame: totalFrames,
        volume: 0.85,
      });
    }

    const input: Record<string, any> = {
      title: generated.title || topic,
      subtitle: generated.subtitle || `Learn more about ${topic}`,
      callToAction: outroMessage,
    };
    if (description) input.description = description;
    if (backgroundType === 'image') input.backgroundImage = backgroundImageUrl;
    if (includeLogo && logoImageUrl) input.logoImage = logoImageUrl;
    sectionsToUse.forEach((section, index) => {
      const key = `section_${index + 1}`;
      const formatted = `${section.heading}\n${section.body}`;
      input[key] = formatted;
    });
    if (includeAudio && voiceoverAudioUrl) {
      input.voiceoverAudio = voiceoverAudioUrl;
    }

    res.json({
      template,
      input,
      generatedContent: {
        title: generated.title,
        subtitle: generated.subtitle,
        voiceoverScript,
        transcript: voiceoverScript,
        voiceoverAudio: voiceoverAudioUrl,
        sections: sectionsToUse,
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