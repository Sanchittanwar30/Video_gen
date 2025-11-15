# Colab Setup Checklist

Follow this checklist to set up Colab step by step.

## Prerequisites

- [ ] Node.js installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] Project dependencies installed (`npm install`)
- [ ] Google account (for Colab)

## Step 1: Install ngrok

- [ ] **Windows:** `choco install ngrok` OR download from https://ngrok.com/download
- [ ] **Mac:** `brew install ngrok`
- [ ] **Linux:** Download and extract ngrok binary
- [ ] Verify installation: `ngrok version`

## Step 2: Configure ngrok

- [ ] Sign up at https://dashboard.ngrok.com/signup
- [ ] Get auth token from https://dashboard.ngrok.com/get-started/your-authtoken
- [ ] Run: `ngrok config add-authtoken YOUR_TOKEN`
- [ ] Verify: `ngrok config check`

## Step 3: Start API Server

- [ ] Open Terminal 1
- [ ] Navigate to project: `cd C:\Users\Dell\Video_gen`
- [ ] Start server: `npm run start:api`
- [ ] Verify: See "🚀 Video Generation API server running on port 3000"
- [ ] Test: Open http://localhost:3000/health in browser

## Step 4: Start ngrok Tunnel

- [ ] Open Terminal 2 (keep Terminal 1 running)
- [ ] Run: `ngrok http 3000`
- [ ] Copy the Forwarding URL (e.g., `https://abc123.ngrok-free.app`)
- [ ] Keep this terminal open!

## Step 5: Test Connection

- [ ] Open Terminal 3 (or use Terminal 2)
- [ ] Run: `python colab/test-ngrok-connection.py YOUR_NGROK_URL`
- [ ] Verify: See "✅ All tests passed!"

## Step 6: Set Up Colab Notebook

- [ ] Go to https://colab.research.google.com/
- [ ] Sign in with Google account
- [ ] Upload `colab/Video_Rendering_Colab.ipynb`
- [ ] Find cell with `API_BASE_URL = "http://localhost:3000"`
- [ ] Change to: `API_BASE_URL = "YOUR_NGROK_URL"`

## Step 7: Run Colab Setup

- [ ] Run cell: "Install Dependencies" (Node.js, FFmpeg, Chromium)
- [ ] Run cell: "Upload Project Files" (upload project ZIP or use git clone)
- [ ] Run cell: "Install Project Dependencies" (`npm install`)
- [ ] Run cell: "Configure Environment" (sets environment variables)
- [ ] Verify: No errors in output

## Step 8: Test Complete Flow

- [ ] Create test job:
  ```bash
  curl -X POST http://localhost:3000/api/colab/generate \
    -H "Content-Type: application/json" \
    -d '{"videoPlan":{"frames":[{"id":"test","type":"whiteboard_diagram","duration":5,"text":"Test","animate":false}]}}'
  ```
- [ ] Copy the `jobId` from response
- [ ] In Colab: Run "Render Video" cell
- [ ] Verify: Colab picks up the job and processes it
- [ ] Check status:
  ```bash
  curl http://localhost:3000/api/colab/status/{jobId}
  ```
- [ ] Verify: Status changes to "completed"

## ✅ Setup Complete!

Your Colab integration is ready. You can now:
- Create jobs via API
- Colab automatically processes them
- Download completed videos

## Troubleshooting

If something doesn't work:

- [ ] Check API server is running (Terminal 1)
- [ ] Check ngrok is running (Terminal 2)
- [ ] Verify ngrok URL matches Colab `API_BASE_URL`
- [ ] Test connection: `python colab/test-ngrok-connection.py YOUR_URL`
- [ ] Check Colab logs for errors
- [ ] See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed troubleshooting

## Next Steps

- [ ] Read [API_USAGE.md](./API_USAGE.md) for API documentation
- [ ] Read [ngrok-setup.md](./ngrok-setup.md) for ngrok details
- [ ] Create real video jobs with your video plans

