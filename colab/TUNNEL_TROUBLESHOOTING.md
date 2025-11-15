# ngrok Tunnel Troubleshooting

## Quick Checks

### 1. Is ngrok Running?
```powershell
Get-Process -Name "ngrok"
```
If not running: `ngrok http 3000`

### 2. Is API Server Running?
```powershell
curl http://localhost:3000/health
```
If not running: `npm run start:api`

### 3. Is Tunnel Active?
Check ngrok terminal or: `curl http://localhost:4040/api/tunnels`

### 4. Test ngrok URL
```powershell
curl https://iesha-ordainable-cullen.ngrok-free.dev/health
```

## Common Issues

### Issue 1: ngrok Tunnel Closed
**Symptoms:** Connection refused, timeout
**Fix:** 
- Free ngrok tunnels close after 2 hours
- Restart: `ngrok http 3000`
- Update Colab with new URL

### Issue 2: API Server Not Running
**Symptoms:** Connection refused
**Fix:**
- Start server: `npm run start:api`
- Verify: `curl http://localhost:3000/health`

### Issue 3: ngrok URL Changed
**Symptoms:** Different URL in ngrok terminal
**Fix:**
- Check ngrok terminal for new URL
- Update Cell 16 in Colab with new URL

### Issue 4: ngrok Warning Page
**Symptoms:** HTML page instead of JSON
**Fix:**
- This is normal for free ngrok
- Colab will handle it automatically
- Or click "Visit Site" button

### Issue 5: CORS Issues
**Symptoms:** CORS errors in Colab
**Fix:**
- Check server has CORS enabled
- Verify ngrok URL is correct

## Testing Commands

```powershell
# Test local API
curl http://localhost:3000/health

# Test ngrok tunnel
curl https://iesha-ordainable-cullen.ngrok-free.dev/health

# Test Colab endpoint
curl https://iesha-ordainable-cullen.ngrok-free.dev/api/colab/jobs/pending

# Check ngrok status
curl http://localhost:4040/api/tunnels
```

## Quick Fix Script

```powershell
# Check everything at once
.\colab\check-tunnel.ps1
```

