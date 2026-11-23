# Binxbar phone buttons: ANSWER / DECLINE a call, CALL BACK a missed call, REPLY to a text, and the PHONE app's calls / hang-up.
# Presses the matching button inside Phone Link (via Windows UI Automation). Run by Stream Deck keys 15, 16, 20, 21.
param([Parameter(Mandatory = $true)][ValidateSet('answer', 'decline', 'callback', 'reply', 'peek', 'messages', 'hangup', 'dial', 'text')][string]$Action, [string]$Number = '', [string]$Body = '')
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$log = Join-Path $here 'phone-action.log'
function Log($m) { Add-Content -Path $log -Value ((Get-Date -Format 'MM-dd HH:mm:ss') + "  " + $Action + ": " + $m) }
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
# Keep the PHONE app helper running (only one copy ever runs), and start it with Windows from now on.
# Keep the Edge helper (edge-follow: monitor follow, number-pad minus, call status) running. Only one copy ever runs.
try { Start-Process 'wscript.exe' ('"' + (Join-Path $here 'edge-follow.vbs') + '"') } catch {}
$A = [System.Windows.Automation.AutomationElement]; $TS = [System.Windows.Automation.TreeScope]
$C = [System.Windows.Automation.Condition]::TrueCondition
$hosts = 'PhoneExperienceHost', 'ShellExperienceHost', 'YourPhone', 'YourPhoneAppProxy', 'CrossDeviceResume'

function Windows-Of-PhoneLink {
  $A::RootElement.FindAll($TS::Children, $C) | Where-Object {
    try { $p = Get-Process -Id $_.Current.ProcessId -ErrorAction Stop; $hosts -contains $p.ProcessName } catch { $false } } }
# Phone Link's incoming-call pop-up is a Windows notification window (not Phone Link's own), so look in every top-level window.
# Only the windows that can hold Phone Link's call buttons (Windows' notification pop-ups/panel and Phone Link itself): searching every app is too slow.
$popupHosts = '^(ShellExperienceHost|StartMenuExperienceHost|explorer|PhoneExperienceHost|YourPhone|YourPhoneAppProxy|CrossDeviceResume|ShellHost|Widgets)$'
function All-Windows { $A::RootElement.FindAll($TS::Children, $C) | Where-Object { try { (Get-Process -Id $_.Current.ProcessId -ErrorAction Stop).ProcessName -match $popupHosts } catch { $false } } }
function Find-Button([string]$pattern) {
  foreach ($w in @(All-Windows)) {
    $btn = $w.FindAll($TS::Descendants, (New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button))) |
      Where-Object { $_.Current.Name -match $pattern } | Select-Object -First 1
    if ($btn) { return $btn } }
  return $null }

# Windows' notification pop-ups don't always show up in the UI Automation tree, so list real top-level windows directly.
Add-Type @"
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public static class BxWin {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern void keybd_event(byte k, byte s, int f, IntPtr e);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int c);
  // Windows only lets the active app change focus; a tap of Alt lifts that block.
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  public static string FgInfo() { IntPtr h = GetForegroundWindow(); int pid; GetWindowThreadProcessId(h, out pid);
    var c = new StringBuilder(256); GetClassName(h, c, 256); var t = new StringBuilder(256); GetWindowText(h, t, 256); return pid + "|" + c + "|" + t; }
  // Win+Shift+V moves keyboard focus onto the newest Windows notification pop-up.
  public static void FocusToast() { byte[] down = { 0x5B, 0x10, 0x56 }; foreach (var k in down) keybd_event(k, 0, 0, IntPtr.Zero);
    System.Threading.Thread.Sleep(40); for (int i = down.Length - 1; i >= 0; i--) keybd_event(down[i], 0, 2, IntPtr.Zero); }
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] static extern void mouse_event(int f, int x, int y, int d, IntPtr e);
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  // Tap a spot on screen, then put the mouse back where it was.
  public static void Tap(int x, int y) { POINT old; GetCursorPos(out old); SetCursorPos(x, y); System.Threading.Thread.Sleep(30);
    mouse_event(2, 0, 0, 0, IntPtr.Zero); System.Threading.Thread.Sleep(30); mouse_event(4, 0, 0, 0, IntPtr.Zero); System.Threading.Thread.Sleep(30); SetCursorPos(old.X, old.Y); }
  public static bool Hide(IntPtr h) { return ShowWindow(h, 6); }   // minimize
  [StructLayout(LayoutKind.Sequential)] struct WP { public int len, flags, show; public POINT min, max; public RECT normal; }
  [DllImport("user32.dll")] static extern bool SetWindowPlacement(IntPtr h, ref WP p);
  // minimize, with its "normal" spot set back on the main screen (so opening Phone Link yourself later isn't off-screen)
  public static bool Park(IntPtr h) { var p = new WP(); p.len = Marshal.SizeOf(typeof(WP)); p.show = 7;
    p.normal = new RECT { L = 200, T = 120, R = 1300, B = 1000 }; return SetWindowPlacement(h, ref p); }
  public static bool Front(IntPtr h) { keybd_event(0x12, 0, 0, IntPtr.Zero); keybd_event(0x12, 0, 2, IntPtr.Zero); ShowWindow(h, 5); return SetForegroundWindow(h); }
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int s);
  [DllImport("user32.dll")] static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  public static List<string> List() { var r = new List<string>();
    EnumWindows((h, l) => { if (IsWindowVisible(h)) { int pid; GetWindowThreadProcessId(h, out pid);
      var c = new StringBuilder(256); GetClassName(h, c, 256); var t = new StringBuilder(256); GetWindowText(h, t, 256);
      RECT rc; GetWindowRect(h, out rc); int cl = 0; DwmGetWindowAttribute(h, 14, out cl, 4);
      r.Add(h.ToInt64() + "|" + pid + "|" + c + "|" + t + "|" + rc.L + "," + rc.T + " " + (rc.R - rc.L) + "x" + (rc.B - rc.T) + (cl != 0 ? " cloaked" : "")); } return true; }, IntPtr.Zero); return r; } }
"@
$skipApps = '^(iCUE|QtWebEngineProcess|msedgewebview2|chrome|Discord|Wow|Battle\.net|Spotify|StreamDeck|claude|Claude|Notepad|SystemSettings|AWCC.*|TextInputHost|ApplicationFrameHost)$'
$shellHosts = '^(ShellExperienceHost|ShellHost|PhoneExperienceHost|YourPhone|YourPhoneAppProxy|CrossDeviceResume|StartMenuExperienceHost)$'
function Popup-Windows { foreach ($line in [BxWin]::List()) { $p = $line.Split('|')
  try { $pn = (Get-Process -Id ([int]$p[1]) -ErrorAction Stop).ProcessName } catch { continue }
  if ($pn -notmatch $skipApps -and $p[4] -notmatch 'cloaked') { [pscustomobject]@{ H = [IntPtr][long]$p[0]; Proc = $pn; Cls = $p[2]; Title = $p[3] } } } }
function Dump-All { (@([BxWin]::List()) | ForEach-Object { $p = $_.Split('|'); try { $pn = (Get-Process -Id ([int]$p[1]) -ErrorAction Stop).ProcessName } catch { $pn = '?' }
    if ($pn -notmatch $skipApps -and $pn -notmatch '^(Rainmeter|NVIDIA Overlay)$' -and $p[4] -notmatch 'cloaked') { $pn + '{' + $p[2] + '}"' + $p[3] + '" ' + $p[4] } }) -join ' || ' }
function Find-InPopups([string]$pattern) {
  foreach ($pw in @(Popup-Windows)) { try { $el = $A::FromHandle($pw.H) } catch { continue }
    $b = $el.FindAll($TS::Descendants, (New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button))) | Where-Object { $_.Current.Name -match $pattern } | Select-Object -First 1
    if ($b) { return $b } }
  return $null }
function Describe-Popups { (@(Popup-Windows) | ForEach-Object { $n = ''
    try { $n = (($A::FromHandle($_.H).FindAll($TS::Descendants, (New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button))) | ForEach-Object { $_.Current.Name } | Where-Object { $_ } | Select-Object -First 8) -join '/') } catch {}
    $_.Proc + '{' + $_.Cls + '}"' + $_.Title + '" [' + $n + ']' }) -join ' || ' }


# Phone Link's incoming-call pop-up is its own small "Phone Link" window (about 516x362), separate from the main Phone Link window.
function Call-Window { foreach ($line in [BxWin]::List()) { $p = $line.Split('|')
    if ($p[3] -ne 'Phone Link' -or $p[4] -match 'cloaked' -or $p[4] -match '^-32000') { continue }
    try { if ((Get-Process -Id ([int]$p[1]) -ErrorAction Stop).ProcessName -ne 'PhoneExperienceHost') { continue } } catch { continue }
    if ($p[4] -match ' (\d+)x(\d+)') { if ([int]$matches[1] -le 800 -and [int]$matches[2] -le 600) { return [IntPtr][long]$p[0] } } }
  return [IntPtr]::Zero }
function Call-Controls($h) { try { $A::FromHandle($h).FindAll($TS::Descendants, $C) | Where-Object { $_.Current.Name } } catch { @() } }
function Press-InCallWindow([string]$pattern) {
  $h = Call-Window; if ($h -eq [IntPtr]::Zero) { return $null }
  $all = @(Call-Controls $h)
  Log ('call pop-up controls: ' + @($all).Count)
  $b = $all | Where-Object { $_.Current.Name -match $pattern } | Select-Object -First 1
  if ($b) { if (Press $b) { return 'pressed' } }
  return $h }

function Press($el) {
  try { $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); return $true } catch { Log ("invoke failed: " + $_.Exception.Message); return $false } }
# Place a call through Phone Link's own Calls page: open it on the Edge, type the number in its dial box, press Call.
function Dial-Number([string]$n) {
  Get-Process openwith -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  $prevFg = [BxWin]::GetForegroundWindow()   # hand focus back to whatever you were in (like WoW) afterwards
  & (Join-Path $here 'phonelink-on-edge.ps1') -Offscreen
  $w = $null
  for ($i = 0; $i -lt 40 -and -not $w; $i++) { Start-Sleep -Milliseconds 250
    # the biggest visible "Phone Link" window is the app itself
    $best = 0
    foreach ($line in [BxWin]::List()) { $p = $line.Split('|'); if ($p[3] -eq 'Phone Link' -and $p[4] -notmatch '^-32000' -and $p[4] -notmatch 'cloaked' -and $p[4] -match ' (\d+)x(\d+)') { $area = [int]$matches[1] * [int]$matches[2]
        if ($area -gt $best) { try { $w = $A::FromHandle([IntPtr][long]$p[0]); $best = $area; $wInfo = $p[4] } catch {} } } } }
  if ($w) { Log 'dial: Phone Link ready' }
  if (-not $w) { Log 'dial: Phone Link window not found'; return }
  $tab = $w.FindAll($TS::Descendants, $C) | Where-Object { $_.Current.Name -eq 'Calls' } | Select-Object -First 1
  if ($tab) { try { $tab.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select() } catch { Press $tab | Out-Null } }
  Start-Sleep -Milliseconds 900
  # Phone Link doesn't expose its dial pad to other programs, but it takes typing: click the empty space above the pad,
  # clear it, type the number, then Tab lands on the green Call button and Enter presses it.
  $hw = [IntPtr]::Zero; $rect = $null
  foreach ($line in [BxWin]::List()) { $p = $line.Split('|'); if ($p[3] -eq 'Phone Link' -and $p[4] -match '^(-?\d+),(-?\d+) (\d+)x(\d+)' -and ([int]$matches[3] * [int]$matches[4]) -gt 300000) { $hw = [IntPtr][long]$p[0]; $rect = @{ X = [int]$matches[1]; Y = [int]$matches[2]; W = [int]$matches[3]; H = [int]$matches[4] } } }
  if (-not $rect) { Log 'dial: Phone Link window not on the Edge'; return }
  [BxWin]::Front($hw) | Out-Null; Start-Sleep -Milliseconds 250
  $s = $rect.H / 720.0
  # Put keyboard focus on Phone Link's dial pad without touching the mouse (the cursor can be blocked from the Edge).
  if (-not (Focus-Button '^([0-9*#]|one|two|three|four|five|six|seven|eight|nine|zero)\b|dial|backspace' 'call')) { Log ('dial: could not reach the dial pad; focus went: ' + (@($script:focusTrail).Count) + ' steps'); return }
  Add-Type -AssemblyName System.Windows.Forms
  $digitsOnly = ($n -replace '^\+1', '' -replace '[^\d*#]', '')
  [System.Windows.Forms.SendKeys]::SendWait('{BACKSPACE 25}'); Start-Sleep -Milliseconds 150
  [System.Windows.Forms.SendKeys]::SendWait(($digitsOnly -replace '([#*+^%~(){}\[\]])', '{$1}')); Start-Sleep -Milliseconds 300
  # Find the green Call button by moving keyboard focus (Tab forward, then backward if that misses), then press it.
  if (Focus-Button '^(Call|Dial|Start call|Make a call)\b' 'back|history|log') {
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}'); Log ('dial: typed ' + $digitsOnly.Length + ' digits and pressed Call')
    Start-Sleep -Milliseconds 1500; [BxWin]::Park($hw) | Out-Null   # put Phone Link back on the main screen, minimized; the call shows in Binxbar
    if ($prevFg -ne [IntPtr]::Zero) { [BxWin]::Front($prevFg) | Out-Null }
  } else { Log ('dial: typed the number but could not reach Call; focus went: ' + (@($script:focusTrail).Count) + ' steps'); [BxWin]::Park($hw) | Out-Null; if ($prevFg -ne [IntPtr]::Zero) { [BxWin]::Front($prevFg) | Out-Null } } }

# Moves keyboard focus around the front window until a control whose name matches $want has it.
function Focus-Button([string]$want, [string]$avoid) {
  Add-Type -AssemblyName System.Windows.Forms
  $script:focusTrail = @()
  foreach ($dir in '{TAB}', '+{TAB}') {
    for ($t = 0; $t -lt 8; $t++) {
      $fn = ''; try { $fn = $A::FocusedElement.Current.Name } catch {}
      if ($t -gt 0 -or $dir -eq '{TAB}') { $script:focusTrail += $fn }
      if ($fn -match $want -and -not ($avoid -and $fn -match $avoid)) { return $true }
      [System.Windows.Forms.SendKeys]::SendWait($dir); Start-Sleep -Milliseconds 120 } }
  $fn = ''; try { $fn = $A::FocusedElement.Current.Name } catch {}
  return ($fn -match $want -and -not ($avoid -and $fn -match $avoid)) }

# Send a text through Phone Link's Messages page, out of sight, using only the keyboard.
function Send-Text([string]$n, [string]$body) {
  Add-Type -AssemblyName System.Windows.Forms
  $prevFg = [BxWin]::GetForegroundWindow()
  & (Join-Path $here 'phonelink-on-edge.ps1') -Offscreen
  $hw = [IntPtr]::Zero
  for ($i = 0; $i -lt 40 -and $hw -eq [IntPtr]::Zero; $i++) { Start-Sleep -Milliseconds 250
    foreach ($line in [BxWin]::List()) { $p = $line.Split('|'); if ($p[3] -eq 'Phone Link' -and $p[4] -match '^(-?\d+),(-?\d+) (\d+)x(\d+)' -and ([int]$matches[3] * [int]$matches[4]) -gt 300000) { $hw = [IntPtr][long]$p[0] } } }
  if ($hw -eq [IntPtr]::Zero) { Log 'text: Phone Link window not found'; return }
  $w = $A::FromHandle($hw)
  $tab = $w.FindAll($TS::Descendants, $C) | Where-Object { $_.Current.Name -eq 'Messages' } | Select-Object -First 1
  if ($tab) { try { $tab.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select() } catch { Press $tab | Out-Null } }
  Start-Sleep -Milliseconds 900
  [BxWin]::Front($hw) | Out-Null; Start-Sleep -Milliseconds 250
  $done = $false
  try {
    # Phone Link shortcuts: Ctrl+1 = Messages page, Ctrl+N = new message (lands in the "To" box).
    [System.Windows.Forms.SendKeys]::SendWait('^1'); Start-Sleep -Milliseconds 900
    [System.Windows.Forms.SendKeys]::SendWait('^n'); Start-Sleep -Milliseconds 1000
    $fn = ''; try { $fn = $A::FocusedElement.Current.Name } catch {}
    Log ('text: new message box ' + $(if ($fn -match 'to|recipient|search|name|number|contact') { 'open' } else { 'not found yet' }))
    if ($fn -notmatch 'to|recipient|search|name|number|contact') {
      if (-not (Focus-Button '^New (message|conversation)|compose' '')) { Log ('text: no New message button; focus went: ' + (@($script:focusTrail).Count) + ' steps'); return }
      [System.Windows.Forms.SendKeys]::SendWait('{ENTER}'); Start-Sleep -Milliseconds 900 }
    $digitsOnly = ($n -replace '[^\d+]', '')
    [System.Windows.Forms.SendKeys]::SendWait(($digitsOnly -replace '([+^%~(){}\[\]])', '{$1}')); Start-Sleep -Milliseconds 1200
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}'); Start-Sleep -Milliseconds 900
    if (-not (Focus-Button '(type|enter|send|write).*message|^message$|text message' 'new message|^messages')) { Log ('text: no message box; focus went: ' + (@($script:focusTrail).Count) + ' steps'); return }
    $safe = ($body -replace '([+^%~(){}\[\]])', '{$1}') -replace "`r?`n", ' '
    [System.Windows.Forms.SendKeys]::SendWait($safe); Start-Sleep -Milliseconds 400
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}'); Start-Sleep -Milliseconds 800
    $done = $true; Log ('text: sent ' + $body.Length + ' characters')
  } finally {
    [BxWin]::Park($hw) | Out-Null
    if ($prevFg -ne [IntPtr]::Zero) { [BxWin]::Front($prevFg) | Out-Null } } }

function Open-PhoneLink { Start-Process 'explorer.exe' 'shell:AppsFolder\Microsoft.YourPhone_8wekyb3d8bbwe!App'; Start-Sleep -Milliseconds 1500 }

$who = ''; $recentText = $false
try { $pj = Get-Content (Join-Path $env:APPDATA 'Corsair\CUE5\html_widgets\com\personal\binxbar\resources\phone.json') -Raw | ConvertFrom-Json; $who = $pj.who
  $age = ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - [long]$pj.t) / 60000
  $recentText = ($pj.kind -eq 'text' -and $age -lt 10) } catch {}

# The call notification stays in Windows' notification panel while the phone rings: open it, find the button, close it.
$script:panelOpened = $false
function From-NotificationPanel([string]$pattern) {
  Start-Process 'ms-actioncenter:'; $script:panelOpened = $true
  for ($i = 0; $i -lt 6; $i++) { Start-Sleep -Milliseconds 250; $b = Find-Button $pattern; if ($b) { return $b } }
  return $null }
function Close-Panel { if ($script:panelOpened) { Start-Sleep -Milliseconds 400; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{ESC}') } }

$generic = '^(incoming call|phone link|accept|answer|decline|dismiss|message|mute|close|more options|notification|new notification|call|calling|mobile|phone|\{.*\})$'
function Call-Popup { foreach ($w in All-Windows) { $b = $w.FindAll($TS::Descendants, (New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button))) | Where-Object { $_.Current.Name -match '^(Accept|Answer)' } | Select-Object -First 1; if ($b) { return $w } }; return $null }

switch ($Action) {
  'peek' {
    # Called by the helper when a call comes in: write the caller's name for Binxbar (no other text is kept).
    $name = ''
    for ($i = 0; $i -lt 3 -and -not $name; $i++) {
      $w = Call-Popup
      if ($w) { $name = ($w.FindAll($TS::Descendants, (New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, [System.Windows.Automation.ControlType]::Text))) |
          ForEach-Object { $_.Current.Name.Trim() } | Where-Object { $_ -and $_ -notmatch $generic -and $_.Length -lt 60 } | Select-Object -First 1) }
      if (-not $name) { Start-Sleep -Milliseconds 500 } }
    $probe = foreach ($w in $A::RootElement.FindAll($TS::Children, $C)) { try { $pn = (Get-Process -Id $w.Current.ProcessId -ErrorAction Stop).ProcessName } catch { continue }
      if ($pn -notmatch $popupHosts) { continue }
      $bn = $w.FindAll($TS::Descendants, (New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button))) | ForEach-Object { $_.Current.Name } | Where-Object { $_ } | Select-Object -First 15
      if ($bn) { $pn + ' [' + $w.Current.Name + ']: ' + ($bn -join ' | ') } }
    Log ('windows at ring: ' + @([BxWin]::List()).Count)
    if ($name) { Set-Content -Path (Join-Path $env:APPDATA 'Corsair\CUE5\html_widgets\com\personal\binxbar\resources\phone-who.txt') -Value $name -Encoding UTF8; Log 'caller name found' } else { Log 'caller name not found' } }
  'answer' {
    $r = $null
    for ($i = 0; $i -lt 8 -and -not $r; $i++) { $r = Press-InCallWindow '^(Accept|Answer)'; if (-not $r) { Start-Sleep -Milliseconds 250 } }
    if ("$r" -eq 'pressed') { Log 'answered'; break }
    if ($r) { # Accept is the pop-up's default button: bring it forward and press Enter.
      [BxWin]::Front($r) | Out-Null; Start-Sleep -Milliseconds 200
      Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}'); Log 'answered with Enter'; break }
    # The call pop-up is a Windows notification: put focus on it, then Enter presses its default button (Accept).
    [BxWin]::FocusToast(); Start-Sleep -Milliseconds 350
    $fg = [BxWin]::FgInfo().Split('|', 3); try { $fp = (Get-Process -Id ([int]$fg[0]) -ErrorAction Stop).ProcessName } catch { $fp = '?' }
    if ($fp -match '^(ShellExperienceHost|ShellHost|explorer|PhoneExperienceHost)$' -and $fg[1] -ne 'Shell_TrayWnd') {
      Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}'); Log ('answered: Enter on ' + $fp) }
    else { Log ('notification did not take focus; focus is on ' + $fp) } }
  'decline' { $r = Press-InCallWindow '^(Decline|Reject|Ignore|Dismiss)'; if ("$r" -eq 'pressed') { Log 'declined'; break }
    $b = Find-InPopups '^(Decline|Reject|Ignore)'; if (-not $b) { $b = Find-Button '^(Decline|Reject|Ignore)' }
    if (-not $b) { $b = From-NotificationPanel '^(Decline|Reject|Ignore)' }
    if ($b -and (Press $b)) { Log 'declined' } else { Log 'no Decline button found' }; Close-Panel }
  'callback' {
    # Phone Link's missed-call notification has a "Call back" button; open Phone Link so it's on screen.
    $b = Find-Button '^Call ?back'; if (-not $b) { Open-PhoneLink; $b = Find-Button '^Call ?back' }
    if ($b -and (Press $b)) { Log 'calling back' } else { Log 'no Call back button found' } }
  'messages' {
    # MESSAGES in the PHONE app: Phone Link on the right two-thirds of the Edge, on its Messages page.
    & (Join-Path $here 'phonelink-on-edge.ps1') -NoWait
    Start-Sleep -Milliseconds 900
    $w = Windows-Of-PhoneLink | Where-Object { $_.Current.Name -eq 'Phone Link' } | Select-Object -First 1
    if ($w) { $tab = $w.FindAll($TS::Descendants, $C) | Where-Object { $_.Current.Name -eq 'Messages' } | Select-Object -First 1
      if ($tab) { try { $tab.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select() } catch { Press $tab | Out-Null } } }
    Log 'opened messages' }
  'dial' { if ($Number) { Log ('dial requested (' + ($Number -replace '\D', '').Length + ' digits, test)'); Dial-Number $Number } }
  'text' { if ($Number -and $Body) { Log 'text requested (test)'; Send-Text $Number $Body } }
  'hangup' {
    # End the call: try each visible Phone Link window, move keyboard focus to its End call button, press it.
    $done = $false
    foreach ($line in [BxWin]::List()) { if ($done) { break }
      $p = $line.Split('|'); if ($p[3] -notmatch 'Phone Link' -or $p[4] -match 'cloaked') { continue }
      $h = [IntPtr][long]$p[0]; [BxWin]::Front($h) | Out-Null; Start-Sleep -Milliseconds 300
      if (Focus-Button '^(End call|Hang up|End)\b' '') { Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}'); $done = $true; Log 'hung up'; Start-Sleep -Milliseconds 800; [BxWin]::Hide($h) | Out-Null } }
    if (-not $done) { Log ('no End call button; focus went: ' + (@($script:focusTrail).Count) + ' steps') } }
  'reply' {
    # The PHONE app leaves its request in iCUE's saved widget storage (a file on this PC). Find the newest one.
    $reqDirs = @(); $cache = Join-Path $here 'phone-req-dirs.txt'
    if (Test-Path -LiteralPath $cache) { $reqDirs = @(Get-Content -LiteralPath $cache | Where-Object { $_ -and (Test-Path -LiteralPath $_) }) }
    if (-not $reqDirs.Count) {
      $reqDirs = @(foreach ($root in @((Join-Path $env:LOCALAPPDATA 'Corsair'), (Join-Path $env:APPDATA 'Corsair'), (Join-Path $env:LOCALAPPDATA 'iCUE'))) {
        if (Test-Path -LiteralPath $root) { Get-ChildItem -LiteralPath $root -Recurse -Directory -Filter 'leveldb' -ErrorAction SilentlyContinue | Where-Object { $_.Parent.Name -eq 'Local Storage' } | ForEach-Object { $_.FullName } } })
      if ($reqDirs.Count) { Set-Content -LiteralPath $cache -Value $reqDirs }
      Log ('widget storage folders: ' + $reqDirs.Count) }
    $lastFile = Join-Path $here 'phone-req.last'; $last = 0L; try { $last = [long](Get-Content -LiteralPath $lastFile -Raw) } catch {}
    $nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); $req = $null
    for ($try = 0; $try -lt 12 -and -not $req; $try++) {
      foreach ($d in $reqDirs) { foreach ($f in (Get-ChildItem -LiteralPath $d -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in '.log', '.ldb' })) {
        try { $fs = [IO.File]::Open($f.FullName, 'Open', 'Read', 'ReadWrite'); $buf = New-Object byte[] $fs.Length; [void]$fs.Read($buf, 0, $buf.Length); $fs.Close() } catch { continue }
        $txt = [Text.Encoding]::GetEncoding(28591).GetString($buf) -replace "`0", ''
        foreach ($m in [regex]::Matches($txt, 'BINXREQ\|(dial|messages|hangup|text)\|([+\d*#]*)\|(\d{13})\|([A-Za-z0-9+/=]*)')) {
          $ts = [long]$m.Groups[3].Value
          if ($ts -gt $last -and ($nowMs - $ts) -lt 60000 -and (-not $req -or $ts -gt $req.T)) { $req = @{ W = $m.Groups[1].Value; N = $m.Groups[2].Value; T = $ts; B = $m.Groups[4].Value } } } } }
      if (-not $req) { Start-Sleep -Milliseconds 500 } }
    if ($req) {
      Set-Content -LiteralPath $lastFile -Value $req.T
      if ($req.W -eq 'text') { $b = ''; try { $b = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($req.B)) } catch {}
        if ($req.N.Length -ge 3 -and $b) { Log ('text requested (' + $b.Length + ' characters)'); Send-Text $req.N $b } }
      elseif ($req.W -eq 'dial') { if ($req.N.Length -ge 3) { Log ('dial requested (' + $req.N.Length + ' digits)'); Dial-Number $req.N } }
      else { & $PSCommandPath -Action $req.W }
      break }
    # Open Phone Link on the right two-thirds of the Edge, on that person's conversation, cursor in the reply box.
    # The phone icon uses the same key: with no fresh text alert it opens Phone Link's Calls page (keypad and contact search).
    if (-not $recentText) { Log 'phone helper started'; break }   # PHONE icon: the helper (started above) is all it needs
    & (Join-Path $here 'phonelink-on-edge.ps1') -NoWait
    if (-not $recentText) {
      Start-Sleep -Milliseconds 800
      $w = Windows-Of-PhoneLink | Where-Object { $_.Current.Name -eq 'Phone Link' } | Select-Object -First 1
      if (-not $w) { Log 'Phone Link window not found'; break }
      $tab = $w.FindAll($TS::Descendants, $C) | Where-Object { $_.Current.Name -eq 'Calls' } | Select-Object -First 1
      if ($tab) { try { $tab.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select() } catch { Press $tab | Out-Null }; Log 'opened phone (Calls)' } else { Log 'opened phone' }
      break }
    Start-Sleep -Milliseconds 800
    $w = Windows-Of-PhoneLink | Where-Object { $_.Current.Name -eq 'Phone Link' } | Select-Object -First 1
    if (-not $w) { Log 'Phone Link window not found'; break }
    $tab = $w.FindAll($TS::Descendants, $C) | Where-Object { $_.Current.Name -eq 'Messages' -and $_.Current.ControlType.ProgrammaticName -match 'TabItem|Button|ListItem' } | Select-Object -First 1
    if ($tab) { try { $tab.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select() } catch { Press $tab | Out-Null } }
    Start-Sleep -Milliseconds 500
    if ($who) {
      $conv = $w.FindAll($TS::Descendants, (New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, [System.Windows.Automation.ControlType]::ListItem))) |
        Where-Object { $_.Current.Name -like "*$who*" } | Select-Object -First 1
      if ($conv) { try { $conv.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select() } catch { try { $conv.SetFocus() } catch {} } ; Log 'opened conversation' } else { Log 'conversation not found in list' } }
    Start-Sleep -Milliseconds 600
    $box = $w.FindAll($TS::Descendants, (New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit))) |
      Where-Object { $_.Current.Name -match 'message' -and $_.Current.Name -notmatch 'Search' } | Select-Object -Last 1
    if ($box) { try { $box.SetFocus(); Log 'reply box focused' } catch { Log 'could not focus reply box' } } }
}
