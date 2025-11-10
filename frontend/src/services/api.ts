import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface GenerateVideoPayload {
  topic?: string;
  presentation?: {
    backgroundMusic?: string;
    svgFile?: string;
    tableData?: any;
  };
  options?: {
    fps?: number;
    width?: number;
    height?: number;
    duration?: number;
  };
  transcript?: string;
}

export interface GenerateVideoResponse {
  jobId: string;
  status: 'completed';
  videoUrl: string;
  remotePath: string;
  transcriptUrl?: string;
}

export const api = {
  async generateVideo(data: GenerateVideoPayload): Promise<GenerateVideoResponse> {
    const response = await axios.post(`${API_BASE_URL}/api/video/generate`, data);
    return response.data;
  },
};

