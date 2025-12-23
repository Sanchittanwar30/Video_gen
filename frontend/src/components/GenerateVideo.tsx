import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Sparkles, Mic, MicOff, Loader2, Play, Download } from 'lucide-react';
import { generateVideoFromAI, GenerateVideoFrame } from '../api/generateVideoClient';
import VideoGenerationProgress from './VideoGenerationProgress';
import Confetti from './Confetti';

// TypeScript types for Speech Recognition API
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}

type RequestState = 'idle' | 'loading' | 'error' | 'success';

export default function GenerateVideo() {
  const [topic, setTopic] = useState('Quantum Entanglement Explained Simply');
  const [description, setDescription] = useState('Introduce the concept, walk through an example with two particles, and conclude with why observation collapses the state.');
  const [state, setState] = useState<RequestState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [frames, setFrames] = useState<GenerateVideoFrame[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Voice input state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string>('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsRecording(true);
          setVoiceStatus('Listening...');
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interimTranscript = '';
          let finalTranscript = description;

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          setDescription(finalTranscript.trim());
          if (interimTranscript) {
            setVoiceStatus(`Listening: ${interimTranscript.substring(0, 50)}...`);
          } else {
            setVoiceStatus('Listening...');
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error);
          setIsRecording(false);
          if (event.error === 'no-speech') {
            setVoiceStatus('No speech detected. Try again.');
          } else if (event.error === 'audio-capture') {
            setVoiceStatus('Microphone not found.');
          } else if (event.error === 'not-allowed') {
            setVoiceStatus('Microphone permission denied.');
          } else {
            setVoiceStatus(`Error: ${event.error}`);
          }
          setTimeout(() => setVoiceStatus(''), 3000);
        };

        recognition.onend = () => {
          setIsRecording(false);
          if (voiceStatus.includes('Listening')) {
            setVoiceStatus('Recording stopped');
            setTimeout(() => setVoiceStatus(''), 2000);
          }
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [description, voiceStatus]);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition is not supported in your browser.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err: any) {
        console.error('Failed to start recognition:', err);
        setError('Failed to start voice input. Please try again.');
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    setState('loading');
    setError(null);
    setVideoUrl(null);
    setFrames([]);
    
    const tempJobId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setJobId(tempJobId);

    try {
      const response = await generateVideoFromAI({ topic, description });
      setFrames(response.frames);
      setJobId(response.jobId || tempJobId);
      setTitle(response.title);
      
      if (response.videoUrl) {
        setVideoUrl(response.videoUrl);
        setState('success');
      }
    } catch (err: any) {
      console.error('API Error:', err);
      setState('error');
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to generate video plan.');
      setJobId(null);
    }
  };

  const handleProgressComplete = (url: string) => {
    if (url) {
      setVideoUrl(url);
      setState('success');
      setShowConfetti(true);
    } else {
      setError('Video generated but URL not found');
      setState('error');
    }
  };

  const handleProgressError = (errorMsg: string) => {
    setError(errorMsg);
    setState('error');
    setJobId(null);
  };

  return (
    <div className="space-y-6">
      {showConfetti && <Confetti duration={4000} />}
      
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-2">Generate Video</h2>
        <p className="text-muted-foreground">
          Create professional AI-powered videos with automated storyboarding, visuals, and voiceovers
        </p>
      </div>

      {/* Generation Form */}
      <Card>
        <CardHeader>
          <CardTitle>Video Details</CardTitle>
          <CardDescription>
            Describe your video topic and let AI generate a complete storyboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Topic</label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter video topic..."
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Description</label>
                {voiceStatus && (
                  <span className="text-xs text-muted-foreground">{voiceStatus}</span>
                )}
              </div>
              <div className="relative">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the video content..."
                  rows={4}
                  className="pr-12"
                />
                <Button
                  type="button"
                  variant={isRecording ? "destructive" : "ghost"}
                  size="icon"
                  className="absolute right-2 top-2"
                  onClick={toggleVoiceInput}
                  disabled={state === 'loading'}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <Button type="submit" disabled={state === 'loading'} size="lg" className="w-full">
              {state === 'loading' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Storyboard
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Progress */}
      {state === 'loading' && jobId && (
        <Card>
          <CardContent className="pt-6">
            <VideoGenerationProgress
              jobId={jobId}
              onComplete={handleProgressComplete}
              onError={handleProgressError}
            />
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {state === 'error' && error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <span className="font-semibold">Error:</span>
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {state === 'success' && videoUrl && (
        <Card className="border-primary shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{title}</CardTitle>
                <CardDescription>Video generated successfully! Job ID: {jobId}</CardDescription>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                Ready to Play
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Video Player */}
            <div className="relative rounded-xl overflow-hidden bg-black shadow-2xl">
              <video
                key={videoUrl}
                controls
                autoPlay
                preload="auto"
                playsInline
                controlsList="nodownload"
                className="w-full aspect-video"
                onLoadedMetadata={(e) => {
                  const video = e.target as HTMLVideoElement;
                  console.log(`✅ Video loaded: ${video.duration.toFixed(2)}s`);
                }}
                onPlay={() => console.log('▶️ Video playing')}
                onPause={() => console.log('⏸️ Video paused')}
                onEnded={() => console.log('🏁 Video ended')}
                onError={(e) => {
                  console.error('❌ Video playback error:', e);
                  setError(`Failed to load video from: ${videoUrl}`);
                }}
              >
                <source src={videoUrl} type="video/mp4" />
                Your browser does not support HTML5 video playback.
              </video>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button asChild size="lg">
                <a href={videoUrl} target="_blank" rel="noreferrer">
                  <Play className="w-4 h-4 mr-2" />
                  Open in New Tab
                </a>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <a href={videoUrl} download>
                  <Download className="w-4 h-4 mr-2" />
                  Download MP4
                </a>
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin + videoUrl);
                  alert('Video URL copied to clipboard!');
                }}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy Link
              </Button>
            </div>

            {/* Video Info */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">Video Information</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">URL:</span>
                  <code className="ml-2 text-xs bg-background px-2 py-1 rounded">{videoUrl}</code>
                </div>
                <div>
                  <span className="text-muted-foreground">Format:</span>
                  <span className="ml-2 font-medium">MP4</span>
                </div>
              </div>
            </div>

            {/* Storyboard Frames */}
            {frames.length > 0 && (
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h4 className="font-semibold text-lg">Storyboard Frames ({frames.length})</h4>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {frames.map((frame, index) => (
                    <div key={frame.id} className="p-4 rounded-lg bg-muted/50 border border-border hover:border-primary transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm mb-1 truncate">{frame.heading ?? frame.id}</div>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="px-2 py-0.5 rounded bg-background">
                              {frame.type}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-background">
                              ⏱️ {frame.duration ?? 4}s
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

