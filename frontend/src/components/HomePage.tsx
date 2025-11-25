import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Video, Image, Sparkles, TrendingUp, Clock, Zap } from 'lucide-react';
import axios from 'axios';

interface HomePageProps {
  onNavigate: (page: string) => void;
}

interface LibraryStats {
  videos: { count: number; totalSize: string };
  photos: { count: number; totalSize: string };
  total: { count: number; totalSize: string };
}

export default function HomePage({ onNavigate }: HomePageProps) {
  const [stats, setStats] = useState<LibraryStats | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await axios.get('/api/library/stats');
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };
  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 md:p-12">
        <div className="relative z-10">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Welcome to VideoGen Studio
          </h1>
          <p className="text-xl text-muted-foreground mb-6 max-w-2xl">
            Transform your ideas into professional videos with AI-powered visuals and animations.
            Generate educational content, marketing videos, and more in minutes.
          </p>
          <div className="flex gap-3">
            <Button size="lg" onClick={() => onNavigate('generate')}>
              <Sparkles className="w-5 h-5 mr-2" />
              Generate New Video
            </Button>
            <Button size="lg" variant="outline" onClick={() => onNavigate('videos')}>
              Browse Library
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Videos</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.videos.count || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.videos.totalSize || '0 MB'} storage</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Images</CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.photos.count || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.photos.totalSize || '0 MB'} storage</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total.count || 0}</div>
            <p className="text-xs text-muted-foreground">Videos & images combined</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total.totalSize || '0 MB'}</div>
            <p className="text-xs text-muted-foreground">All media files</p>
          </CardContent>
        </Card>
      </div>

      {/* Features */}
      <div>
        <h2 className="text-2xl font-bold mb-6">Features</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>AI Storyboard Generator</CardTitle>
              <CardDescription>
                Generate complete video storyboards from simple topic descriptions using advanced AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={() => onNavigate('generate')}>
                Try Now
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Image className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>AI Image Generation</CardTitle>
              <CardDescription>
                Create custom visuals and diagrams with Gemini AI for your videos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={() => onNavigate('photos')}>
                View Gallery
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Voice Synthesis</CardTitle>
              <CardDescription>
                Generate natural-sounding voiceovers with Deepgram text-to-speech
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={() => onNavigate('generate')}>
                Create Voiceover
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Video className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Whiteboard Animations</CardTitle>
              <CardDescription>
                Transform images into hand-drawn whiteboard animations with smooth stroke effects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={() => onNavigate('generate')}>
                Create Animation
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Auto Subtitles</CardTitle>
              <CardDescription>
                Automatic YouTube-style subtitle overlays for better accessibility
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={() => onNavigate('generate')}>
                Add Subtitles
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Real-time Progress</CardTitle>
              <CardDescription>
                Watch your videos being created with live WebSocket progress updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={() => onNavigate('videos')}>
                View Library
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest video generations and edits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { title: 'Quantum Entanglement Explained', time: '2 hours ago', type: 'video' },
              { title: 'Solar System Tour', time: '5 hours ago', type: 'video' },
              { title: 'Photosynthesis Diagram', time: 'Yesterday', type: 'image' },
              { title: 'Chemical Reactions', time: '2 days ago', type: 'video' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  {item.type === 'video' ? (
                    <Video className="w-5 h-5 text-primary" />
                  ) : (
                    <Image className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.time}</p>
                </div>
                <Button variant="ghost" size="sm">View</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

