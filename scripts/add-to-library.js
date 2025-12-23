/**
 * Helper script to add videos/images to the site-library
 * 
 * Usage:
 *   node scripts/add-to-library.js video <filename>
 *   node scripts/add-to-library.js image <filename>
 *   node scripts/add-to-library.js video all
 *   node scripts/add-to-library.js image all
 */

const fs = require('fs').promises;
const path = require('path');

async function copyVideo(filename) {
  const outputDir = path.join(process.cwd(), 'output');
  const libraryDir = path.join(process.cwd(), 'site-library', 'video');
  
  // Ensure library directory exists
  await fs.mkdir(libraryDir, { recursive: true });
  
  // Copy main video file
  const sourcePath = path.join(outputDir, filename);
  const destPath = path.join(libraryDir, filename);
  
  try {
    await fs.copyFile(sourcePath, destPath);
    console.log(`✓ Copied: ${filename}`);
    
    // Try to copy associated files
    const baseName = filename.replace('.mp4', '');
    const associatedFiles = [
      `${baseName}-metadata.json`,
      `${baseName}-transcript.txt`,
      `${baseName}-voiceover.mp3`,
      `${baseName}-thumbnail.jpg`,
    ];
    
    for (const file of associatedFiles) {
      try {
        const src = path.join(outputDir, file);
        const dst = path.join(libraryDir, file);
        await fs.copyFile(src, dst);
        console.log(`  ✓ Copied: ${file}`);
      } catch (error) {
        // File doesn't exist, that's okay
      }
    }
  } catch (error) {
    console.error(`✗ Error copying ${filename}:`, error.message);
  }
}

async function copyImage(filename) {
  // Check multiple possible source locations
  const possibleSources = [
    path.join(process.cwd(), 'public', 'assets', 'gemini-images', filename),
    path.join(process.cwd(), 'public', 'assets', filename),
  ];
  
  const libraryDir = path.join(process.cwd(), 'site-library', 'image');
  
  // Ensure library directory exists
  await fs.mkdir(libraryDir, { recursive: true });
  
  let copied = false;
  for (const sourcePath of possibleSources) {
    try {
      const destPath = path.join(libraryDir, filename);
      await fs.copyFile(sourcePath, destPath);
      console.log(`✓ Copied: ${filename}`);
      copied = true;
      break;
    } catch (error) {
      // Try next source
    }
  }
  
  if (!copied) {
    console.error(`✗ Error: Could not find ${filename}`);
  }
}

async function copyAllVideos() {
  const outputDir = path.join(process.cwd(), 'output');
  const files = await fs.readdir(outputDir);
  const videoFiles = files.filter(f => f.endsWith('.mp4'));
  
  console.log(`Found ${videoFiles.length} videos. Copying...`);
  
  for (const file of videoFiles) {
    await copyVideo(file);
  }
  
  console.log(`\n✓ Copied ${videoFiles.length} videos to site-library/video/`);
}

async function copyAllImages() {
  const geminiDir = path.join(process.cwd(), 'public', 'assets', 'gemini-images');
  
  try {
    const files = await fs.readdir(geminiDir);
    const imageFiles = files.filter(f => 
      f.endsWith('.jpg') || f.endsWith('.jpeg') || 
      f.endsWith('.png') || f.endsWith('.webp')
    );
    
    console.log(`Found ${imageFiles.length} images. Copying...`);
    
    for (const file of imageFiles) {
      await copyImage(file);
    }
    
    console.log(`\n✓ Copied ${imageFiles.length} images to site-library/image/`);
  } catch (error) {
    console.error('Error reading images directory:', error.message);
  }
}

async function main() {
  const [,, type, filename] = process.argv;
  
  if (!type || !['video', 'image'].includes(type)) {
    console.log('Usage:');
    console.log('  node scripts/add-to-library.js video <filename.mp4>');
    console.log('  node scripts/add-to-library.js image <filename.jpg>');
    console.log('  node scripts/add-to-library.js video all');
    console.log('  node scripts/add-to-library.js image all');
    return;
  }
  
  if (!filename) {
    console.error('Error: Please specify a filename or "all"');
    return;
  }
  
  if (type === 'video') {
    if (filename === 'all') {
      await copyAllVideos();
    } else {
      await copyVideo(filename);
    }
  } else if (type === 'image') {
    if (filename === 'all') {
      await copyAllImages();
    } else {
      await copyImage(filename);
    }
  }
}

main().catch(console.error);

