# Colab Quick Start (5 Minutes)

Get Colab working in 5 minutes!

## 1. Install ngrok (2 min)

**Windows:**
```powershell
choco install ngrok
# Or download from https://ngrok.com/download
```

**Mac:**
```bash
brew install ngrok
```

**Linux:**
```bash
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar -xzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/
```

**Get auth token:**
1. Sign up: https://dashboard.ngrok.com/signup
2. Get token: https://dashboard.ngrok.com/get-started/your-authtoken
3. Configure: `ngrok config add-authtoken YOUR_TOKEN`

## 2. Start Services (1 min)

**Terminal 1 - API Server:**
```bash
npm run start:api
```

**Terminal 2 - ngrok:**
```bash
ngrok http 3000
```

**Copy the ngrok URL** (e.g., `https://abc123.ngrok-free.app`)

## 3. Open Colab (1 min)

1. Go to https://colab.research.google.com/
2. Upload `colab/Video_Rendering_Colab.ipynb`
3. Find the cell with `API_BASE_URL`
4. Change it to your ngrok URL:
   ```python
   API_BASE_URL = "https://abc123.ngrok-free.app"
   ```

## 4. Test (1 min)

**Create a test job:**
```bash
curl -X POST http://localhost:3000/api/colab/generate \
  -H "Content-Type: application/json" \
  -d '{"videoPlan":{"frames":[{"id":"test","type":"whiteboard_diagram","duration":5,"text":"Test","animate":false}]}}'
```

**In Colab:** Run all cells - it should process the job automatically!

**Check status:**
```bash
# Get jobId from the response above, then:
curl http://localhost:3000/api/colab/status/{jobId}
```

## Done! 🎉

Your Colab setup is ready. See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed instructions.

