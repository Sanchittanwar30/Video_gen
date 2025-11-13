import axios from 'axios';

export interface GenerateVideoRequest {
	topic: string;
	description?: string;
}

export interface GenerateVideoFrame {
	id: string;
	type: 'whiteboard_diagram' | 'text_slide' | 'bullet_slide' | 'motion_scene';
	heading?: string;
	text?: string;
	bullets?: string[];
	duration?: number;
	asset?: string;
	prompt_for_image?: string;
	prompt_for_video?: string;
}

export interface GenerateVideoResponse {
	jobId: string;
	title: string;
	frames: GenerateVideoFrame[];
	videoUrl: string;
}

export const generateVideoFromAI = async (
	payload: GenerateVideoRequest
): Promise<GenerateVideoResponse> => {
	const {data} = await axios.post<GenerateVideoResponse>('/api/generate-video', payload);
	return data;
};


