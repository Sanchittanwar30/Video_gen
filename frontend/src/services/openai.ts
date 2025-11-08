import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface VideoRequirements {
  topic: string;
  description?: string;
  style?: string;
  duration?: number;
  backgroundType?: 'image' | 'color' | 'gradient';
  backgroundColor?: string;
  includeAudio?: boolean;
}

export interface GeneratedContent {
  title: string;
  subtitle: string;
  backgroundImage?: string;
  logoImage?: string;
  voiceoverScript?: string;
  transcript?: string;
  voiceoverAudio?: string;
  template: any;
  input: Record<string, any>;
}

export const openaiService = {
  /**
   * Generate video content using OpenAI
   */
  async generateVideoContent(requirements: VideoRequirements): Promise<GeneratedContent> {
    const response = await axios.post(`${API_BASE_URL}/api/ai/generate-content`, requirements);
    const { template, input, generatedContent } = response.data || {};
    return {
      template,
      input: input || {},
      title: generatedContent?.title,
      subtitle: generatedContent?.subtitle,
      backgroundImage: generatedContent?.backgroundImage,
      logoImage: generatedContent?.logoImage,
      voiceoverScript: generatedContent?.voiceoverScript,
      transcript: generatedContent?.transcript,
      voiceoverAudio: generatedContent?.voiceoverAudio ?? input?.voiceoverAudio,
    };
  },
};

