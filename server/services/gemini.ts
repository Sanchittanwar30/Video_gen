import axios from 'axios';
import {config} from '../config';

const MIN_GEMINI_INTERVAL_MS = parseInt(
	process.env.GEMINI_MIN_INTERVAL_MS || process.env.OPENAI_MIN_INTERVAL_MS || '4000',
	10
);

let lastGeminiCall = 0;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function callGemini(prompt: string, attempt = 1): Promise<string> {
	if (!config.ai.geminiApiKey) {
		throw new Error('Gemini API key not configured');
	}

	const now = Date.now();
	const elapsed = now - lastGeminiCall;
	if (elapsed < MIN_GEMINI_INTERVAL_MS) {
		await wait(MIN_GEMINI_INTERVAL_MS - elapsed);
	}

	try {
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.ai.geminiModel}:generateContent?key=${config.ai.geminiApiKey}`;

		const response = await axios.post(url, {
			contents: [
				{
					role: 'user',
					parts: [
						{
							text: prompt,
						},
					],
				},
			],
			safetySettings: [
				{category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH'},
				{category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH'},
				{category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH'},
				{category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH'},
			],
		});

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

