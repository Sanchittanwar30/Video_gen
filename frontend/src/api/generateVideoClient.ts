import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
	const {data} = await axios.post<GenerateVideoResponse>(`${API_BASE_URL}/api/generate-video`, payload);
	
	// Video URL is already correct (either relative path via Vite proxy, or absolute URL)
	console.log('📹 Video URL from API:', data.videoUrl);
	
	return data;
};


