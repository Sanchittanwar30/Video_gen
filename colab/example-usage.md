# Colab Usage Examples

## Example 1: Manual Rendering (Recommended for First Time)

### Step 1: Prepare Your Video Plan

Create a JSON file with your video plan:

```json
{
  "frames": [
    {
      "id": "frame-1",
      "type": "whiteboard_diagram",
      "duration": 18,
      "text": "Introduction to Machine Learning",
      "animate": true,
      "vectorized": {
        "svgUrl": "/assets/vectorized/ml-intro.svg"
      },
      "voiceoverUrl": "/assets/voiceovers/frame-1.mp3"
    },
    {
      "id": "frame-2",
      "type": "whiteboard_diagram",
      "duration": 20,
      "text": "Neural Networks Explained",
      "animate": true,
      "vectorized": {
        "svgUrl": "/assets/vectorized/neural-networks.svg"
      },
      "voiceoverUrl": "/assets/voiceovers/frame-2.mp3"
    }
  ]
}
```

### Step 2: Prepare Project Package

```bash
# Create a minimal package for Colab
python colab/upload_to_colab.py

# This creates colab-package/ directory
# Zip it for easy upload
zip -r colab-package.zip colab-package/
```

### Step 3: Upload to Colab

1. Open https://colab.research.google.com/
2. Upload `colab/Video_Rendering_Colab.ipynb`
3. Upload `colab-package.zip`
4. Upload your video plan JSON file
5. Upload any assets (SVG files, audio files) referenced in your plan

### Step 4: Run the Notebook

Execute cells in order:
- Install dependencies
- Extract project files
- Install npm packages
- Configure environment
- Render video
- Download output

## Example 2: Using Git Clone

If your project is in a Git repository:

```python
# In Colab notebook
!git clone https://github.com/yourusername/video-gen.git /content/video-gen
!cd /content/video-gen && npm install
```

Then proceed with uploading your video plan and rendering.

## Example 3: Batch Rendering Multiple Videos

```python
# In Colab notebook
import json
import glob

# Upload multiple video plan JSON files
uploaded = files.upload()

# Render each one
for filename in uploaded.keys():
    if filename.endswith('.json'):
        print(f"Rendering {filename}...")
        
        # Create render script for this file
        render_script = f'''
        import {{ renderStoryboardVideo }} from './server/services/remotion-ai-renderer';
        import {{ readFileSync }} from 'fs';
        import {{ join }} from 'path';
        
        async function render() {{
          const plan = JSON.parse(readFileSync('{filename}', 'utf-8'));
          const output = await renderStoryboardVideo(plan);
          console.log('Output:', output);
        }}
        
        render();
        '''
        
        with open('render-temp.ts', 'w') as f:
            f.write(render_script)
        
        !npx ts-node render-temp.ts
        
        # Download the output
        output_files = glob.glob('output/*.mp4')
        if output_files:
            latest = max(output_files, key=os.path.getctime)
            files.download(latest)
```

## Example 4: Using Colab Service (TypeScript/Node.js)

If you want to integrate Colab rendering into your Node.js application:

```typescript
import { renderVideoOnColab, checkColabJobStatus, downloadColabVideo } from './colab/colab-service';
import { config } from './server/config';

// Create a video plan
const videoPlan: AIVideoData = {
  frames: [
    // ... your frames
  ]
};

// Start Colab render job
const job = await renderVideoOnColab(videoPlan, config.colab);

// Poll for completion
let status = job;
while (status.status === 'pending' || status.status === 'processing') {
  await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
  status = await checkColabJobStatus(job.jobId, config.colab);
  console.log(`Status: ${status.status}`);
}

// Download when complete
if (status.status === 'completed' && status.outputUrl) {
  const outputPath = `./output/colab-${job.jobId}.mp4`;
  await downloadColabVideo(job.jobId, outputPath, config.colab);
  console.log(`Video downloaded to ${outputPath}`);
}
```

## Tips for Best Performance

1. **Enable GPU**: Runtime → Change runtime type → GPU (T4)
2. **Optimize assets**: Compress images and audio before uploading
3. **Use lower resolution**: For faster rendering, use 1280x720 instead of 1920x1080
4. **Monitor resources**: Check Colab's resource usage in the sidebar
5. **Save frequently**: Download outputs immediately to avoid losing them

## Troubleshooting

### "Chromium not found"
```python
!apt-get install -y chromium-browser
os.environ['REMOTION_BROWSER_EXECUTABLE'] = '/usr/bin/chromium-browser'
```

### "Out of memory"
- Reduce video resolution
- Render shorter videos
- Clear Colab storage: `!rm -rf /tmp/*`

### "FFmpeg errors"
```python
!apt-get update && apt-get install -y ffmpeg
!which ffmpeg
```

### Slow rendering
- Enable GPU acceleration
- Use lower quality (CRF 28)
- Reduce frame rate (24fps)

