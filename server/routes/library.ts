import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { config } from '../config';

const router = Router();

// Configure multer for file uploads
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'site-library', 'video');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Keep original filename
    cb(null, file.originalname);
  }
});

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'site-library', 'image');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Keep original filename
    cb(null, file.originalname);
  }
});

// File filters
const videoFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'video/mp4') {
    cb(null, true);
  } else {
    cb(new Error('Only MP4 video files are allowed'));
  }
};

const imageFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, WebP, GIF, and SVG image files are allowed'));
  }
};

const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: videoFilter,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB max
});

const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

interface VideoMetadata {
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

interface PhotoMetadata {
  id: string;
  name: string;
  url: string;
  thumbnail?: string;
  createdAt: string;
  size: string;
  dimensions?: string;
  type: string;
}

/**
 * GET /api/library/videos
 * List all videos from site-library/video folder
 */
router.get('/videos', async (req: Request, res: Response) => {
  try {
    const videoDir = path.join(process.cwd(), 'site-library', 'video');
    
    // Ensure directory exists
    try {
      await fs.access(videoDir);
    } catch (error) {
      await fs.mkdir(videoDir, { recursive: true });
    }
    
    // Read all files in video directory
    const files = await fs.readdir(videoDir);
    
    // Filter for MP4 files
    const videoFiles = files.filter(file => file.endsWith('.mp4'));
    
    // Get metadata for each video
    const videos: VideoMetadata[] = await Promise.all(
      videoFiles.map(async (file) => {
        const filePath = path.join(videoDir, file);
        const stats = await fs.stat(filePath);
        const metadataPath = filePath.replace('.mp4', '-metadata.json');
        const transcriptPath = filePath.replace('.mp4', '-transcript.txt');
        
        let metadata: any = {};
        let description = '';
        
        // Try to read metadata file
        try {
          const metadataContent = await fs.readFile(metadataPath, 'utf-8');
          metadata = JSON.parse(metadataContent);
          description = metadata.title || metadata.topic || '';
        } catch (error) {
          // Metadata file doesn't exist, that's okay
        }
        
        // Try to read transcript for description
        if (!description) {
          try {
            const transcript = await fs.readFile(transcriptPath, 'utf-8');
            description = transcript.substring(0, 100) + '...';
          } catch (error) {
            // Transcript doesn't exist
          }
        }
        
        // Extract name from filename
        const name = file
          .replace('.mp4', '')
          .replace('ai-storyboard-', '')
          .replace(/-/g, ' ')
          .replace(/^\d+/, '')
          .trim() || 'Untitled Video';
        
        const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        
        return {
          id: file.replace('.mp4', ''),
          name: metadata.title || name,
          description: description || 'AI-generated video',
          url: `${baseUrl}/site-library/video/${file}`,
          thumbnail: `${baseUrl}/site-library/video/${file.replace('.mp4', '-thumbnail.jpg')}`,
          duration: metadata.duration || 'Unknown',
          createdAt: stats.mtime.toISOString(),
          size: formatBytes(stats.size),
          metadata: metadata,
        };
      })
    );
    
    // Sort by creation date (newest first)
    videos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json({
      success: true,
      count: videos.length,
      videos,
    });
  } catch (error: any) {
    console.error('Error listing videos:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list videos',
    });
  }
});

/**
 * GET /api/library/photos
 * List all images from site-library/image folder
 */
router.get('/photos', async (req: Request, res: Response) => {
  try {
    const imageDir = path.join(process.cwd(), 'site-library', 'image');
    
    // Ensure directory exists
    try {
      await fs.access(imageDir);
    } catch (error) {
      await fs.mkdir(imageDir, { recursive: true });
    }
    
    let photos: PhotoMetadata[] = [];
    
    // Read all image files from site-library/image directory
    try {
      const files = await fs.readdir(imageDir);
      const imageFiles = files.filter(file => 
        file.endsWith('.jpg') || 
        file.endsWith('.jpeg') || 
        file.endsWith('.png') || 
        file.endsWith('.webp') ||
        file.endsWith('.gif') ||
        file.endsWith('.svg')
      );
      
      const imagePhotos = await Promise.all(
        imageFiles.map(async (file) => {
          const filePath = path.join(imageDir, file);
          const stats = await fs.stat(filePath);
          
          // Determine file type
          const ext = file.split('.').pop()?.toLowerCase() || '';
          const type = ext === 'svg' ? 'svg' : 'image';
          const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
          
          return {
            id: file,
            name: file.replace(/\.(jpg|jpeg|png|webp|gif|svg)$/, '').replace(/-/g, ' ').replace(/_/g, ' '),
            url: `${baseUrl}/site-library/image/${file}`,
            thumbnail: `${baseUrl}/site-library/image/${file}`,
            createdAt: stats.mtime.toISOString(),
            size: formatBytes(stats.size),
            dimensions: ext === 'svg' ? 'SVG' : 'Unknown',
            type: type,
          };
        })
      );
      
      photos = photos.concat(imagePhotos);
    } catch (error) {
      console.log('Image directory not found or empty');
    }
    
    // Sort by creation date (newest first)
    photos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json({
      success: true,
      count: photos.length,
      photos,
    });
  } catch (error: any) {
    console.error('Error listing photos:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list photos',
    });
  }
});

/**
 * DELETE /api/library/videos/:id
 * Delete a video and its associated files
 */
router.delete('/videos/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const videoDir = path.join(process.cwd(), 'site-library', 'video');
    
    // Delete main video file
    const videoPath = path.join(videoDir, `${id}.mp4`);
    await fs.unlink(videoPath);
    
    // Try to delete associated files (metadata, transcript, voiceover, thumbnail)
    const associatedFiles = [
      `${id}-metadata.json`,
      `${id}-transcript.txt`,
      `${id}-voiceover.mp3`,
      `${id}-thumbnail.jpg`,
    ];
    
    for (const file of associatedFiles) {
      try {
        await fs.unlink(path.join(videoDir, file));
      } catch (error) {
        // File might not exist, that's okay
      }
    }
    
    res.json({
      success: true,
      message: 'Video deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting video:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete video',
    });
  }
});

/**
 * DELETE /api/library/photos/:id
 * Delete a photo
 */
router.delete('/photos/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const imageDir = path.join(process.cwd(), 'site-library', 'image');
    
    // Delete the image file
    const filePath = path.join(imageDir, id);
    await fs.unlink(filePath);
    
    res.json({
      success: true,
      message: 'Photo deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting photo:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete photo',
    });
  }
});

/**
 * POST /api/library/videos/upload
 * Upload videos to site-library
 */
router.post('/videos/upload', uploadVideo.array('videos', 10), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No video files provided'
      });
    }
    
    const uploadedFiles = files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      size: formatBytes(file.size),
      path: `/site-library/video/${file.filename}`
    }));
    
    res.json({
      success: true,
      message: `Successfully uploaded ${files.length} video(s)`,
      files: uploadedFiles
    });
  } catch (error: any) {
    console.error('Error uploading videos:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload videos'
    });
  }
});

/**
 * POST /api/library/photos/upload
 * Upload images to site-library
 */
router.post('/photos/upload', uploadImage.array('images', 20), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No image files provided'
      });
    }
    
    const uploadedFiles = files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      size: formatBytes(file.size),
      path: `/site-library/image/${file.filename}`
    }));
    
    res.json({
      success: true,
      message: `Successfully uploaded ${files.length} image(s)`,
      files: uploadedFiles
    });
  } catch (error: any) {
    console.error('Error uploading images:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload images'
    });
  }
});

/**
 * GET /api/library/stats
 * Get library statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  // Initialize defaults
  let videoCount = 0;
  let totalVideoSize = 0;
  let photoCount = 0;
  let totalPhotoSize = 0;
  
  try {
    const videoDir = path.join(process.cwd(), 'site-library', 'video');
    const imageDir = path.join(process.cwd(), 'site-library', 'image');
    
    // Ensure directories exist
    try {
      await fs.access(videoDir);
    } catch (error) {
      try {
        await fs.mkdir(videoDir, { recursive: true });
      } catch (mkdirError: any) {
        console.warn('Failed to create video directory:', mkdirError?.message);
        // Continue anyway - we'll handle the error when reading
      }
    }
    
    try {
      await fs.access(imageDir);
    } catch (error) {
      try {
        await fs.mkdir(imageDir, { recursive: true });
      } catch (mkdirError: any) {
        console.warn('Failed to create image directory:', mkdirError?.message);
        // Continue anyway - we'll handle the error when reading
      }
    }
    
    // Count videos
    try {
      const videoFiles = await fs.readdir(videoDir);
      const videos = videoFiles.filter(f => f.endsWith('.mp4'));
      videoCount = videos.length;
      
      // Calculate total video size
      for (const file of videos) {
        try {
          const stats = await fs.stat(path.join(videoDir, file));
          if (stats && typeof stats.size === 'number' && isFinite(stats.size)) {
            totalVideoSize += stats.size;
          }
        } catch (statError) {
          console.warn(`Failed to stat video file ${file}:`, statError);
        }
      }
    } catch (error: any) {
      // Directory doesn't exist or is empty - this is fine
      console.log('Video directory read error (may be empty):', error?.message);
    }
    
    // Count photos
    try {
      const imageFiles = await fs.readdir(imageDir);
      const images = imageFiles.filter(f => 
        f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || 
        f.endsWith('.webp') || f.endsWith('.gif') || f.endsWith('.svg')
      );
      photoCount = images.length;
      
      for (const file of images) {
        try {
          const stats = await fs.stat(path.join(imageDir, file));
          if (stats && typeof stats.size === 'number' && isFinite(stats.size)) {
            totalPhotoSize += stats.size;
          }
        } catch (statError) {
          console.warn(`Failed to stat image file ${file}:`, statError);
        }
      }
    } catch (error: any) {
      // Directory doesn't exist or is empty - this is fine
      console.log('Image directory read error (may be empty):', error?.message);
    }
    
    // Ensure we have valid numbers before formatting
    const safeVideoSize = isFinite(totalVideoSize) && !isNaN(totalVideoSize) ? totalVideoSize : 0;
    const safePhotoSize = isFinite(totalPhotoSize) && !isNaN(totalPhotoSize) ? totalPhotoSize : 0;
    const safeVideoCount = Number.isInteger(videoCount) ? videoCount : 0;
    const safePhotoCount = Number.isInteger(photoCount) ? photoCount : 0;
    
    res.json({
      success: true,
      stats: {
        videos: {
          count: safeVideoCount,
          totalSize: formatBytes(safeVideoSize),
          totalSizeBytes: safeVideoSize,
        },
        photos: {
          count: safePhotoCount,
          totalSize: formatBytes(safePhotoSize),
          totalSizeBytes: safePhotoSize,
        },
        total: {
          count: safeVideoCount + safePhotoCount,
          totalSize: formatBytes(safeVideoSize + safePhotoSize),
          totalSizeBytes: safeVideoSize + safePhotoSize,
        },
      },
    });
  } catch (error: any) {
    console.error('Error getting library stats:', error);
    console.error('Error stack:', error?.stack);
    
    // Ensure we have safe defaults even on error
    const safeVideoSize = isFinite(totalVideoSize) && !isNaN(totalVideoSize) ? totalVideoSize : 0;
    const safePhotoSize = isFinite(totalPhotoSize) && !isNaN(totalPhotoSize) ? totalPhotoSize : 0;
    const safeVideoCount = Number.isInteger(videoCount) ? videoCount : 0;
    const safePhotoCount = Number.isInteger(photoCount) ? photoCount : 0;
    
    // Return safe defaults - all edge cases should be handled above,
    // so any error here is unexpected but we'll still return valid data
    if (!res.headersSent) {
      try {
        res.json({
          success: true,
          stats: {
            videos: {
              count: safeVideoCount,
              totalSize: formatBytes(safeVideoSize),
              totalSizeBytes: safeVideoSize,
            },
            photos: {
              count: safePhotoCount,
              totalSize: formatBytes(safePhotoSize),
              totalSizeBytes: safePhotoSize,
            },
            total: {
              count: safeVideoCount + safePhotoCount,
              totalSize: formatBytes(safeVideoSize + safePhotoSize),
              totalSizeBytes: safeVideoSize + safePhotoSize,
            },
          },
        });
      } catch (responseError) {
        // If we can't even send a response, something is seriously wrong
        console.error('Failed to send error response:', responseError);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Failed to get library stats',
          });
        }
      }
    }
  }
});

// Helper function to format bytes
function formatBytes(bytes: number): string {
  // Handle edge cases
  if (!bytes || bytes === 0 || !isFinite(bytes) || isNaN(bytes)) return '0 Bytes';
  if (bytes < 0) bytes = 0;
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export default router;

