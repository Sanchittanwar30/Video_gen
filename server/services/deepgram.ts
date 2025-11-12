import axios from 'axios';

const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/speak';

export interface DeepgramSynthesisOptions {
	text: string;
	voice?: string;
	model?: string;
}

const DEFAULT_TTS_MODEL = process.env.DEEPGRAM_TTS_MODEL ?? 'aura-asteria-en';
const DEFAULT_TTS_VOICE = process.env.DEEPGRAM_TTS_VOICE;

export const synthesizeSpeech = async ({
	text,
	voice = DEFAULT_TTS_VOICE,
	model = DEFAULT_TTS_MODEL,
}: DeepgramSynthesisOptions): Promise<Buffer> => {
	const apiKey = process.env.DEEPGRAM_API_KEY;
	if (!apiKey) {
		throw new Error('DEEPGRAM_API_KEY not configured');
	}

	const params = new URLSearchParams({
		model,
		format: 'mp3',
	});

	if (voice && voice.trim().length > 0) {
		params.set('voice', voice);
	}

	const response = await axios.post(
		`${DEEPGRAM_API_URL}?${params.toString()}`,
		{
			text,
		},
		{
			headers: {
				Authorization: `Token ${apiKey}`,
				'Content-Type': 'application/json',
				Accept: 'audio/mpeg',
			},
			responseType: 'arraybuffer',
		}
	);

	return Buffer.from(response.data);
};