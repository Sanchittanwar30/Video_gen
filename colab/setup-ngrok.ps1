# PowerShell script to set up ngrok with auth token

param(
    [Parameter(Mandatory=$true)]
    [string]$AuthToken
)

Write-Host "🔧 Configuring ngrok with your auth token..." -ForegroundColor Green

# Configure ngrok
ngrok config add-authtoken $AuthToken

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ ngrok configured successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Start your API server: npm run start:api" -ForegroundColor Yellow
    Write-Host "2. In a new terminal, start ngrok: ngrok http 3000" -ForegroundColor Yellow
    Write-Host "3. Copy the Forwarding URL from ngrok output" -ForegroundColor Yellow
    Write-Host "4. Use that URL in your Colab notebook" -ForegroundColor Yellow
} else {
    Write-Host "❌ Failed to configure ngrok. Please check your auth token." -ForegroundColor Red
    exit 1
}

