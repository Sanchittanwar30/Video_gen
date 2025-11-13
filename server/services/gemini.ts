import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1/models';
const DEFAULT_TEXT_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const DEFAULT_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-2.5-flash-image';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getApiKey = (): string => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is missing — API will fail.');
    throw new Error('GEMINI_API_KEY is missing');
  }
  return apiKey;
};

const shouldRetry = (status?: number): boolean =>
  Boolean(status && (status === 429 || (status >= 500 && status < 600)));

//
// ─────────────────────────────────────────────
//  TEXT GENERATION (CORRECT 2.5 SCHEMA)
// ─────────────────────────────────────────────
//
export const callGeminiText = async (
  prompt: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string> => {
  const apiKey = getApiKey();
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }] // <-- FIXED: NO ROLE FIELD
      }
    ]
  };

  let attempt = 0;
  let delay = 1000;

  while (attempt < 3) {
    try {
      const { data } = await axios.post(url, payload, { timeout: 60000 });

      const text = data?.candidates?.[0]?.content?.parts?.find(
        (part: any) => typeof part?.text === 'string'
      )?.text;

			if (!text) {
        throw new Error('Gemini response missing text content');
      }

			const cleaned = text
				.replace(/^```(?:json)?\s*/i, '')
				.replace(/\s*```$/i, '')
				.trim();

			return cleaned || text.trim();
    } catch (error: any) {
      const status = error?.response?.status;
      if (attempt < 2 && shouldRetry(status)) {
        console.warn(`Retrying Gemini text... status=${status}`);
        await sleep(delay);
        delay *= 2;
        attempt += 1;
        continue;
      }

      const message =
        error?.response?.data?.error?.message ?? error?.message ?? 'Unknown Gemini error';
      throw new Error(`Gemini text generation failed: ${message}`);
    }
  }

  throw new Error('Gemini text generation failed after retries');
};

//
// ─────────────────────────────────────────────
//  IMAGE GENERATION (CORRECT 2.5 SCHEMA)
// ─────────────────────────────────────────────
//
const ensureImageDir = async (): Promise<string> => {
  const baseDir = process.env.ASSETS_DIR
    ? path.resolve(process.cwd(), process.env.ASSETS_DIR)
    : path.join(process.cwd(), 'public', 'assets');

  const imageDir = path.join(baseDir, 'gemini-images');
  await fs.mkdir(imageDir, { recursive: true });
  return imageDir;
};

export const callGeminiImage = async (
  prompt: string,
  model: string = DEFAULT_IMAGE_MODEL,
  size: string = '1920x1080'
): Promise<string> => {
  const apiKey = getApiKey();
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const [widthStr, heightStr] = size.split('x');
  const width = Number.parseInt(widthStr, 10) || 1920;
  const height = Number.parseInt(heightStr, 10) || 1080;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generation_config: {
      response_mime_type: 'image/png',
      image_width: width,
      image_height: height,
    },
  };

  let attempt = 0;
  let delay = 1000;

  while (attempt < 3) {
    try {
      const { data } = await axios.post(url, payload, { timeout: 60000 });

      const inlineData =
        data?.candidates?.[0]?.content?.parts?.find(
          (part: any) => part?.inlineData?.data || part?.inline_data?.data
        )?.inlineData?.data ??
        data?.candidates?.[0]?.content?.parts?.find(
          (part: any) => part?.inline_data?.data
        )?.inline_data?.data;

      if (!inlineData) {
        throw new Error('Gemini image response missing PNG data');
      }

      const buffer = Buffer.from(inlineData, 'base64');
      const dir = await ensureImageDir();
      const filename = `gemini-image-${uuidv4()}.png`;
      const absolutePath = path.join(dir, filename);
      await fs.writeFile(absolutePath, buffer);

      return `/assets/gemini-images/${filename}`;
    } catch (error: any) {
      const status = error?.response?.status;
      if (attempt < 2 && shouldRetry(status)) {
        console.warn(`Retrying Gemini image... status=${status}`);
        await sleep(delay);
        delay *= 2;
        attempt += 1;
        continue;
      }

      const message =
        error?.response?.data?.error?.message ?? error?.message ?? 'Unknown Gemini error';
      throw new Error(`Gemini image generation failed: ${message}`);
    }
  }

  throw new Error('Gemini image generation failed after retries');
};
