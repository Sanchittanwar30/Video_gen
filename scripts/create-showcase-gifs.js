#!/usr/bin/env node
/**
 * Create optimized GIFs from videos for UI showcase
 * Usage: node scripts/create-showcase-gifs.js
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execFileAsync = promisify(execFile);

// Configuration
const CONFIG = {
  // Videos to convert (relative to project root)
  videos: [
    {
      input: 'output/ai-storyboard-1763711478607.mp4',
      output: 'public/assets/showcase/ai-storyboard-demo.gif',
      name: 'AI Storyboard',
      description: 'Generate animated educational videos from any topic',
      startTime: '00:00:00', // Start time (HH:MM:SS)
      duration: 10, // Duration in seconds
      fps: 15, // Frames per second (lower = smaller file)
      width: 640, // Width in pixels (maintains aspect ratio)
    },
    {
      input: 'output/pen-sketch/pen-sketch-pen-sketch-1763706322904-2fffef.mp4',
      output: 'public/assets/showcase/pen-sketch-demo.gif',
      name: 'Pen Sketch Animation',
      description: 'Transform images into hand-drawn whiteboard animations',
      startTime: '00:00:00',
      duration: 8,
      fps: 20,
      width: 640,
    },
  ],
  // Output directory for showcase GIFs
  outputDir: 'public/assets/showcase',
};

// Find FFmpeg
async function findFFmpeg() {
  const ffmpegStatic = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
  try {
    await fs.access(ffmpegStatic);
    return ffmpegStatic;
  } catch {
    return 'ffmpeg'; // Use system ffmpeg
  }
}

// Create optimized GIF from video
async function createGif(config, ffmpegPath) {
  const { input, output, startTime, duration, fps, width } = config;
  
  // Check if input exists
  const inputPath = path.join(process.cwd(), input);
  try {
    await fs.access(inputPath);
  } catch {
    console.error(`❌ Input file not found: ${inputPath}`);
    return false;
  }
  
  console.log(`\n🎬 Converting: ${input}`);
  console.log(`   → Output: ${output}`);
  console.log(`   → Duration: ${duration}s at ${fps}fps, width: ${width}px`);
  
  const outputPath = path.join(process.cwd(), output);
  
  // Ensure output directory exists
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  
  // Two-pass approach for high-quality GIF:
  // 1. Generate palette from video
  // 2. Use palette to create GIF
  
  const paletteFile = outputPath.replace('.gif', '-palette.png');
  
  try {
    // Step 1: Generate palette
    console.log('   📊 Generating color palette...');
    await execFileAsync(ffmpegPath, [
      '-ss', startTime,
      '-t', duration.toString(),
      '-i', inputPath,
      '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen=stats_mode=diff`,
      '-y',
      paletteFile
    ]);
    
    // Step 2: Create GIF using palette
    console.log('   🎨 Creating optimized GIF...');
    await execFileAsync(ffmpegPath, [
      '-ss', startTime,
      '-t', duration.toString(),
      '-i', inputPath,
      '-i', paletteFile,
      '-lavfi', `fps=${fps},scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5`,
      '-y',
      outputPath
    ]);
    
    // Clean up palette file
    await fs.unlink(paletteFile).catch(() => {});
    
    // Get file size
    const stats = await fs.stat(outputPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log(`   ✅ GIF created! Size: ${sizeMB} MB`);
    return true;
  } catch (error) {
    console.error(`   ❌ Failed to create GIF: ${error.message}`);
    // Clean up palette file on error
    await fs.unlink(paletteFile).catch(() => {});
    return false;
  }
}

// Generate metadata JSON for showcase
async function generateMetadata(configs) {
  const metadata = {
    version: '1.0',
    generated: new Date().toISOString(),
    showcases: configs.map(config => ({
      name: config.name,
      description: config.description,
      gif: config.output.replace('public', ''),
      thumbnail: config.output.replace('public', '').replace('.gif', '.jpg'),
      duration: config.duration,
      fps: config.fps,
    })),
  };
  
  const metadataPath = path.join(process.cwd(), CONFIG.outputDir, 'showcase-metadata.json');
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
  console.log(`\n📋 Metadata saved: ${metadataPath}`);
}

// Create thumbnail from GIF
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
    
    console.log(`   🖼️  Thumbnail: ${path.basename(thumbnailPath)}`);
    return true;
  } catch (error) {
    console.error(`   ⚠️  Failed to create thumbnail: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  console.log('🎬 Video to GIF Converter for UI Showcase\n');
  console.log('=' .repeat(50));
  
  // Find FFmpeg
  const ffmpegPath = await findFFmpeg();
  console.log(`📦 Using FFmpeg: ${ffmpegPath}\n`);
  
  // Create showcase directory
  const showcaseDir = path.join(process.cwd(), CONFIG.outputDir);
  await fs.mkdir(showcaseDir, { recursive: true });
  console.log(`📁 Output directory: ${showcaseDir}\n`);
  
  // Convert videos to GIFs
  let successCount = 0;
  for (const config of CONFIG.videos) {
    const success = await createGif(config, ffmpegPath);
    if (success) {
      successCount++;
      // Create thumbnail
      const gifPath = path.join(process.cwd(), config.output);
      await createThumbnail(gifPath, ffmpegPath);
    }
  }
  
  // Generate metadata
  await generateMetadata(CONFIG.videos);
  
  console.log('\n' + '='.repeat(50));
  console.log(`\n✨ Done! Created ${successCount}/${CONFIG.videos.length} GIFs\n`);
  console.log('📝 Next steps:');
  console.log('   1. Check the GIFs in: public/assets/showcase/');
  console.log('   2. Add them to your UI using the ShowcaseGallery component');
  console.log('   3. Customize timing/quality in this script if needed\n');
}

// Run
main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});

