# Pen Sketch Animation - Setup Checklist

Use this checklist to ensure everything is set up correctly.

## Prerequisites

- [ ] Node.js 20+ installed
- [ ] Python 3.8+ installed
- [ ] Google account (for Colab)
- [ ] ngrok account (free tier)
- [ ] Gemini API key
- [ ] Deepgram API key

## Step 1: Local Setup

- [ ] Node.js dependencies installed (`npm install`)
- [ ] `form-data` package installed
- [ ] `.env` file created with required variables
- [ ] Backend starts without errors (`npm run dev:api`)

## Step 2: ngrok Setup

- [ ] ngrok installed
- [ ] ngrok auth token obtained
- [ ] ngrok configured (`ngrok config add-authtoken`)
- [ ] Local ngrok tunnel tested (`ngrok http 3000`)

## Step 3: Colab Setup

- [ ] Google Colab account ready
- [ ] New notebook created
- [ ] Files uploaded to Colab:
  - [ ] `pen_sketch_animation.py`
  - [ ] `fastapi_pen_sketch.py`
  - [ ] `requirements-pen-sketch.txt`
- [ ] Dependencies installed in Colab
- [ ] ngrok configured in Colab
- [ ] FastAPI server started in Colab
- [ ] Colab ngrok URL copied

## Step 4: Configuration

- [ ] `.env` file updated with `COLAB_FASTAPI_URL`
- [ ] Backend restarted after `.env` update
- [ ] Connection to Colab tested

## Step 5: Test Images

- [ ] Test images generated (using main video generation)
- [ ] Images visible in `public/assets/gemini-images/`
- [ ] Images accessible via `/assets/gemini-images/` URL

## Step 6: Testing

- [ ] Frontend accessible (http://localhost:5173)
- [ ] Test UI shows available images
- [ ] Can select images
- [ ] Animation job created successfully
- [ ] Job status updates correctly
- [ ] Video generated and downloadable
- [ ] Video plays correctly

## Step 7: Verification

- [ ] All services running:
  - [ ] Node.js backend (port 3000)
  - [ ] Colab FastAPI (port 8000)
  - [ ] Local ngrok tunnel
  - [ ] Colab ngrok tunnel
- [ ] Health checks pass:
  - [ ] `http://localhost:3000/health`
  - [ ] `https://your-colab-url.ngrok-free.app/health`
- [ ] Test animation completes successfully

## Troubleshooting Checklist

If something doesn't work:

- [ ] Check all terminal windows are open
- [ ] Verify ngrok tunnels are active
- [ ] Check Colab cell is still running
- [ ] Verify `.env` file has correct URLs
- [ ] Check API keys are valid
- [ ] Review error messages in console
- [ ] Check Colab runtime hasn't disconnected

## ✅ Setup Complete!

Once all items are checked, your pen-sketch animation system is ready to use!
