import axios from 'axios';

const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/speak';

export interface DeepgramSynthesisOptions {
	text: string;
	voice?: string;
	model?: string;
	upbeat?: boolean; // Make voice more upbeat for educational content
}

// Use premium human-like models for most natural sound:
// - aura-athena-en: Female voice, very natural
// - aura-hera-en: Female voice, natural (default)
// - aura-zeus-en: Male voice, natural
// - aura-orpheus-en: Male voice, very natural (more energetic)
// - aura-arcas-en: Male voice, natural
// - aura-perseus-en: Male voice, natural
// - aura-angus-en: Male voice, natural
// - aura-orion-en: Male voice, natural
// - aura-zeus-2: Latest premium male voice (most realistic)
// - aura-athena-2: Latest premium female voice (most realistic)
// For upbeat educational content, orpheus and hera tend to be more energetic
const DEFAULT_TTS_MODEL = process.env.DEEPGRAM_TTS_MODEL ?? 'aura-athena-2'; // Premium model for most realistic voice
const DEFAULT_TTS_VOICE = process.env.DEEPGRAM_TTS_VOICE; // Can be omitted to use model default

// Enhance text with SSML prosody tags for more upbeat delivery
function enhanceTextForUpbeatDelivery(text: string): string {
	// Add SSML prosody tags to increase pitch slightly for more energy
	// Deepgram supports SSML-like tags for prosody control
	// Keep rate the same but increase pitch slightly for more upbeat sound
	return `<speak><prosody pitch="+5%">${text}</prosody></speak>`;
}

export const synthesizeSpeech = async ({
	text,
	voice = DEFAULT_TTS_VOICE,
	model = DEFAULT_TTS_MODEL,
	upbeat = true, // Default to upbeat for educational content
}: DeepgramSynthesisOptions): Promise<Buffer> => {
	const apiKey = process.env.DEEPGRAM_API_KEY;
	if (!apiKey) {
		throw new Error('DEEPGRAM_API_KEY not configured');
	}

	// Use a more energetic female model for upbeat educational content
	const selectedModel = upbeat && model === DEFAULT_TTS_MODEL 
		? 'aura-hera-en' // More energetic female voice, great for educational content
		: model;

	// Enhance text with SSML for more upbeat delivery if requested
	// Note: If Deepgram doesn't support SSML, it will fall back to plain text
	const processedText = upbeat ? enhanceTextForUpbeatDelivery(text) : text;

	// First attempt: include optional voice and high-quality params
	const tryRequest = async (url: string, textToUse: string = processedText) => {
		const response = await axios.post(
			url,
			{ text: textToUse },
			{
				headers: {
					Authorization: `Token ${apiKey}`,
					'Content-Type': 'application/json',
					Accept: 'audio/mpeg', // MP3 format for best compatibility and quality
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
	const baseUrl = `${DEEPGRAM_API_URL}?model=${encodeURIComponent(selectedModel)}`;
	const urlWithVoice = withVoice ? `${baseUrl}&voice=${encodeURIComponent(voice!)}` : baseUrl;

	// Try with voice if provided, then without voice, then fallback model
	// If SSML fails, retry with plain text
	try {
		return await tryRequest(urlWithVoice);
	} catch (err) {
		// If SSML was used and failed, try with plain text (SSML might not be supported)
		if (upbeat && processedText !== text) {
			try {
				return await tryRequest(urlWithVoice, text);
			} catch {
				// Continue to next fallback
			}
		}
		// Retry without voice param (some models ignore or reject voice)
		try {
			return await tryRequest(baseUrl);
		} catch {
			// If SSML was used and failed, try with plain text
			if (upbeat && processedText !== text) {
				try {
					return await tryRequest(baseUrl, text);
				} catch {
					// Continue to next fallback
				}
			}
			// Final fallback: try premium models in order of quality
			// For upbeat content, prioritize more energetic female models
			const fallbackModels = upbeat ? [
				'aura-hera-en',    // Natural female with good energy (upbeat)
				'aura-athena-2',   // Most realistic female
				'aura-athena-en',  // Natural female
				'aura-orpheus-en', // More energetic male voice (fallback)
				'aura-zeus-2',     // Most realistic male (fallback)
				'aura-zeus-en',    // Natural male (fallback)
			] : [
				'aura-athena-2',   // Most realistic female
				'aura-zeus-2',     // Most realistic male
				'aura-athena-en',  // Natural female
				'aura-zeus-en',    // Natural male
				'aura-hera-en',    // Original natural female
			];
			
			for (const fallbackModel of fallbackModels) {
				try {
					const fallbackUrl = `${DEEPGRAM_API_URL}?model=${encodeURIComponent(fallbackModel)}`;
					return await tryRequest(fallbackUrl);
				} catch {
					// If SSML was used and failed, try with plain text
					if (upbeat && processedText !== text) {
						try {
							const fallbackUrl = `${DEEPGRAM_API_URL}?model=${encodeURIComponent(fallbackModel)}`;
							return await tryRequest(fallbackUrl, text);
						} catch {
							// Try next fallback
							continue;
						}
					}
					// Try next fallback
					continue;
				}
			}
			
			// If all fallbacks fail, throw the last error
			throw new Error('All Deepgram TTS models failed. Please check your API key and model availability.');
		}
	}
};