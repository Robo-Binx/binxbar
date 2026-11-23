# Binxbar: turn a Google Contacts export into the contact list for the PHONE app.
#
# 1. On a computer: contacts.google.com > Export > Contacts > "Google CSV" > Export. You get contacts.csv.
# 2. Right-click this file > Run with PowerShell, and pick that contacts.csv when asked
#    (or run:  powershell -ExecutionPolicy Bypass -File import-contacts.ps1 -Csv C:\path\contacts.csv).
#
# It writes resources\contacts.json inside the installed Binxbar widget folder on THIS PC.
# Only names, phone numbers, number labels (mobile/home/work) and the starred flag are kept.
# Nothing is uploaded anywhere; the file stays on your PC and only the Binxbar widget reads it.
# Run it again any time you want to pick up new contacts.
param([string]$Csv = '',
      [string]$WidgetFolder = (Join-Path $env:APPDATA 'Corsair\CUE5\html_widgets\com\personal\binxbar'))

if (-not $Csv) {
  Add-Type -AssemblyName System.Windows.Forms
  $dlg = New-Object System.Windows.Forms.OpenFileDialog
  $dlg.Title = 'Pick the contacts.csv you exported from Google Contacts'
  $dlg.Filter = 'Google Contacts export (*.csv)|*.csv'
  if ($dlg.ShowDialog() -ne 'OK') { exit }
  $Csv = $dlg.FileName }
if (-not (Test-Path -LiteralPath $Csv)) { Write-Host "Can't find $Csv"; exit 1 }
$res = Join-Path $WidgetFolder 'resources'
if (-not (Test-Path -LiteralPath $res)) { Write-Host "Binxbar isn't installed at $WidgetFolder (install the widget in iCUE first)."; exit 1 }

$out = New-Object System.Collections.Generic.List[object]
foreach ($r in (Import-Csv -LiteralPath $Csv -Encoding UTF8)) {
  $name = (@($r.'First Name', $r.'Middle Name', $r.'Last Name') | Where-Object { $_ }) -join ' '
  if (-not $name) { $name = $r.'Nickname' }
  if (-not $name) { $name = $r.'Organization Name' }
  if (-not $name) { continue }
  $phones = New-Object System.Collections.Generic.List[object]; $seen = @{}
  foreach ($col in $r.PSObject.Properties.Name) {
    if ($col -notmatch '^Phone (\d+) - Value$') { continue }
    $label = ([string]$r.("Phone $($matches[1]) - Label")).Replace('*', '').Trim().ToLower(); if (-not $label) { $label = 'phone' }
    foreach ($v in ([string]$r.$col -split ':::')) {
      $n = ($v -replace '[^\d+]', ''); if (($n -replace '\D', '').Length -lt 7 -or $seen[$n]) { continue }
      $seen[$n] = $true; $phones.Add([ordered]@{ l = $label; n = $n }) } }
  if (-not $phones.Count) { continue }
  $c = [ordered]@{ n = $name.Trim(); p = $phones }
  if ([string]$r.'Labels' -match 'starred') { $c.f = 1 }
  $out.Add($c) }

$sorted = @($out | Sort-Object { $_.n })
$json = ConvertTo-Json -InputObject $sorted -Depth 5 -Compress
[IO.File]::WriteAllText((Join-Path $res 'contacts.json'), $json, (New-Object Text.UTF8Encoding $false))
Write-Host ("Saved " + $sorted.Count + " contacts with phone numbers to " + (Join-Path $res 'contacts.json'))
Write-Host "Binxbar's PHONE app picks them up within a few minutes (or reopen it)."
