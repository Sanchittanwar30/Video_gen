import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Loader2, Download, Copy, RefreshCw, Video, Play } from 'lucide-react';
import axios from 'axios';

interface DiagramResponse {
  success: boolean;
  svg: string;
  mermaidCode: string;
  diagramType: string;
}

interface DiagramVideoResponse {
  success: boolean;
  videoUrl: string;
  transcript: string;
  transcriptUrl?: string;
  mermaidCode: string;
  diagramSvg: string;
  jobId: string;
}

export default function Diagrams() {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagram, setDiagram] = useState<DiagramResponse | null>(null);
  const [videoResult, setVideoResult] = useState<DiagramVideoResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }

    setLoading(true);
    setError(null);
    setDiagram(null);

    try {
      const response = await axios.post<DiagramResponse>(
        '/api/diagrams/generate',
        { 
          description: description.trim(),
          diagramType: 'sequenceDiagram'
        }
      );

      if (response.data.success) {
        setDiagram(response.data);
      } else {
        setError('Failed to generate diagram');
      }
    } catch (err: any) {
      console.error('Diagram generation failed:', err);
      const message = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to generate diagram';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!diagram?.svg) return;

    const blob = new Blob([diagram.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diagram-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyMermaidCode = () => {
    if (!diagram?.mermaidCode) return;

    navigator.clipboard.writeText(diagram.mermaidCode).then(() => {
      alert('Mermaid code copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy to clipboard');
    });
  };

  const handleGenerateVideo = async () => {
    if (!diagram) {
      setError('Please generate a diagram first');
      return;
    }

    setGeneratingVideo(true);
    setError(null);
    setVideoResult(null);

    try {
      const response = await axios.post<DiagramVideoResponse>(
        '/api/diagrams/generate-video',
        { 
          description: description.trim(),
          diagramType: 'sequenceDiagram'
        }
      );

      if (response.data.success) {
        setVideoResult(response.data);
      } else {
        setError('Failed to generate video');
      }
    } catch (err: any) {
      console.error('Video generation failed:', err);
      const message = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to generate video';
      setError(message);
    } finally {
      setGeneratingVideo(false);
    }
  };

  const handleReset = () => {
    setDescription('');
    setDiagram(null);
    setVideoResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-2">Architectural Diagrams</h2>
        <p className="text-muted-foreground">
          Generate sequence diagrams and architectural visualizations from natural language descriptions
        </p>
      </div>

      {/* Generation Form */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Diagram</CardTitle>
          <CardDescription>
            Describe the interaction flow, architecture, or sequence you want to visualize
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Show the login flow: user enters credentials, frontend sends to API, API validates with database, returns token..."
                rows={6}
                disabled={loading}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Examples: "login flow", "payment service calling order service", "authentication flow", "API call sequence"
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading} size="lg" className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Diagram'
                )}
              </Button>
              {diagram && (
                <Button type="button" variant="outline" onClick={handleReset} size="lg">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <span className="font-semibold">Error:</span>
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diagram Result */}
      {diagram && (
        <Card className="border-primary shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Generated Diagram</CardTitle>
                <CardDescription>Your architectural diagram is ready!</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyMermaidCode}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Mermaid Code
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  Download SVG
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleGenerateVideo}
                  disabled={generatingVideo}
                >
                  {generatingVideo ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Video...
                    </>
                  ) : (
                    <>
                      <Video className="w-4 h-4 mr-2" />
                      Generate Video
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* SVG Display */}
            <div className="rounded-lg border border-border bg-white p-4 overflow-auto">
              <div 
                dangerouslySetInnerHTML={{ __html: diagram.svg }}
                className="flex justify-center items-center"
              />
            </div>

            {/* Mermaid Code (Collapsible) */}
            <details className="border rounded-lg">
              <summary className="p-3 cursor-pointer font-medium hover:bg-muted/50">
                View Mermaid Code
              </summary>
              <div className="p-4 border-t bg-muted/30">
                <pre className="text-xs overflow-auto">
                  <code>{diagram.mermaidCode}</code>
                </pre>
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      {/* Video Result */}
      {videoResult && (
        <Card className="border-primary shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Generated Video</CardTitle>
                <CardDescription>Your diagram video with voiceover and subtitles is ready!</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Video Player */}
            <div className="relative rounded-xl overflow-hidden bg-black shadow-2xl">
              <video
                key={videoResult.videoUrl}
                controls
                autoPlay
                preload="auto"
                playsInline
                className="w-full aspect-video"
                onError={(e) => {
                  console.error('Video playback error:', e);
                  setError(`Failed to load video from: ${videoResult.videoUrl}`);
                }}
              >
                <source src={videoResult.videoUrl} type="video/mp4" />
                Your browser does not support HTML5 video playback.
              </video>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button asChild size="lg">
                <a href={videoResult.videoUrl} target="_blank" rel="noreferrer">
                  <Play className="w-4 h-4 mr-2" />
                  Open in New Tab
                </a>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <a href={videoResult.videoUrl} download>
                  <Download className="w-4 h-4 mr-2" />
                  Download MP4
                </a>
              </Button>
            </div>

            {/* Transcript */}
            <details className="border rounded-lg">
              <summary className="p-3 cursor-pointer font-medium hover:bg-muted/50">
                View Transcript (Voiceover Script)
              </summary>
              <div className="p-4 border-t bg-muted/30">
                <p className="text-sm whitespace-pre-wrap">{videoResult.transcript}</p>
              </div>
            </details>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

