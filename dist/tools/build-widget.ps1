# Packs ../widget into dist/Binxbar-<version>.icuewidget (an .icuewidget is just a zip of the widget folder).
$root = Split-Path -Parent $PSScriptRoot
$ver = (Get-Content "$root\widget\manifest.json" -Raw | ConvertFrom-Json).version
$zip = "$root\dist\Binxbar-$ver.zip"; $out = "$root\dist\Binxbar-$ver.icuewidget"
New-Item -ItemType Directory -Force "$root\dist" | Out-Null
Remove-Item $zip, $out -ErrorAction SilentlyContinue
Compress-Archive -Path "$root\widget\*" -DestinationPath $zip
Rename-Item $zip $out
Write-Host "Built $out"
