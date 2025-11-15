# Quick start commands for Colab setup
# Run these commands in order

Write-Host "=== Colab Setup Commands ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Configure ngrok (replace YOUR_TOKEN):" -ForegroundColor Yellow
Write-Host "   ngrok config add-authtoken YOUR_TOKEN" -ForegroundColor White
Write-Host ""

Write-Host "2. Start API server (Terminal 1):" -ForegroundColor Yellow
Write-Host "   npm run start:api" -ForegroundColor White
Write-Host ""

Write-Host "3. Start ngrok tunnel (Terminal 2):" -ForegroundColor Yellow
Write-Host "   ngrok http 3000" -ForegroundColor White
Write-Host ""

Write-Host "4. Test connection (Terminal 3):" -ForegroundColor Yellow
Write-Host "   python colab/test-ngrok-connection.py YOUR_NGROK_URL" -ForegroundColor White
Write-Host ""

Write-Host "5. In Colab notebook, set:" -ForegroundColor Yellow
Write-Host "   API_BASE_URL = 'YOUR_NGROK_URL'" -ForegroundColor White
Write-Host ""

Write-Host "See colab/NEXT_STEPS.md for detailed instructions" -ForegroundColor Green

