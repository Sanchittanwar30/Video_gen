# Quick tunnel health check script

Write-Host "=== ngrok Tunnel Health Check ===" -ForegroundColor Cyan
Write-Host ""

# Check 1: ngrok process
Write-Host "1. Checking ngrok process..." -ForegroundColor Yellow
$ngrok = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue
if ($ngrok) {
    Write-Host "   ✅ ngrok is running" -ForegroundColor Green
} else {
    Write-Host "   ❌ ngrok is NOT running" -ForegroundColor Red
    Write-Host "   Fix: ngrok http 3000" -ForegroundColor Yellow
    exit 1
}

# Check 2: Local API
Write-Host "`n2. Checking local API server..." -ForegroundColor Yellow
try {
    $health = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "   ✅ Local API is running" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Local API is NOT running" -ForegroundColor Red
    Write-Host "   Fix: npm run start:api" -ForegroundColor Yellow
    exit 1
}

# Check 3: ngrok tunnel
Write-Host "`n3. Checking ngrok tunnel..." -ForegroundColor Yellow
try {
    $tunnels = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction Stop
    if ($tunnels.tunnels) {
        $tunnel = $tunnels.tunnels[0]
        $publicUrl = $tunnel.public_url
        Write-Host "   ✅ Tunnel active: $publicUrl" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  No active tunnels" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "   ⚠️  Could not check tunnel status" -ForegroundColor Yellow
    $publicUrl = "https://iesha-ordainable-cullen.ngrok-free.dev"  # Default
}

# Check 4: Test public URL
Write-Host "`n4. Testing public URL..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$publicUrl/health" -TimeoutSec 10 -ErrorAction Stop
    Write-Host "   ✅ Public URL is accessible!" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Public URL failed!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`n   Possible fixes:" -ForegroundColor Yellow
    Write-Host "   - Restart ngrok: ngrok http 3000" -ForegroundColor White
    Write-Host "   - Check API server is running" -ForegroundColor White
    Write-Host "   - Verify ngrok URL in Colab matches: $publicUrl" -ForegroundColor White
    exit 1
}

# Check 5: Test Colab endpoint
Write-Host "`n5. Testing Colab endpoint..." -ForegroundColor Yellow
try {
    $pending = Invoke-RestMethod -Uri "$publicUrl/api/colab/jobs/pending" -TimeoutSec 10 -ErrorAction Stop
    Write-Host "   ✅ Colab endpoint works!" -ForegroundColor Green
    Write-Host "   Pending jobs: $($pending.jobs.Count)" -ForegroundColor White
} catch {
    Write-Host "   ⚠️  Colab endpoint issue: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n✅ All checks passed!" -ForegroundColor Green
Write-Host "`nYour ngrok URL for Colab: $publicUrl" -ForegroundColor Cyan

