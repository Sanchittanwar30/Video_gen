import axios, { AxiosError } from 'axios';

export interface GeminiRequest {
	model: string;
	contents: Array<{
		role: 'user' | 'system' | 'model';
		parts: Array<{
			text: string;
		}>;
	}>;
	safetySettings?: Array<{
		category: string;
		threshold: string;
	}>;
}

const GEMINI_ENDPOINT =
	'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const callGemini = async <T = unknown>(
	request: GeminiRequest,
	maxRetries = 3
): Promise<T> => {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error('GEMINI_API_KEY not configured');
	}

	let attempt = 0;
	let backoff = 1000;

	while (attempt <= maxRetries) {
		try {
			const {data} = await axios.post(
				`${GEMINI_ENDPOINT}?key=${apiKey}`,
				request,
				{
					timeout: 60000,
				}
			);

			const text =
				data?.candidates?.[0]?.content?.parts?.[0]?.text ?? data?.candidates?.[0]?.output;

			if (!text) {
				throw new Error('Gemini response did not include text content');
			}

			const cleaned = text
				.trim()
				.replace(/^```(?:json)?\s*/i, '')
				.replace(/\s*```$/i, '')
				.replace(/\uFEFF/g, '');

			return JSON.parse(cleaned) as T;
		} catch (error) {
			const axiosError = error as AxiosError;
			const status = axiosError.response?.status;

			if (
				(attempt < maxRetries && status === 429) ||
				(status && status >= 500 && status < 600)
			) {
				attempt += 1;
				await delay(backoff);
				backoff *= 2;
				continue;
			}

			throw error;
		}
	}

	throw new Error('Gemini request failed after retries');
};
