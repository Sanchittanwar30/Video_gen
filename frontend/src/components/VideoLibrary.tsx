import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Play, Download, Eye, Trash2, Search, Loader2, RefreshCw, Upload } from 'lucide-react';
import { Input } from './ui/input';
import axios from 'axios';

interface VideoItem {
  id: string;
  name: string;
  description?: string;
  url: string;
  thumbnail?: string;
  duration?: string;
  createdAt: string;
  size: string;
  metadata?: any;
}

interface LibraryStats {
  videos: {
    count: number;
    totalSize: string;
    totalSizeBytes: number;
  };
  photos: {
    count: number;
    totalSize: string;
    totalSizeBytes: number;
  };
  total: {
    count: number;
    totalSize: string;
    totalSizeBytes: number;
  };
}

export default function VideoLibrary() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [playingVideos, setPlayingVideos] = useState<Set<string>>(new Set());
  const videoRefs = React.useRef<Map<string, HTMLVideoElement>>(new Map());

  // Load videos from server
  useEffect(() => {
    loadVideos();
    loadStats();
  }, []);

  const loadVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get('/api/library/videos');
      
      if (response.data.success) {
        setVideos(response.data.videos);
      } else {
        setError('Failed to load videos');
      }
    } catch (error: any) {
      console.error('Failed to load videos:', error);
      setError(error.response?.data?.error || 'Failed to load videos from server');
    } finally {
      setLoading(false);
    }
  };

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

  const filteredVideos = videos.filter(video =>
    video.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    video.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await axios.delete(`/api/library/videos/${id}`);
      
      if (response.data.success) {
        // Remove from local state
        setVideos(videos.filter(v => v.id !== id));
        // Reload stats
        loadStats();
      } else {
        alert('Failed to delete video');
      }
    } catch (error: any) {
      console.error('Failed to delete video:', error);
      alert(error.response?.data?.error || 'Failed to delete video');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
      }
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Filter for MP4 files only
    const mp4Files = Array.from(files).filter(file => file.type === 'video/mp4');
    
    if (mp4Files.length === 0) {
      alert('Please select MP4 video files only');
      return;
    }

    if (mp4Files.length > 10) {
      alert('Maximum 10 videos at a time');
      return;
    }

    setUploading(true);
    setUploadProgress(`Uploading ${mp4Files.length} video(s)...`);

    const formData = new FormData();
    mp4Files.forEach(file => {
      formData.append('videos', file);
    });

    try {
      const response = await axios.post('/api/library/videos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setUploadProgress(`Successfully uploaded ${mp4Files.length} video(s)!`);
        setTimeout(() => {
          setUploadProgress('');
          setUploading(false);
          loadVideos();
          loadStats();
        }, 2000);
      } else {
        alert('Upload failed: ' + response.data.error);
        setUploading(false);
        setUploadProgress('');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.response?.data?.error || 'Failed to upload videos');
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleUploadClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4';
    input.multiple = true;
    input.onchange = (e: any) => handleUpload(e.target.files);
    input.click();
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const handlePlayPause = (videoId: string) => {
    const video = videoRefs.current.get(videoId);
    if (!video) return;

    if (video.paused) {
      // Pause all other videos
      videoRefs.current.forEach((v, id) => {
        if (id !== videoId && !v.paused) {
          v.pause();
          setPlayingVideos(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
        }
      });

      // Play this video
      video.play().catch(err => {
        console.error('Failed to play video:', err);
      });
      setPlayingVideos(prev => new Set(prev).add(videoId));
    } else {
      video.pause();
      setPlayingVideos(prev => {
        const newSet = new Set(prev);
        newSet.delete(videoId);
        return newSet;
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Video Library</h2>
          <p className="text-muted-foreground">
            Manage and view all your generated videos
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleUploadClick} disabled={uploading} size="sm">
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? 'Uploading...' : 'Upload Videos'}
          </Button>
          <Button variant="outline" size="sm" onClick={loadVideos} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search videos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Videos</CardDescription>
              <CardTitle className="text-4xl">{stats.videos.count}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Storage Used</CardDescription>
              <CardTitle className="text-4xl">{stats.videos.totalSize}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>This Month</CardDescription>
              <CardTitle className="text-4xl">
                {videos.filter(v => {
                  const date = new Date(v.createdAt);
                  const now = new Date();
                  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                }).length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Upload Progress */}
      {uploadProgress && (
        <Card className="border-primary">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{uploadProgress}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-destructive">{error}</div>
            <Button variant="outline" size="sm" className="mt-2" onClick={loadVideos}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Drag & Drop Zone */}
      {!loading && videos.length === 0 && (
        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            dragActive ? 'border-primary bg-primary/5' : 'border-border'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Drag & Drop Videos Here</h3>
          <p className="text-muted-foreground mb-4">
            Or click the "Upload Videos" button above
          </p>
          <p className="text-sm text-muted-foreground">
            Supports: MP4 files (max 500MB each, up to 10 files)
          </p>
        </div>
      )}

      {/* Video Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-video bg-muted animate-pulse" />
              <CardHeader>
                <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                <div className="h-3 bg-muted rounded animate-pulse w-1/2 mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : filteredVideos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Play className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No videos found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {searchQuery ? 'Try adjusting your search terms' : 'Generate your first video to get started'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredVideos.map((video) => (
            <Card key={video.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
              {/* Thumbnail */}
              <div className="relative aspect-video bg-muted overflow-hidden">
                <video
                  ref={(el) => {
                    if (el) {
                      videoRefs.current.set(video.id, el);
                    } else {
                      videoRefs.current.delete(video.id);
                    }
                  }}
                  src={video.url}
                  poster={video.thumbnail}
                  className="w-full h-full object-cover cursor-pointer"
                  preload="metadata"
                  playsInline
                  onClick={() => handlePlayPause(video.id)}
                  onEnded={() => {
                    setPlayingVideos(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(video.id);
                      return newSet;
                    });
                  }}
                  onError={(e) => {
                    console.error('Video load error:', video.url);
                    const target = e.target as HTMLVideoElement;
                    target.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayPause(video.id);
                    }}
                  >
                    {playingVideos.has(video.id) ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="5" width="4" height="14" />
                        <rect x="14" y="5" width="4" height="14" />
                      </svg>
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                  <Button 
                    size="icon" 
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedVideo(video);
                    }}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="secondary" asChild>
                    <a href={video.url} download onClick={(e) => e.stopPropagation()}>
                      <Download className="w-4 h-4" />
                    </a>
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(video.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                {video.duration && video.duration !== 'Unknown' && (
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                    {video.duration}
                  </div>
                )}
              </div>

              {/* Info */}
              <CardHeader>
                <CardTitle className="text-base line-clamp-1">{video.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {video.description || 'No description'}
                </CardDescription>
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                  <span>{formatDate(video.createdAt)}</span>
                  <span>{video.size}</span>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Video Player Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div
            className="bg-background rounded-lg overflow-hidden max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aspect-video bg-black">
              <video
                src={selectedVideo.url}
                controls
                autoPlay
                className="w-full h-full"
              />
            </div>
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-2">{selectedVideo.name}</h3>
              <p className="text-muted-foreground mb-4">{selectedVideo.description}</p>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mb-4">
                <span>Created: {formatDate(selectedVideo.createdAt)}</span>
                <span>•</span>
                <span>Size: {selectedVideo.size}</span>
                {selectedVideo.duration && selectedVideo.duration !== 'Unknown' && (
                  <>
                    <span>•</span>
                    <span>Duration: {selectedVideo.duration}</span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button asChild>
                  <a href={selectedVideo.url} download>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </a>
                </Button>
                <Button variant="outline" onClick={() => setSelectedVideo(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
