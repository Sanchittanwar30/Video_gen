import axios from 'axios';
import {createWriteStream} from 'fs';
import {pipeline} from 'stream';
import {promisify} from 'util';

const streamPipeline = promisify(pipeline);

const DEEPGRAM_ENDPOINT_BASE = 'https://api.deepgram.com/v1/speak';

export interface DeepgramSpeakOptions {
	model?: string;
	voice?: string;
	responseFormat?: 'mp3' | 'wav' | 'ogg';
}

export const defaultDeepgramOptions: Required<DeepgramSpeakOptions> = {
	model: 'aura-asteria-en',
	voice: 'alloy',
	responseFormat: 'mp3',
};

function getApiKey(): string {
	const key = process.env.DEEPGRAM_API_KEY;
	if (!key) {
		throw new Error('DEEPGRAM_API_KEY is not configured.');
	}
	return key;
}

export async function synthesizeSpeechToFile(
	text: string,
	outputPath: string,
	options: DeepgramSpeakOptions = {}
): Promise<void> {
	const apiKey = getApiKey();
	const {model, voice, responseFormat} = {...defaultDeepgramOptions, ...options};

	const url = `${DEEPGRAM_ENDPOINT_BASE}?model=${encodeURIComponent(model)}&voice=${encodeURIComponent(
		voice
	)}&format=${encodeURIComponent(responseFormat)}`;

	const response = await axios.post(url, {text}, {
		headers: {
			Authorization: `Token ${apiKey}`,
			'Content-Type': 'application/json',
		},
		responseType: 'stream',
	});

	const writer = createWriteStream(outputPath);
	await streamPipeline(response.data, writer);
}

export function hasDeepgram(): boolean {
	return Boolean(process.env.DEEPGRAM_API_KEY);
}

