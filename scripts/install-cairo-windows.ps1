# Install Cairo Library for Windows (for CairoSVG)
# This script helps install GTK+ runtime which includes Cairo

Write-Host "Installing Cairo Library for Windows..." -ForegroundColor Cyan
Write-Host ""

# Check if GTK+ is already installed
$gtkPath = "$env:ProgramFiles\GTK3-Runtime"
if (Test-Path $gtkPath) {
    Write-Host "✅ GTK+ Runtime found at: $gtkPath" -ForegroundColor Green
    Write-Host "Cairo should be available. Testing..." -ForegroundColor Yellow
    
    # Add to PATH if not already there
    $env:Path = "$gtkPath\bin;$env:Path"
    
    python -c "import cairosvg; print('✅ CairoSVG working!')" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Cairo is working correctly!" -ForegroundColor Green
        exit 0
    }
}

Write-Host "GTK+ Runtime not found. Installation options:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Download GTK+ Runtime (Recommended)" -ForegroundColor Cyan
Write-Host "  1. Download GTK+ Runtime from: https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases"
Write-Host "  2. Run the installer"
Write-Host "  3. Restart your terminal"
Write-Host ""
Write-Host "Option 2: Use Chocolatey (if installed)" -ForegroundColor Cyan
Write-Host "  choco install gtk-runtime"
Write-Host ""
Write-Host "Option 3: Manual DLL download" -ForegroundColor Cyan
Write-Host "  Download cairo DLL from: https://www.gtk.org/download/windows.php"
Write-Host "  Place cairo.dll in a directory in your PATH"
Write-Host ""

# Try to open download page
$response = Read-Host "Would you like to open the GTK+ download page? (y/n)"
if ($response -eq 'y' -or $response -eq 'Y') {
    Start-Process "https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases"
}

Write-Host ""
Write-Host "Note: After installation, restart your terminal and run:" -ForegroundColor Yellow
Write-Host "  python -c 'import cairosvg; print(\"CairoSVG working!\")'" -ForegroundColor White

