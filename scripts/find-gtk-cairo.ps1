# Find GTK installation and configure Cairo
Write-Host "Searching for GTK installation..." -ForegroundColor Cyan

$gtkPaths = @(
    "$env:ProgramFiles\GTK3-Runtime",
    "$env:ProgramFiles\GTK",
    "$env:LOCALAPPDATA\GTK3-Runtime",
    "C:\GTK3-Runtime",
    "C:\Program Files (x86)\GTK3-Runtime"
)

$found = $false
foreach ($gtkPath in $gtkPaths) {
    if (Test-Path $gtkPath) {
        $binPath = Join-Path $gtkPath "bin"
        if (Test-Path $binPath) {
            $cairoDll = Join-Path $binPath "cairo-2.dll"
            if (Test-Path $cairoDll) {
                Write-Host "✅ Found GTK at: $gtkPath" -ForegroundColor Green
                Write-Host "✅ Cairo DLL found at: $cairoDll" -ForegroundColor Green
                
                # Add to current session PATH
                $env:Path = "$binPath;$env:Path"
                Write-Host "✅ Added to PATH for this session: $binPath" -ForegroundColor Green
                
                # Test CairoSVG
                Write-Host "`nTesting CairoSVG..." -ForegroundColor Yellow
                python -c "import cairosvg; print('✅ CairoSVG working!')" 2>&1
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "`n✅ SUCCESS! Cairo is working!" -ForegroundColor Green
                    Write-Host "`nTo make this permanent, add to your system PATH:" -ForegroundColor Yellow
                    Write-Host "  $binPath" -ForegroundColor White
                    $found = $true
                    break
                }
            }
        }
    }
}

if (-not $found) {
    Write-Host "`n❌ GTK/Cairo not found in common locations." -ForegroundColor Red
    Write-Host "`nPlease provide the path to your GTK installation, or:" -ForegroundColor Yellow
    Write-Host "1. Download GTK+ Runtime from:" -ForegroundColor Cyan
    Write-Host "   https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases" -ForegroundColor White
    Write-Host "2. Install it" -ForegroundColor Cyan
    Write-Host "3. Run this script again" -ForegroundColor Cyan
}

