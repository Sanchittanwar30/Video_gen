# Using ngrok with Colab API

ngrok is perfect for exposing your local API server to Google Colab. Here's how to set it up.

## Quick Setup

### 1. Install ngrok

**Windows:**
- Download from https://ngrok.com/download
- Or use Chocolatey: `choco install ngrok`

**Mac:**
```bash
brew install ngrok
```

**Linux:**
```bash
# Download and unzip
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar -xzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/
```

### 2. Get ngrok Auth Token (Free)

1. Sign up at https://dashboard.ngrok.com/signup (free)
2. Get your auth token from https://dashboard.ngrok.com/get-started/your-authtoken
3. Configure ngrok:
```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### 3. Start Your API Server

```bash
npm run start:api
# Server runs on http://localhost:3000
```

### 4. Start ngrok Tunnel

In a **new terminal**:
```bash
ngrok http 3000
```

You'll see output like:
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:3000
```

**Copy the HTTPS URL** (e.g., `https://abc123.ngrok-free.app`)

### 5. Update Colab Notebook

In your Colab notebook, set:
```python
API_BASE_URL = "https://abc123.ngrok-free.app"  # Your ngrok URL
```

## Automated Setup Script

I've created a helper script to make this easier - see `colab/start-ngrok.sh` or `colab/start-ngrok.ps1`

## Workflow

```
1. Start API server (localhost:3000)
   ↓
2. Start ngrok tunnel
   ↓
3. Get ngrok URL (e.g., https://abc123.ngrok-free.app)
   ↓
4. Set API_BASE_URL in Colab notebook
   ↓
5. Colab can now access your API!
```

## Important Notes

### Free ngrok Limitations:
- **Session timeout**: Free tunnels close after 2 hours of inactivity
- **Random URLs**: Each restart gets a new URL (use ngrok config file for static domains on paid plans)
- **Request limits**: 40 requests/minute on free tier (usually enough)

### Keeping Tunnel Alive:
```bash
# Option 1: Use ngrok's web interface
# Visit http://127.0.0.1:4040 to see requests and keep tunnel active

# Option 2: Auto-restart script (see start-ngrok.sh)
```

### Security:
- ngrok URLs are public - anyone with the URL can access your API
- For production, use:
  - ngrok paid plan with static domains
  - Authentication on your API
  - Or deploy to a cloud service (Heroku, Railway, etc.)

## Alternative: Cloud Deployment

Instead of ngrok, you can deploy your API to:
- **Heroku** (free tier available)
- **Railway** (free tier available)
- **Render** (free tier available)
- **Fly.io** (free tier available)

Then use your deployed URL directly in Colab.

## Troubleshooting

### "ngrok: command not found"
- Make sure ngrok is in your PATH
- Or use full path: `/path/to/ngrok http 3000`

### "Tunnel closed"
- Free ngrok tunnels close after 2 hours
- Restart ngrok and update Colab with new URL

### "Connection refused"
- Make sure your API server is running on port 3000
- Check ngrok is forwarding to correct port

### "Too many requests"
- You've hit ngrok's free tier limit (40 req/min)
- Wait a minute or upgrade to paid plan

## Example: Complete Workflow

```bash
# Terminal 1: Start API
npm run start:api

# Terminal 2: Start ngrok
ngrok http 3000

# Copy the Forwarding URL (e.g., https://abc123.ngrok-free.app)

# In Colab notebook:
API_BASE_URL = "https://abc123.ngrok-free.app"

# Now Colab can access your API!
```

