# Dev loop: copy ../widget over the installed copy and bump build.txt so the tile reloads itself (~20 s).
# (Re-importing an .icuewidget in iCUE does NOT update an already-installed widget.)
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $env:APPDATA 'Corsair\CUE5\html_widgets\com\personal\binxbar'
if (-not (Test-Path $dest)) { Write-Error "Not installed yet: import dist\*.icuewidget in iCUE first."; exit 1 }
Copy-Item "$root\widget\*" $dest -Recurse -Force -Exclude 'build.txt'
Set-Content (Join-Path $dest 'resources\build.txt') ([DateTime]::Now.Ticks)
Write-Host "Updated $dest - the tile reloads within ~20 seconds."
