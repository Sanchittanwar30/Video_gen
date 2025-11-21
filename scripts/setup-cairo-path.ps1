# Setup Cairo PATH - Run this if GTK is installed but not in PATH
Write-Host "Cairo PATH Setup" -ForegroundColor Cyan
Write-Host ""

# Ask user for GTK path
Write-Host "If GTK is installed, please provide the path to the 'bin' folder." -ForegroundColor Yellow
Write-Host "Common locations:" -ForegroundColor Yellow
Write-Host "  C:\Program Files\GTK3-Runtime\bin" -ForegroundColor White
Write-Host "  C:\GTK3-Runtime\bin" -ForegroundColor White
Write-Host "  $env:LOCALAPPDATA\GTK3-Runtime\bin" -ForegroundColor White
Write-Host ""

$gtkBinPath = Read-Host "Enter GTK bin path (or press Enter to skip)"

if ($gtkBinPath -and (Test-Path $gtkBinPath)) {
    $cairoDll = Join-Path $gtkBinPath "cairo-2.dll"
    if (Test-Path $cairoDll) {
        Write-Host "✅ Found Cairo DLL!" -ForegroundColor Green
        
        # Add to current session
        $env:Path = "$gtkBinPath;$env:Path"
        Write-Host "✅ Added to PATH for this session" -ForegroundColor Green
        
        # Test
        Write-Host "`nTesting CairoSVG..." -ForegroundColor Yellow
        python -c "import cairosvg; print('✅ CairoSVG working!')" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n✅ SUCCESS! To make permanent, add to system PATH:" -ForegroundColor Green
            Write-Host "  $gtkBinPath" -ForegroundColor White
        }
    } else {
        Write-Host "❌ Cairo DLL not found at: $cairoDll" -ForegroundColor Red
    }
} else {
    Write-Host "`n⚠️  GTK path not provided or invalid." -ForegroundColor Yellow
    Write-Host "The script will work without Cairo using fallback rendering." -ForegroundColor Yellow
    Write-Host "For best quality, install GTK+ Runtime from:" -ForegroundColor Cyan
    Write-Host "  https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases" -ForegroundColor White
}

