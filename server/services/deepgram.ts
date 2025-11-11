import axios from 'axios';

const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/speak';

export interface DeepgramSynthesisOptions {
	text: string;
	voice?: string;
	model?: string;
}

export const synthesizeSpeech = async ({
	text,
	voice = 'aura-asteria-en',
	model = 'nova-2',
}: DeepgramSynthesisOptions): Promise<Buffer> => {
	const apiKey = process.env.DEEPGRAM_API_KEY;
	if (!apiKey) {
		throw new Error('DEEPGRAM_API_KEY not configured');
	}

	const params = new URLSearchParams({
		model,
		voice,
		format: 'mp3',
	});

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