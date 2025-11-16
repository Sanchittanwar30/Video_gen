import axios from 'axios';

const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/speak';

export interface DeepgramSynthesisOptions {
	text: string;
	voice?: string;
	model?: string;
}

// Use more human-like models: aura-athena-en, aura-hera-en, or aura-zeus-en for natural sound
const DEFAULT_TTS_MODEL = process.env.DEEPGRAM_TTS_MODEL ?? 'aura-hera-en'; // Natural human-like
const DEFAULT_TTS_VOICE = process.env.DEEPGRAM_TTS_VOICE; // Can be omitted to use model default

export const synthesizeSpeech = async ({
	text,
	voice = DEFAULT_TTS_VOICE,
	model = DEFAULT_TTS_MODEL,
}: DeepgramSynthesisOptions): Promise<Buffer> => {
	const apiKey = process.env.DEEPGRAM_API_KEY;
	if (!apiKey) {
		throw new Error('DEEPGRAM_API_KEY not configured');
	}

	// First attempt: include optional voice and conservative params
	const tryRequest = async (url: string) => {
		const response = await axios.post(
			url,
			{ text },
			{
				headers: {
					Authorization: `Token ${apiKey}`,
					'Content-Type': 'application/json',
					Accept: 'audio/mpeg',
				},
				responseType: 'arraybuffer',
				validateStatus: () => true, // We'll handle non-2xx
			}
		);
		if (response.status >= 200 && response.status < 300) {
			return Buffer.from(response.data);
		}
		const detail =
			(typeof response.data === 'string' ? response.data : undefined) ||
			(response.data && (response.data.error || response.data.message)) ||
			`HTTP ${response.status}`;
		throw new Error(`Deepgram TTS failed: ${detail}`);
	};

	// Build URL variants
	const withVoice = voice && voice.trim().length > 0;
	const baseUrl = `${DEEPGRAM_API_URL}?model=${encodeURIComponent(model)}`;
	const urlWithVoice = withVoice ? `${baseUrl}&voice=${encodeURIComponent(voice!)}` : baseUrl;

	// Try with voice if provided, then without voice, then fallback model
	try {
		return await tryRequest(urlWithVoice);
	} catch (err) {
		// Retry without voice param (some models ignore or reject voice)
		try {
			return await tryRequest(baseUrl);
		} catch {
			// Final fallback: known good aura model
			const fallbackUrl = `${DEEPGRAM_API_URL}?model=${encodeURIComponent('aura-hera-en')}`;
			return await tryRequest(fallbackUrl);
		}
	}
};