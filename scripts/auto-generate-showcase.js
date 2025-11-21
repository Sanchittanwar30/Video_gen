#!/usr/bin/env node
/**
 * Auto-generate showcase GIFs from videos in showcase-videos folder
 * Just drop MP4 files in public/assets/showcase-videos/ and run this script!
 * 
 * Usage: node scripts/auto-generate-showcase.js
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execFileAsync = promisify(execFile);

// Configuration
const CONFIG = {
  // Source folder for showcase videos
  sourceFolder: 'public/assets/showcase-videos',
  // Output folder for GIFs (goes to both root and frontend public)
  outputFolder: 'public/assets/showcase',
  frontendOutputFolder: 'frontend/public/assets/showcase',
  // GIF settings
  gif: {
    startTime: '00:00:00', // Start from beginning
    duration: 10, // 10 seconds
    fps: 18, // Smooth but not huge
    width: 640, // Good for web
    quality: 'high', // 'high' or 'medium' or 'small'
  },
};

// Quality presets
const QUALITY_PRESETS = {
  high: { fps: 20, width: 720 },
  medium: { fps: 18, width: 640 },
  small: { fps: 15, width: 480 },
};

// Find FFmpeg
async function findFFmpeg() {
  const ffmpegStatic = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
  try {
    await fs.access(ffmpegStatic);
    return ffmpegStatic;
  } catch {
    return 'ffmpeg';
  }
}

// Get video metadata (duration, etc.)
async function getVideoMetadata(videoPath, ffmpegPath) {
  try {
    const { stdout } = await execFileAsync(ffmpegPath, [
      '-i', videoPath,
      '-f', 'null',
      '-'
    ], { encoding: 'utf8' }).catch(e => ({ stdout: '', stderr: e.stderr }));
    
    // Parse duration from ffmpeg output
    const durationMatch = (stdout || '').match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
    if (durationMatch) {
      const hours = parseInt(durationMatch[1]);
      const minutes = parseInt(durationMatch[2]);
      const seconds = parseInt(durationMatch[3]);
      return {
        duration: hours * 3600 + minutes * 60 + seconds,
      };
    }
    return { duration: 10 }; // Default
  } catch {
    return { duration: 10 };
  }
}

// Create optimized GIF from video
async function createGif(inputPath, outputPath, options, ffmpegPath) {
  const preset = QUALITY_PRESETS[options.quality] || QUALITY_PRESETS.medium;
  const { fps, width } = preset;
  const { startTime, duration } = options;
  
  console.log(`   → Converting to GIF (${width}px @ ${fps}fps)`);
  
  const paletteFile = outputPath.replace('.gif', '-palette.png');
  
  try {
    // Generate palette
    console.log('   📊 Generating palette...');
    await execFileAsync(ffmpegPath, [
      '-ss', startTime,
      '-t', duration.toString(),
      '-i', inputPath,
      '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen=stats_mode=diff`,
      '-y',
      paletteFile
    ]);
    
    // Create GIF
    console.log('   🎨 Creating GIF...');
    await execFileAsync(ffmpegPath, [
      '-ss', startTime,
      '-t', duration.toString(),
      '-i', inputPath,
      '-i', paletteFile,
      '-lavfi', `fps=${fps},scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5`,
      '-y',
      outputPath
    ]);
    
    // Clean up
    await fs.unlink(paletteFile).catch(() => {});
    
    const stats = await fs.stat(outputPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`   ✅ GIF created! (${sizeMB} MB)`);
    
    return true;
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    await fs.unlink(paletteFile).catch(() => {});
    return false;
  }
}

// Create thumbnail
async function createThumbnail(gifPath, ffmpegPath) {
  const thumbnailPath = gifPath.replace('.gif', '.jpg');
  
  try {
    await execFileAsync(ffmpegPath, [
      '-i', gifPath,
      '-vframes', '1',
      '-q:v', '2',
      '-y',
      thumbnailPath
    ]);
    
    console.log(`   🖼️  Thumbnail created`);
    return true;
  } catch (error) {
    console.error(`   ⚠️  Thumbnail failed: ${error.message}`);
    return false;
  }
}

// Generate showcase metadata
async function generateMetadata(showcaseItems, outputFolder) {
  const metadata = {
    version: '2.0',
    generated: new Date().toISOString(),
    count: showcaseItems.length,
    items: showcaseItems.map((item, index) => ({
      id: index + 1,
      name: item.name,
      description: item.description,
      gif: item.gif,
      thumbnail: item.thumbnail,
      video: item.video,
      duration: item.duration,
    })),
  };
  
  const metadataPath = path.join(outputFolder, 'showcase-metadata.json');
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
  console.log(`\n📋 Metadata saved: ${metadataPath}`);
  
  return metadata;
}

// Parse video filename to extract title
function parseVideoTitle(filename) {
  // Remove extension
  const name = filename.replace(/\.(mp4|mov|avi|mkv)$/i, '');
  
  // Convert underscores/hyphens to spaces
  let title = name.replace(/[-_]/g, ' ');
  
  // Remove timestamps and IDs
  title = title.replace(/\d{13,}/g, ''); // Remove long timestamps
  title = title.replace(/\b[a-f0-9]{6,}\b/gi, ''); // Remove hex IDs
  
  // Capitalize words
  title = title.split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  return title || 'Video Example';
}

// Main function
async function main() {
  console.log('🎬 Auto Showcase GIF Generator\n');
  console.log('=' .repeat(60));
  
  const sourceDir = path.join(process.cwd(), CONFIG.sourceFolder);
  const outputDir = path.join(process.cwd(), CONFIG.outputFolder);
  const frontendOutputDir = path.join(process.cwd(), CONFIG.frontendOutputFolder);
  
  // Find FFmpeg
  const ffmpegPath = await findFFmpeg();
  console.log(`📦 FFmpeg: ${ffmpegPath}`);
  
  // Create directories
  await fs.mkdir(sourceDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(frontendOutputDir, { recursive: true });
  console.log(`📁 Source: ${sourceDir}`);
  console.log(`📁 Output: ${outputDir}`);
  console.log(`📁 Frontend Output: ${frontendOutputDir}\n`);
  
  // Find all MP4 files in source folder
  const files = await fs.readdir(sourceDir);
  const videoFiles = files.filter(f => 
    /\.(mp4|mov|avi|mkv)$/i.test(f)
  );
  
  if (videoFiles.length === 0) {
    console.log('⚠️  No video files found in showcase-videos folder!');
    console.log('\n📝 Instructions:');
    console.log('   1. Add MP4 files to: public/assets/showcase-videos/');
    console.log('   2. Run this script again: node scripts/auto-generate-showcase.js');
    console.log('   3. GIFs will be created automatically!\n');
    return;
  }
  
  console.log(`📹 Found ${videoFiles.length} video(s):\n`);
  videoFiles.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));
  console.log('');
  
  // Process each video
  const showcaseItems = [];
  let successCount = 0;
  
  for (let i = 0; i < videoFiles.length; i++) {
    const videoFile = videoFiles[i];
    const videoPath = path.join(sourceDir, videoFile);
    const baseName = path.basename(videoFile, path.extname(videoFile));
    const gifPath = path.join(outputDir, `${baseName}.gif`);
    const thumbnailPath = path.join(outputDir, `${baseName}.jpg`);
    
    console.log(`\n[${i + 1}/${videoFiles.length}] Processing: ${videoFile}`);
    
    // Get video metadata
    const metadata = await getVideoMetadata(videoPath, ffmpegPath);
    
    // Create GIF
    const success = await createGif(
      videoPath,
      gifPath,
      {
        ...CONFIG.gif,
        duration: Math.min(CONFIG.gif.duration, metadata.duration),
      },
      ffmpegPath
    );
    
    if (success) {
      successCount++;
      
      // Create thumbnail
      await createThumbnail(gifPath, ffmpegPath);
      
      // Add to showcase items
      showcaseItems.push({
        name: parseVideoTitle(videoFile),
        description: `Example video showcasing our ${parseVideoTitle(videoFile).toLowerCase()}`,
        gif: `/assets/showcase/${baseName}.gif`,
        thumbnail: `/assets/showcase/${baseName}.jpg`,
        video: `/assets/showcase-videos/${videoFile}`,
        duration: metadata.duration,
      });
    }
  }
  
  // Generate metadata
  if (showcaseItems.length > 0) {
    await generateMetadata(showcaseItems, outputDir);
    
    // Copy to frontend/public for Vite to serve
    console.log('\n📦 Copying to frontend/public...');
    const { execSync } = require('child_process');
    try {
      if (process.platform === 'win32') {
        execSync(`xcopy /E /I /Y "${outputDir}" "${frontendOutputDir}"`, { stdio: 'ignore' });
      } else {
        execSync(`cp -r "${outputDir}" "${frontendOutputDir}"`, { stdio: 'ignore' });
      }
      console.log('✅ Copied to frontend/public/assets/showcase/');
    } catch (error) {
      console.log('⚠️  Manual copy needed: Run the following command');
      console.log(`   xcopy /E /I "${outputDir}" "${frontendOutputDir}"`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n✨ Complete! Created ${successCount}/${videoFiles.length} GIFs`);
  
  if (successCount > 0) {
    console.log('\n📝 Next steps:');
    console.log('   1. Check GIFs in: public/assets/showcase/');
    console.log('   2. View them in your app at http://localhost:5173');
    console.log('   3. Add more videos to showcase-videos/ and run again\n');
  }
}

// Run
main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});

