# PowerShell script to create a minimal Colab package

Write-Host "📦 Creating Colab package..." -ForegroundColor Green

# Required files and folders
$required = @(
    "src",
    "remotion",
    "server/services/remotion-ai-renderer.ts",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "remotion.config.ts"
)

# Check which files exist
$missing = @()
foreach ($item in $required) {
    if (-not (Test-Path $item)) {
        $missing += $item
    }
}

if ($missing.Count -gt 0) {
    Write-Host "⚠️  Missing files:" -ForegroundColor Yellow
    foreach ($item in $missing) {
        Write-Host "   - $item" -ForegroundColor Red
    }
}

# Create ZIP
$zipPath = "colab-project.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Compress-Archive -Path $required -DestinationPath $zipPath -Force

Write-Host "✅ Created colab-project.zip" -ForegroundColor Green
Write-Host "`n📤 Next steps:" -ForegroundColor Cyan
Write-Host "1. Upload colab-project.zip to Colab" -ForegroundColor White
Write-Host "2. Extract it in the notebook" -ForegroundColor White
Write-Host "3. Run npm install" -ForegroundColor White
