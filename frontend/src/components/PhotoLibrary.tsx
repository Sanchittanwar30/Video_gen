import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Download, Eye, Trash2, Upload, Search, Image as ImageIcon, RefreshCw, Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import axios from 'axios';

interface PhotoItem {
  id: string;
  name: string;
  url: string;
  thumbnail?: string;
  createdAt: string;
  size: string;
  dimensions?: string;
  type: string;
}

interface LibraryStats {
  videos: {
    count: number;
    totalSize: string;
  };
  photos: {
    count: number;
    totalSize: string;
  };
  total: {
    count: number;
    totalSize: string;
  };
}

export default function PhotoLibrary() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);

  // Load photos from server
  useEffect(() => {
    loadPhotos();
    loadStats();
  }, []);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get('/api/library/photos');
      
      if (response.data.success) {
        setPhotos(response.data.photos);
      } else {
        setError('Failed to load photos');
      }
    } catch (error: any) {
      console.error('Failed to load photos:', error);
      setError(error.response?.data?.error || 'Failed to load photos from server');
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

  const filteredPhotos = photos.filter(photo =>
    photo.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this photo? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await axios.delete(`/api/library/photos/${id}`);
      
      if (response.data.success) {
        // Remove from local state
        setPhotos(photos.filter(p => p.id !== id));
        // Reload stats
        loadStats();
      } else {
        alert('Failed to delete photo');
      }
    } catch (error: any) {
      console.error('Failed to delete photo:', error);
      alert(error.response?.data?.error || 'Failed to delete photo');
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Filter for image files only
    const imageFiles = Array.from(files).filter(file => 
      file.type.startsWith('image/')
    );
    
    if (imageFiles.length === 0) {
      alert('Please select image files only');
      return;
    }

    if (imageFiles.length > 20) {
      alert('Maximum 20 images at a time');
      return;
    }

    setUploading(true);
    setUploadProgress(`Uploading ${imageFiles.length} image(s)...`);

    const formData = new FormData();
    imageFiles.forEach(file => {
      formData.append('images', file);
    });

    try {
      const response = await axios.post('/api/library/photos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setUploadProgress(`Successfully uploaded ${imageFiles.length} image(s)!`);
        setTimeout(() => {
          setUploadProgress('');
          setUploading(false);
          loadPhotos();
          loadStats();
        }, 2000);
      } else {
        alert('Upload failed: ' + response.data.error);
        setUploading(false);
        setUploadProgress('');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.response?.data?.error || 'Failed to upload images');
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleUploadClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Photo Library</h2>
          <p className="text-muted-foreground">
            Manage all your generated images and assets
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadPhotos} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleUploadClick} disabled={uploading} size="sm">
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? 'Uploading...' : 'Upload Photos'}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search photos..."
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
              <CardDescription>Total Photos</CardDescription>
              <CardTitle className="text-4xl">{stats.photos.count}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Storage Used</CardDescription>
              <CardTitle className="text-4xl">{stats.photos.totalSize}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>This Month</CardDescription>
              <CardTitle className="text-4xl">
                {photos.filter(p => {
                  const date = new Date(p.createdAt);
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
            <Button variant="outline" size="sm" className="mt-2" onClick={loadPhotos}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Drag & Drop Zone */}
      {!loading && photos.length === 0 && (
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
          <h3 className="text-lg font-semibold mb-2">Drag & Drop Images Here</h3>
          <p className="text-muted-foreground mb-4">
            Or click the "Upload Photos" button above
          </p>
          <p className="text-sm text-muted-foreground">
            Supports: JPG, PNG, WebP, GIF, SVG (max 50MB each, up to 20 files)
          </p>
        </div>
      )}

      {/* Photo Grid */}
      {loading ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-square bg-muted animate-pulse" />
            </Card>
          ))}
        </div>
      ) : filteredPhotos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No photos found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
              {searchQuery ? 'Try adjusting your search terms' : 'Upload or generate photos to get started'}
            </p>
            <Button onClick={handleUploadClick}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Photos
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredPhotos.map((photo) => (
            <Card key={photo.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
              {/* Thumbnail */}
              <div className="relative aspect-square bg-muted overflow-hidden">
                {photo.type === 'svg' ? (
                  <object
                    data={photo.url}
                    type="image/svg+xml"
                    className="w-full h-full object-cover"
                  >
                    <img src={photo.thumbnail || photo.url} alt={photo.name} className="w-full h-full object-cover" />
                  </object>
                ) : (
                  <img
                    src={photo.url}
                    alt={photo.name}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => setSelectedPhoto(photo)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="secondary" asChild>
                    <a href={photo.url} download={photo.name}>
                      <Download className="w-4 h-4" />
                    </a>
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => handleDelete(photo.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded uppercase">
                  {photo.type}
                </div>
              </div>

              {/* Info */}
              <CardHeader className="p-3">
                <CardTitle className="text-sm line-clamp-1">{photo.name}</CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{photo.size}</span>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Photo Viewer Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-black rounded-lg overflow-hidden mb-4">
              {selectedPhoto.type === 'svg' ? (
                <object
                  data={selectedPhoto.url}
                  type="image/svg+xml"
                  className="w-full h-auto max-h-[80vh]"
                >
                  <img
                    src={selectedPhoto.thumbnail || selectedPhoto.url}
                    alt={selectedPhoto.name}
                    className="w-full h-auto max-h-[80vh] object-contain"
                  />
                </object>
              ) : (
                <img
                  src={selectedPhoto.url}
                  alt={selectedPhoto.name}
                  className="w-full h-auto max-h-[80vh] object-contain"
                />
              )}
            </div>
            <div className="bg-background rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-2">{selectedPhoto.name}</h3>
              <div className="flex gap-4 text-sm text-muted-foreground mb-4">
                <span>{selectedPhoto.dimensions}</span>
                <span>•</span>
                <span>{selectedPhoto.size}</span>
                <span>•</span>
                <span>{formatDate(selectedPhoto.createdAt)}</span>
                <span>•</span>
                <span className="uppercase">{selectedPhoto.type}</span>
              </div>
              <div className="flex gap-2">
                <Button asChild>
                  <a href={selectedPhoto.url} download={selectedPhoto.name}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </a>
                </Button>
                <Button variant="outline" onClick={() => setSelectedPhoto(null)}>
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
