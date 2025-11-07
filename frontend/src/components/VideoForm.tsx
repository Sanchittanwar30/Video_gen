import { useEffect, useRef, useState } from 'react';
import { api, VideoJobRequest } from '../services/api';
import { openaiService, VideoRequirements } from '../services/openai';
import './VideoForm.css';

interface VideoFormProps {
  onJobCreated: (jobId: string) => void;
}

export default function VideoForm({ onJobCreated }: VideoFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [formData, setFormData] = useState<VideoRequirements>({
    topic: '',
    description: '',
    style: 'professional',
    duration: 10,
    includeAudio: false,
    backgroundType: 'image',
    backgroundColor: '#667eea',
  });
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      recognitionRef.current = null;
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (!transcript) {
        return;
      }
      setFormData((prev) => ({
        ...prev,
        description: prev.description
          ? `${prev.description.trim()} ${transcript}`
          : transcript,
      }));
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
  }, []);

  const handleVoiceToggle = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      try {
        setIsRecording(true);
        recognitionRef.current.start();
      } catch (err) {
        console.error('Speech recognition start error:', err);
        setIsRecording(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Step 1: Generate content using OpenAI
      const generatedContent = await openaiService.generateVideoContent(formData);

      // Step 2: Create video job
      const jobRequest: VideoJobRequest = {
        template: generatedContent.template,
        input: generatedContent.input,
        options: {
          fps: 30,
          width: 1920,
          height: 1080,
          duration: formData.duration ? formData.duration * 30 : 300,
          lowResolution: false,
        },
      };

      const response = await api.generateVideo(jobRequest);
      onJobCreated(response.jobId);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to generate video');
      console.error('Error generating video:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="video-form">
      <div className="form-group">
        <label htmlFor="topic">Video Topic *</label>
        <input
          id="topic"
          type="text"
          value={formData.topic}
          onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
          placeholder="e.g., Product launch announcement, Company introduction"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">Video Description</label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Add more context or bullet points for the video"
          rows={4}
        />
        <button
          type="button"
          className={`voice-button ${isRecording ? 'recording' : ''}`}
          onClick={handleVoiceToggle}
        >
          {isRecording ? 'Stop Voice Input' : 'Speak Description'}
        </button>
        <span className="voice-hint">Use your voice to append to the description.</span>
      </div>

      <div className="form-group">
        <label htmlFor="style">Style</label>
        <select
          id="style"
          value={formData.style}
          onChange={(e) => setFormData({ ...formData, style: e.target.value })}
        >
          <option value="professional">Professional</option>
          <option value="casual">Casual</option>
          <option value="creative">Creative</option>
          <option value="minimalist">Minimalist</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="duration">Duration (seconds)</label>
        <input
          id="duration"
          type="number"
          min="5"
          max="60"
          value={formData.duration}
          onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 10 })}
        />
      </div>

      <div className="form-group">
        <label htmlFor="backgroundType">Background Type</label>
        <select
          id="backgroundType"
          value={formData.backgroundType}
          onChange={(e) => setFormData({ ...formData, backgroundType: e.target.value as any })}
        >
          <option value="image">Image</option>
          <option value="color">Solid Color</option>
          <option value="gradient">Gradient</option>
        </select>
      </div>

      {formData.backgroundType === 'color' && (
        <div className="form-group">
          <label htmlFor="backgroundColor">Background Color</label>
          <input
            id="backgroundColor"
            type="color"
            value={formData.backgroundColor}
            onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
          />
        </div>
      )}

      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={formData.includeAudio}
            onChange={(e) => setFormData({ ...formData, includeAudio: e.target.checked })}
          />
          Include voiceover audio
        </label>
      </div>

      {error && <div className="error-message">{error}</div>}

      <button type="submit" disabled={loading || !formData.topic} className="submit-button">
        {loading ? 'Generating...' : 'Generate Video'}
      </button>
    </form>
  );
}

