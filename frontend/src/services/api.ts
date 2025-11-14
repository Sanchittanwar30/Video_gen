import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface GenerateVideoPayload {
  topic: string;
  durationSeconds?: number;
  backgroundMusic?: string;
  notes?: string;
  presentation?: Record<string, unknown>;
}

export interface GenerateVideoResponse {
  videoUrl: string;
  transcript?: string;
  transcriptUrl?: string;
  content?: Record<string, unknown>;
}

export const api = {
  async generateVideo(data: GenerateVideoPayload): Promise<GenerateVideoResponse> {
    const response = await axios.post(`${API_BASE_URL}/api/video/generate`, data);
    return response.data;
  },
};

