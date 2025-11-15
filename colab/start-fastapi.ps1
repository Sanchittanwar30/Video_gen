# PowerShell script to start FastAPI server for Colab

Write-Host "🚀 Starting FastAPI server for Colab API" -ForegroundColor Green
Write-Host ""

# Check if virtual environment exists
if (Test-Path "venv") {
    Write-Host "📦 Activating virtual environment..." -ForegroundColor Cyan
    & .\venv\Scripts\Activate.ps1
}

# Check if dependencies are installed
try {
    python -c "import fastapi" 2>$null
} catch {
    Write-Host "⚠️  FastAPI not found. Installing dependencies..." -ForegroundColor Yellow
    pip install -r colab/requirements-fastapi.txt
}

# Start server
Write-Host "🌐 Starting FastAPI server on http://localhost:3000" -ForegroundColor Green
Write-Host "📚 API docs: http://localhost:3000/docs" -ForegroundColor Cyan
Write-Host ""
uvicorn colab.fastapi_server:app --host 0.0.0.0 --port 3000 --reload

