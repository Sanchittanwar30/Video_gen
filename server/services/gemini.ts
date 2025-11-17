import "dotenv/config";
import axios, { AxiosInstance } from "axios";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";



 // Use the v1beta endpoint (some Gemini models / features are available on v1beta)
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const DEFAULT_TEXT_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-pro";
const TEXT_MODEL_FALLBACKS = process.env.GEMINI_TEXT_MODEL_FALLBACKS
  ? process.env.GEMINI_TEXT_MODEL_FALLBACKS.split(",").map((s) => s.trim()).filter(Boolean)
  : ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];

// Keep default image model but also support a fallback list via env
const DEFAULT_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "imagen-4.0-generate-preview-06-06";
const IMAGE_MODEL_FALLBACKS = process.env.GEMINI_IMAGE_MODEL_FALLBACKS
  ? process.env.GEMINI_IMAGE_MODEL_FALLBACKS.split(",").map((s) => s.trim()).filter(Boolean)
  : [
      "imagen-3.0-generate-001",           // Stable fallback model
      "imagen-3.0-fast-generate-001",      // Faster alternative
      "imagen-2.0-generate-001",           // Older but reliable
    ];
const IMAGE_SAMPLE_COUNT = Math.max(1, Number(process.env.GEMINI_IMAGE_SAMPLE_COUNT ?? "1"));
const IMAGE_MIME_TYPE = process.env.GEMINI_IMAGE_MIME_TYPE ?? "image/png";

const MAX_RETRIES = Number(process.env.GEMINI_MAX_RETRIES ?? "3"); // Retry up to 3 times
const INITIAL_DELAY_MS = Number(process.env.GEMINI_INITIAL_DELAY_MS ?? "800");
const INITIAL_DELAY_503_MS = Number(process.env.GEMINI_INITIAL_DELAY_503_MS ?? "2000"); // Longer delay for 503 (service overloaded)

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY in environment");
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status?: number): boolean {
  return Boolean(status && (status === 429 || (status >= 500 && status < 600)));
}

function jitter(delay: number) {
  return Math.floor(delay + Math.random() * Math.min(200, Math.floor(delay / 2)));
}

function sanitizeModelText(raw?: string): string | undefined {
  if (!raw) return raw;
  let s = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  s = s.replace(/^\s*~~~(?:json)?\s*/i, "").replace(/\s*~~~$/i, "").trim();
  return s;
}

async function ensureImageDir(): Promise<string> {
  const baseDir = process.env.ASSETS_DIR
    ? path.resolve(process.cwd(), process.env.ASSETS_DIR)
    : path.join(process.cwd(), "public", "assets");
  const imageDir = path.join(baseDir, "gemini-images");
  await fs.mkdir(imageDir, { recursive: true });
  return imageDir;
}

// Simple request queue to prevent overwhelming the API
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 500; // Minimum 500ms between any API requests

async function throttleRequest(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await sleep(waitTime);
  }
  lastRequestTime = Date.now();
}

function buildAxios(apiKey: string): AxiosInstance {
  return axios.create({
    baseURL: GEMINI_API_BASE,
    params: { key: apiKey },
    timeout: 120_000, // Increased to 120 seconds for image generation
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Generic POST wrapper with retries and exponential backoff.
 * Honors Retry-After header (if present) for server-directed delays.
 */
async function postWithRetries<T>(
  client: AxiosInstance,
  pathSuffix: string,
  payload: unknown
): Promise<T> {
  let attempt = 0;
  let delay = INITIAL_DELAY_MS;

  while (true) {
    try {
      // Throttle requests to prevent overwhelming the API
      await throttleRequest();
      const resp = await client.post<T>(pathSuffix, payload);
      return resp.data;
    } catch (err: any) {
      const status = err?.response?.status;
      const respData = err?.response?.data;
      const retryAfterHeader = err?.response?.headers?.["retry-after"];
      const message = respData?.error?.message ?? err?.message ?? String(err);

      // If the server provided Retry-After, honor it (in seconds or HTTP-date; we handle seconds)
      let serverWaitMs: number | undefined;
      if (retryAfterHeader) {
        const n = Number(retryAfterHeader);
        if (!Number.isNaN(n)) {
          serverWaitMs = n * 1000;
        }
      }

      if (attempt < MAX_RETRIES && shouldRetry(status)) {
        attempt += 1;
        
        // Use longer delays for 503 errors (service overloaded)
        const is503 = status === 503;
        const baseDelay = is503 ? INITIAL_DELAY_503_MS : INITIAL_DELAY_MS;
        const currentDelay = is503 
          ? baseDelay * Math.pow(2, attempt - 1) // Exponential backoff: 2s, 4s, 8s, 16s, 32s
          : delay;
        
        const wait = serverWaitMs ?? jitter(currentDelay);
        
        const errorType = is503 
          ? "service overloaded (503)" 
          : status === 429 
            ? "rate limited (429)" 
            : `server error (${status})`;
        
        console.warn(
          `Request to ${pathSuffix} failed (${errorType}) — retrying ${attempt}/${MAX_RETRIES} after ${Math.round(wait)}ms (${Math.round(wait/1000)}s)`
        );
        
        // small debug snapshot (truncated) to help diagnosis without dumping everything
        try {
          const dbg = JSON.stringify(respData).slice(0, 1500);
          console.debug(`Response snapshot: ${dbg}${String(respData).length > 1500 ? '...<truncated>' : ''}`);
        } catch {}
        
        await sleep(wait);
        
        // Update delay for next iteration (only if not 503, as we calculate it differently)
        if (!is503) {
          delay *= 2;
        }
        continue;
      }

      // Exhausted retries or non-retryable -> attach context and throw
      const e = new Error(`Request to ${pathSuffix} failed: ${message}`);
      (e as any).status = status;
      // attach truncated response for caller debugging (avoid leaking huge bodies)
      if (respData) (e as any).responseSnapshot = JSON.stringify(respData).slice(0, 2000);
      throw e;
    }
  }
}

/**
 * callGeminiText: generate text from Gemini and return the trimmed, sanitized string.
 * Tries fallback models if the primary model fails.
 */
export async function callGeminiText(
  prompt: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string> {
  const apiKey = getApiKey();
  const client = buildAxios(apiKey);
  
  // Build model sequence: explicit param first, then configured fallbacks (unique)
  const fallbacks = Array.from(new Set([model, ...TEXT_MODEL_FALLBACKS]));
  
  let lastError: any = null;
  
  for (const candidateModel of fallbacks) {
    const url = `/${candidateModel}:generateContent`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    };

    try {
      const data = await postWithRetries<any>(client, url, payload);

      // defensive parsing of common response shapes
      const candidates = data?.candidates ?? [];
      for (const cand of candidates) {
        const parts = cand?.content?.parts ?? [];
        for (const p of parts) {
          if (p && typeof p.text === "string" && p.text.trim().length > 0) {
            const cleaned = sanitizeModelText(p.text);
            return (cleaned ?? p.text).trim();
          }
        }

        // older/alternate shapes
        const inlineText = cand?.content?.text ?? cand?.content?.speech ?? cand?.text;
        if (typeof inlineText === "string" && inlineText.trim().length > 0) {
          const cleaned = sanitizeModelText(inlineText);
          return (cleaned ?? inlineText).trim();
        }
      }

      throw new Error("Gemini text response did not contain usable text");
    } catch (err: any) {
      lastError = err;
      const status = err?.status ?? err?.response?.status;
      
      // If it's a 503 (overloaded) or 429 (rate limit), try next model
      if (status === 503 || status === 429) {
        const errorType = status === 503 ? "overloaded" : "rate limited";
        console.warn(`[Gemini Text] Model ${candidateModel} ${errorType} (${status}), trying fallback model...`);
        // Longer delay before trying next model for 503 errors
        await sleep(status === 503 ? 2000 : 500);
        continue;
      }
      
      // For other errors, throw immediately (don't try fallbacks)
      throw err;
    }
  }
  
  // All models failed
  throw new Error(
    `All text model attempts failed. Last error: ${lastError?.message ?? 'Unknown error'}`
  );
}

/**
 * Robust helper: attempt to extract base64 image data from many possible response shapes.
 */
function tryExtractBase64(obj: any): string | undefined {
  if (!obj) return undefined;

  // direct base64 string
  if (typeof obj === "string" && /^[A-Za-z0-9+/=\s]+$/.test(obj) && obj.length > 200) {
    return obj.trim();
  }

  if (typeof obj === "object") {
    if (typeof obj.data === "string" && obj.data.length > 200) return obj.data;
    if (typeof obj.binaryData === "string" && obj.binaryData.length > 200) return obj.binaryData;
    if (obj.image && typeof obj.image.data === "string" && obj.image.data.length > 200) return obj.image.data;
    if (obj.inlineData && typeof obj.inlineData.data === "string" && obj.inlineData.data.length > 200) return obj.inlineData.data;
    if (obj.inline_data && typeof obj.inline_data.data === "string" && obj.inline_data.data.length > 200) return obj.inline_data.data;

    // shallow nested search for likely candidates (avoid deep recursion)
    for (const k of Object.keys(obj)) {
      try {
        const v = obj[k];
        if (typeof v === "string" && /^[A-Za-z0-9+/=\s]+$/.test(v) && v.length > 200) return v;
        if (v && typeof v === "object") {
          if (typeof v.data === "string" && v.data.length > 200) return v.data;
          if (typeof v.binaryData === "string" && v.binaryData.length > 200) return v.binaryData;
          if (v.image && typeof v.image.data === "string" && v.image.data.length > 200) return v.image.data;
        }
      } catch {}
    }
  }

  return undefined;
}

/**
 * callGeminiImage:
 * - tries a list of image models (fallbacks)
 * - uses postWithRetries for each model
 * - robustly extracts base64 and saves PNG to public/assets/gemini-images
 * - returns a public URL to the saved image
 */
export async function callGeminiImage(
  prompt: string,
  model: string = DEFAULT_IMAGE_MODEL
): Promise<string> {
  const apiKey = getApiKey();
  const client = buildAxios(apiKey);

  // build model sequence: explicit param first, then configured fallbacks (unique)
  const fallbacks = Array.from(new Set([model, ...IMAGE_MODEL_FALLBACKS]));

  // helper to produce truncated safe dumps for logs/errors
  const safeDump = (o: any, max = 2000) => {
    try {
      const replacer = (_key: string, value: any) => {
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (trimmed.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed)) {
            return `<base64:${trimmed.length} chars>`;
          }
        }
        return value;
      };
      const s = JSON.stringify(o, replacer, 2);
      return s.length > max ? s.slice(0, max) + "...<truncated>" : s;
    } catch {
      const t = String(o);
      return t.length > max ? t.slice(0, max) + "...<truncated>" : t;
    }
  };

  let lastError: any = null;

  for (const candidateModel of fallbacks) {
    const lower = candidateModel.toLowerCase();
    const usePredict = lower.includes("imagen") || lower.includes("image");

    const url = usePredict ? `/${candidateModel}:predict` : `/${candidateModel}:generateContent`;

    const payload = usePredict
      ? {
          instances: [
            {
              prompt,
            },
          ],
          parameters: {
            sampleCount: IMAGE_SAMPLE_COUNT,
            mimeType: IMAGE_MIME_TYPE,
            aspectRatio: "16:9", // Force 16:9 landscape aspect ratio
          },
        }
      : {
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
        };

    try {
      const data = await postWithRetries<any>(client, url, payload);

      // Debug: truncated snapshot so you can inspect without leaking secrets
      try {
        console.debug(`Gemini (${candidateModel}) response snapshot: ${safeDump(data, 4000)}`);
      } catch {}

      let base64: string | undefined;

      if (usePredict) {
        const predictions = Array.isArray(data?.predictions) ? data.predictions : [];
        for (const prediction of predictions) {
          base64 =
            typeof prediction?.bytesBase64Encoded === "string"
              ? prediction.bytesBase64Encoded
              : tryExtractBase64(prediction?.image) ?? tryExtractBase64(prediction);
          if (base64) break;
        }
      } else {
        const candidates = data?.candidates ?? [];
        for (const cand of candidates) {
          base64 = tryExtractBase64(cand?.content) ?? tryExtractBase64(cand);
          if (base64) break;

          const parts = cand?.content?.parts ?? cand?.parts ?? [];
          for (const part of parts) {
            base64 =
              tryExtractBase64(part) ??
              tryExtractBase64(part?.image) ??
              tryExtractBase64(part?.inlineData) ??
              tryExtractBase64(part?.inline_data);
            if (base64) break;
          }
          if (base64) break;
        }

        // Extra fallback shapes
        if (!base64) {
          base64 =
            tryExtractBase64(data?.attachment) ??
            tryExtractBase64(data?.attachments) ??
            tryExtractBase64(data?.outputs) ??
            tryExtractBase64(data?.result) ??
            tryExtractBase64(data?.content);
        }
      }

      if (!base64) {
        // No image — throw with snapshot so it's actionable
        const snapshot = safeDump(data, 3000);
        throw new Error(`Gemini (${candidateModel}) returned no base64 image data. Snapshot: ${snapshot}`);
      }

      // decode and save PNG
      const buffer = Buffer.from(base64, "base64");
      const dir = await ensureImageDir();
      const filename = `gemini-image-${uuidv4()}.png`;
      const absolute = path.join(dir, filename);
      await fs.writeFile(absolute, buffer);

      const baseUrl = process.env.PUBLIC_ASSETS_BASE_URL ?? `http://localhost:${process.env.PORT ?? "3000"}`;
      return `${baseUrl.replace(/\/$/, "")}/assets/gemini-images/${filename}`;
    } catch (err: any) {
      lastError = err;
      const status = err?.status ?? err?.response?.status;
      const errorMessage = String(err?.message ?? "").toLowerCase();
      const errorData = err?.response?.data;
      const errorDataStr = errorData ? JSON.stringify(errorData).toLowerCase() : "";
      
      // Detect quota errors specifically
      const isQuotaError = 
        status === 429 || 
        errorMessage.includes("quota") || 
        errorMessage.includes("exceeded") ||
        errorDataStr.includes("quota") ||
        errorDataStr.includes("exceeded") ||
        (errorData?.error?.message && String(errorData.error.message).toLowerCase().includes("quota"));
      
      if (isQuotaError) {
        console.warn(`[Gemini Image] Model ${candidateModel} quota exceeded, trying fallback model...`);
      } else {
        console.warn(`Gemini image attempt failed for model=${candidateModel} status=${status} msg=${String(err?.message ?? "").slice(0, 300)}`);
      }
      
      try {
        console.debug(`Failure snapshot: ${safeDump(err?.response?.data ?? err?.message ?? err, 2000)}`);
      } catch {}

      // if server suggested Retry-After and we have access to headers (err.response), honor it briefly
      const retryAfterHeader = err?.response?.headers?.["retry-after"];
      if (retryAfterHeader) {
        const n = Number(retryAfterHeader);
        if (!Number.isNaN(n) && n > 0) {
          const ms = n * 1000;
          console.info(`Honoring Retry-After (${n}s) before next model attempt.`);
          await sleep(ms);
        }
      }

      // For quota errors (429) or 503 errors (service overloaded), wait longer before trying next model
      if (isQuotaError || status === 503) {
        const waitTime = isQuotaError ? 1000 : 2000 + Math.floor(Math.random() * 1000); // 1s for quota, 2-3s for 503
        const errorType = isQuotaError ? "quota exceeded" : "overloaded (503)";
        console.warn(`[Gemini Image] Model ${candidateModel} ${errorType}, waiting ${waitTime}ms before trying fallback...`);
        await sleep(waitTime);
      } else {
        // small jitter before trying next fallback (avoid immediate hammer)
        await sleep(300 + Math.floor(Math.random() * 400));
      }
      continue;
    }
  }

  // exhausted models
  const finalSnapshot = lastError?.response?.data ? safeDump(lastError.response.data, 3000) : String(lastError?.message ?? lastError ?? "no details");
  const lastErrorMsg = String(lastError?.message ?? "").toLowerCase();
  const isQuotaExhausted = lastErrorMsg.includes("quota") || lastErrorMsg.includes("exceeded");
  
  if (isQuotaExhausted) {
    throw new Error(`All image model attempts failed due to quota limits. Tried models: ${fallbacks.join(", ")}. Please check your API quota or upgrade your plan. Last error: ${finalSnapshot}`);
  } else {
    throw new Error(`All image model attempts failed. Tried models: ${fallbacks.join(", ")}. Last response snapshot: ${finalSnapshot}`);
  }
}

export default { callGeminiText, callGeminiImage };
