# Binxbar: bring your music app up on your main monitor (starting it and resuming playback if it isn't running).
# Runs when you double-tap the music row, or press play on "last played" (Stream Deck key 7 -> show-player.vbs).
# Picks the app you're using for music: a dedicated player (Spotify, Tidal, Apple Music, VLC...) first,
# then a browser tab on a music/video site, then the last app it opened. If nothing is open it starts Spotify.
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @'
using System; using System.Text; using System.Runtime.InteropServices;
public static class PW {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int hgt, uint flags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  public static void PlayPause() { keybd_event(0xB3, 0, 0, UIntPtr.Zero); keybd_event(0xB3, 0, 2, UIntPtr.Zero); }
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
}
'@
[void][PW]::SetProcessDpiAwarenessContext([IntPtr](-4))   # work in real screen pixels

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$stateFile = Join-Path $here 'player-state.txt'

# --- The Edge: the very wide monitor (about 32:9) ---
Add-Type -AssemblyName System.Windows.Forms
$scr = [System.Windows.Forms.Screen]::AllScreens | Where-Object { $_.Bounds.Height -gt 0 -and ($_.Bounds.Width / $_.Bounds.Height) -ge 3 } | Select-Object -First 1
if ($scr) { $E = @{ L = $scr.Bounds.Left; T = $scr.Bounds.Top; R = $scr.Bounds.Right; B = $scr.Bounds.Bottom } }
else { $E = @{ L = 0; T = 0; R = 0; B = 0 } }   # no Edge found: nothing counts as "on the Edge"
$ew = $E.R - $E.L; $eh = $E.B - $E.T
# The tile sits on the left third; the player goes on the right two thirds.
$px = $E.L + [int]($ew * 0.34); $pw = $E.R - $px; $py = $E.T; $ph = $eh

# --- Find music windows ---
$apps = 'spotify','tidal','deezer','applemusic','itunes','amazon music','vlc','foobar2000','musicbee','winamp','aimp','soundcloud','youtube music'
$browsers = 'chrome','msedge','firefox','opera','brave','vivaldi','arc'
$sites = 'youtube music','youtube','soundcloud','twitch','spotify','apple music','pandora','tidal','deezer','bandcamp','amazon music','kick'
function Get-Windows {
    $list = New-Object System.Collections.ArrayList
    [void][PW]::EnumWindows({ param($h, $l)
        if (-not [PW]::IsWindowVisible($h)) { return $true }
        $sb = New-Object System.Text.StringBuilder 512; [void][PW]::GetWindowText($h, $sb, 512); $t = $sb.ToString()
        if ($t.Length -lt 2) { return $true }
        $procId = [uint32]0; [void][PW]::GetWindowThreadProcessId($h, [ref]$procId)
        $pn = ''; try { $pn = (Get-Process -Id $procId -ErrorAction Stop).ProcessName.ToLower() } catch { return $true }
        [void]$list.Add([pscustomobject]@{ h = $h; t = $t; p = $pn })
        return $true }, [IntPtr]::Zero)
    return ,$list
}
$found = Get-Windows
$last = if (Test-Path $stateFile) { (Get-Content $stateFile -Raw) -split '\|' } else { @() }   # hwnd|L|T|R|B|process
function OnEdge($h) { $r = New-Object PW+RECT; [void][PW]::GetWindowRect($h, [ref]$r); $cx = ($r.L + $r.R) / 2; $cy = ($r.T + $r.B) / 2; return ($cx -ge $E.L -and $cx -lt $E.R -and $cy -ge $E.T -and $cy -lt $E.B) }

function Pick-Player($found) {
    foreach ($a in $apps) { $p = $found | Where-Object { $_.p.StartsWith($a) } | Select-Object -First 1; if ($p) { return $p } }
    foreach ($s in $sites) { $p = $found | Where-Object { ($browsers -contains $_.p) -and $_.t.ToLower().Contains($s) } | Select-Object -First 1; if ($p) { return $p } }
    return $null
}
$pick = Pick-Player $found
$launched = $false
if (-not $pick) {
    # Nothing open (e.g. you pressed play on "last played"): start Spotify, then press play once it's ready.
    Start-Process 'spotify:'
    for ($i = 0; $i -lt 25 -and -not $pick; $i++) { Start-Sleep -Milliseconds 800; $pick = Pick-Player (Get-Windows) }
    if (-not $pick) { exit }
    $launched = $true
}

$h = $pick.h
if ($launched) {
    # Fresh start: Spotify opens on your main monitor; press play once it's ready.
    Start-Sleep -Milliseconds 2500
    [PW]::PlayPause()
    exit
}
# Already running: bring it up on the main monitor (restore if minimized; pull it off the Edge if it's there).
if ([PW]::IsIconic($h)) { [void][PW]::ShowWindow($h, 9) }
if (OnEdge $h) {
    $m = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
    if ($last.Count -ge 6 -and [long]$last[0] -eq [long]$h -and -not ((([int]$last[1] + [int]$last[3]) / 2) -ge $E.L -and (([int]$last[1] + [int]$last[3]) / 2) -lt $E.R -and (([int]$last[2] + [int]$last[4]) / 2) -ge $E.T -and (([int]$last[2] + [int]$last[4]) / 2) -lt $E.B)) {
        $x = [int]$last[1]; $y = [int]$last[2]; $w = [int]$last[3] - $x; $hh = [int]$last[4] - $y
    } else { $w = [int]($m.Width * 0.6); $hh = [int]($m.Height * 0.7); $x = $m.Left + [int](($m.Width - $w) / 2); $y = $m.Top + [int](($m.Height - $hh) / 2) }
    [void][PW]::SetWindowPos($h, [IntPtr](-2), $x, $y, $w, $hh, 0x0040)   # not topmost, show
}
[void][PW]::SetWindowPos($h, [IntPtr](-2), 0, 0, 0, 0, 0x0043)           # not topmost (keep size/pos), show
[void][PW]::ShowWindow($h, 5)
[void][PW]::SetForegroundWindow($h)
