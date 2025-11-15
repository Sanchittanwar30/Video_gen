# PowerShell script to start ngrok tunnel for Colab API

param(
    [int]$Port = 3000
)

$ApiUrl = "http://localhost:$Port"

Write-Host "🚀 Starting ngrok tunnel for Colab API" -ForegroundColor Green
Write-Host "📡 Forwarding to: $ApiUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  Note: Free ngrok tunnels close after 2 hours" -ForegroundColor Yellow
Write-Host "💡 Visit http://127.0.0.1:4040 to see requests and keep tunnel alive" -ForegroundColor Cyan
Write-Host ""

# Check if ngrok is installed
try {
    $null = Get-Command ngrok -ErrorAction Stop
} catch {
    Write-Host "❌ ngrok not found. Please install it first:" -ForegroundColor Red
    Write-Host "   https://ngrok.com/download" -ForegroundColor Yellow
    Write-Host "   Or: choco install ngrok" -ForegroundColor Yellow
    exit 1
}

# Check if API server is running
try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/health" -Method GET -TimeoutSec 2 -ErrorAction Stop
} catch {
    Write-Host "⚠️  Warning: API server doesn't seem to be running on $ApiUrl" -ForegroundColor Yellow
    Write-Host "   Start it with: npm run start:api" -ForegroundColor Cyan
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
}

# Start ngrok
Write-Host "🔗 Starting ngrok tunnel..." -ForegroundColor Green
Write-Host ""
ngrok http $Port

