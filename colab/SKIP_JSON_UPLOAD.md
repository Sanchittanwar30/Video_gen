# Skip JSON Upload - You're Using API Mode!

## ✅ Good News!

If you're using **API mode** (which you are!), you **DON'T need to upload a JSON file manually**.

## Why?

When using API mode:
1. **You create jobs** via API: `POST /api/colab/generate`
2. **Colab automatically fetches** jobs from: `GET /api/colab/jobs/pending`
3. **No manual upload needed!**

## What to Do

### Option 1: Skip the JSON Upload Cell (Recommended)

Just **skip that cell** and continue to the rendering cell. The rendering cell will automatically:
- Poll your API for pending jobs
- Download the video plan from your server
- Process it

### Option 2: Upload a Test JSON (Optional)

If you want to test with a local JSON file, you can upload one, but it's not required for API mode.

## How It Works

```
Your Local Server          Colab Notebook
     │                           │
     │ 1. Create job             │
     │ POST /api/colab/generate  │
     │──────────────────────────>│
     │                           │
     │ 2. Poll for jobs          │
     │ GET /jobs/pending         │
     │<──────────────────────────│
     │                           │
     │ 3. Get plan               │
     │ GET /plan/{jobId}         │
     │<──────────────────────────│
     │                           │
     │ 4. Process video          │
     │ (in Colab)                │
     │                           │
     │ 5. Callback               │
     │ POST /callback/{jobId}    │
     │<──────────────────────────│
```

## Quick Test

**In your local terminal:**
```powershell
# Create a test job
curl -X POST http://localhost:3000/api/colab/generate `
  -H "Content-Type: application/json" `
  -d '{\"videoPlan\":{\"frames\":[{\"id\":\"test\",\"type\":\"whiteboard_diagram\",\"duration\":5,\"text\":\"Test\",\"animate\":false}]}}'
```

**In Colab:** Just run the rendering cell - it will automatically pick up the job!

## Summary

- ✅ **Skip the JSON upload cell** - it's optional for API mode
- ✅ **Go straight to the rendering cell** - it handles everything
- ✅ **Create jobs via API** - that's how it works!

The notebook has been updated to detect API mode and skip the upload automatically.

