import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface VideoJobRequest {
  template: any;
  input: Record<string, any>;
  options?: {
    fps?: number;
    width?: number;
    height?: number;
    duration?: number;
    lowResolution?: boolean;
  };
  webhookUrl?: string;
}

export interface VideoJobResponse {
  jobId: string;
  status: string;
  message: string;
  estimatedTime?: string;
}

export interface JobStatus {
  jobId: string;
  status: string;
  progress: number;
  result?: {
    jobId: string;
    status: string;
    videoUrl: string;
    remotePath: string;
    completedAt: string;
  };
  error?: string;
  createdAt?: number;
  processedAt?: number;
  finishedAt?: number;
}

export const api = {
  /**
   * Generate a video
   */
  async generateVideo(data: VideoJobRequest): Promise<VideoJobResponse> {
    const response = await axios.post(`${API_BASE_URL}/api/video/generate`, data);
    return response.data;
  },

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobStatus> {
    const response = await axios.get(`${API_BASE_URL}/api/video/status/${jobId}`);
    return response.data;
  },

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/api/video/cancel/${jobId}`);
  },
};

