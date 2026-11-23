# Edge follows the main monitor: when you switch the main monitor off with its own power button, Windows loses it,
# so this turns the Xeneon Edge off too (same as numpad +). When the main monitor comes back, the Edge comes back on.
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$log = Join-Path $here 'edge-follow.log'
function Log($m) { Add-Content -Path $log -Value ((Get-Date -Format 'MM-dd HH:mm:ss') + "  " + $m) }
# Start with Windows from now on (a tiny launcher in your Startup folder).
try { $sf = Join-Path ([Environment]::GetFolderPath('Startup')) 'Binxbar edge follows monitor.vbs'
  if (-not (Test-Path -LiteralPath $sf)) { Set-Content -Path $sf -Value ('CreateObject("WScript.Shell").Run """' + (Join-Path $here 'edge-follow.vbs') + '""", 0, False'); Log 'added to Startup' } } catch { Log ('could not add to Startup: ' + $_.Exception.Message) }
$mutex = New-Object System.Threading.Mutex($false, 'Local\BinxbarEdgeFollow')
$pidFile = Join-Path $here 'edge-follow.pid'
$myTicks = [string](Get-Item -LiteralPath $MyInvocation.MyCommand.Path).LastWriteTimeUtc.Ticks
if (-not $mutex.WaitOne(0)) {   # already running: leave it alone, unless it's an older version of this script
  $old = ''; try { $old = (Get-Content -LiteralPath $pidFile -Raw).Trim() } catch {}
  if ($old -and $old.Split('|')[1] -eq $myTicks) { exit }
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -like '*edge-follow.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  try { if (-not $mutex.WaitOne(5000)) { exit } } catch [System.Threading.AbandonedMutexException] {} }
Set-Content -LiteralPath $pidFile -Value ("$PID|" + $myTicks)
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class BxMon {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  delegate bool MonProc(IntPtr m, IntPtr dc, ref RECT r, IntPtr d);
  [DllImport("user32.dll")] static extern bool EnumDisplayMonitors(IntPtr dc, IntPtr clip, MonProc f, IntPtr d);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  // true while a big screen (the main monitor; the Edge is 720 px on its short side, either way up) is connected
  [DllImport("user32.dll")] static extern bool EnumWindows(WinProc f, IntPtr d);
  delegate bool WinProc(IntPtr h, IntPtr d);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
  [DllImport("user32.dll")] static extern void keybd_event(byte k, byte s, int f, IntPtr e);
  // iCUE's "Switch Display Mode" shortcut is Scroll Lock (a key nothing else uses), so Num Lock stays a normal key.
  public static void NumLock() { keybd_event(0x91, 0x46, 0, IntPtr.Zero); keybd_event(0x91, 0x46, 2, IntPtr.Zero); }
  // true when a window from one of these process ids fills most of the Edge (the iCUE widget screen)
  public static bool CoversEdge(int[] pids) { SetProcessDPIAware(); RECT edge = new RECT(); bool haveEdge = false;
    EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (IntPtr m, IntPtr dc, ref RECT r, IntPtr d) => { if (Math.Min(r.B - r.T, r.R - r.L) < 900) { edge = r; haveEdge = true; } return true; }, IntPtr.Zero);
    if (!haveEdge) return false; bool hit = false; var set = new System.Collections.Generic.HashSet<int>(pids);
    EnumWindows((h, d) => { if (!IsWindowVisible(h)) return true; int pid; GetWindowThreadProcessId(h, out pid); if (!set.Contains(pid)) return true;
      RECT w; GetWindowRect(h, out w); int ix = Math.Min(w.R, edge.R) - Math.Max(w.L, edge.L), iy = Math.Min(w.B, edge.B) - Math.Max(w.T, edge.T);
      if (ix > 0 && iy > 0 && (long)ix * iy > 0.8 * (long)(edge.R - edge.L) * (edge.B - edge.T)) { hit = true; return false; } return true; }, IntPtr.Zero);
    return hit; }
  // Number-pad minus = widgets/desktop switch for the Edge.
  [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr h, int id, uint mods, uint vk);
  [StructLayout(LayoutKind.Sequential)] struct MSG { public IntPtr hwnd; public uint message; public IntPtr w, l; public uint time; public int x, y; }
  [DllImport("user32.dll")] static extern int GetMessage(out MSG m, IntPtr h, uint a, uint b);
  public static void StartMinusKey() {
    var t = new System.Threading.Thread(() => {
      if (!RegisterHotKey(IntPtr.Zero, 1, 0x4000, 0x6D)) return;   // 0x6D = number-pad minus, 0x4000 = no auto-repeat
      MSG m; while (GetMessage(out m, IntPtr.Zero, 0, 0) > 0) { if (m.message == 0x0312) ToggleWidgets(); } });
    t.IsBackground = true; t.Start(); }
  // Widgets <-> desktop without iCUE's shortcut: hide or show iCUE's own full-screen window on the Edge.
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
  static IntPtr hidden = IntPtr.Zero;
  static System.Collections.Generic.HashSet<int> IcuePids() { var s = new System.Collections.Generic.HashSet<int>();
    foreach (var n in new[] { "iCUE", "QtWebEngineProcess" }) foreach (var p in System.Diagnostics.Process.GetProcessesByName(n)) s.Add(p.Id); return s; }
  static IntPtr EdgeWindow(bool wantVisible) { SetProcessDPIAware(); RECT edge = new RECT(); bool haveEdge = false;
    EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (IntPtr m, IntPtr dc, ref RECT r, IntPtr d) => { if (Math.Min(r.B - r.T, r.R - r.L) < 900) { edge = r; haveEdge = true; } return true; }, IntPtr.Zero);
    if (!haveEdge) return IntPtr.Zero; var set = IcuePids(); IntPtr found = IntPtr.Zero;
    EnumWindows((h, d) => { if (IsWindowVisible(h) != wantVisible) return true; int pid; GetWindowThreadProcessId(h, out pid); if (!set.Contains(pid)) return true;
      RECT w; GetWindowRect(h, out w); int ix = Math.Min(w.R, edge.R) - Math.Max(w.L, edge.L), iy = Math.Min(w.B, edge.B) - Math.Max(w.T, edge.T);
      if (ix > 0 && iy > 0 && (long)ix * iy > 0.8 * (long)(edge.R - edge.L) * (edge.B - edge.T)) { found = h; return false; } return true; }, IntPtr.Zero);
    return found; }
  public static bool ShowWidgets() { IntPtr h = (hidden != IntPtr.Zero && IsWindow(hidden)) ? hidden : EdgeWindow(false);
    if (h == IntPtr.Zero) return false; ShowWindow(h, 4); hidden = IntPtr.Zero; return true; }
  public static void ToggleWidgets() { IntPtr v = EdgeWindow(true);
    if (v != IntPtr.Zero) { ShowWindow(v, 0); hidden = v; } else ShowWidgets(); }
  // Phone Link shows a small call window while a call is going (ringing or talking); the main Phone Link window is bigger.
  public static bool CallWindowOpen() { var set = new System.Collections.Generic.HashSet<int>();
    foreach (var p in System.Diagnostics.Process.GetProcessesByName("PhoneExperienceHost")) set.Add(p.Id);
    if (set.Count == 0) return false; bool hit = false;
    EnumWindows((h, d) => { if (!IsWindowVisible(h)) return true; int pid; GetWindowThreadProcessId(h, out pid); if (!set.Contains(pid)) return true;
      RECT w; GetWindowRect(h, out w); int ww = w.R - w.L, hh = w.B - w.T;
      if (w.L > -30000 && ww > 200 && hh > 150 && ww < 800 && hh < 650) { hit = true; return false; } return true; }, IntPtr.Zero);
    return hit; }
  public static bool MainPresent() { SetProcessDPIAware(); bool found = false;
    EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (IntPtr m, IntPtr dc, ref RECT r, IntPtr d) => { if (Math.Min(r.B - r.T, r.R - r.L) >= 900) found = true; return true; }, IntPtr.Zero);
    return found; } }
"@
$edge = Join-Path $here 'edge-display.vbs'
[BxMon]::StartMinusKey()
$was = [BxMon]::MainPresent(); $streak = 0
Log ('watching (main monitor ' + $(if ($was) { 'on' } else { 'off' }) + ')')
$callFile = Join-Path $env:APPDATA 'Corsair\CUE5\html_widgets\com\personal\binxbar\resources\call.json'
$inCall = $null; $callSince = 0   # null: always write the real state on the first check
while ($true) {
  Start-Sleep -Seconds 2
  # Tell Binxbar when a phone call starts and ends (for its ON A CALL screen).
  try { $c = [BxMon]::CallWindowOpen()
    if ($c -ne $inCall) { $inCall = $c; if ($c) { $callSince = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
      Set-Content -LiteralPath $callFile -Value ('{"active":' + $(if ($c) { 'true' } else { 'false' }) + ',"since":' + $callSince + ',"t":' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + '}')
      Log $(if ($c) { 'call started' } else { 'call ended' }) } } catch {}
  $now = [BxMon]::MainPresent()
  if ($now -eq $was) { $streak = 0; continue }
  $streak++; if ($streak -lt 2) { continue }   # must hold for two checks, so a flicker doesn't count
  $was = $now; $streak = 0
  if ($now) { Log 'main monitor back: Edge on'; Start-Process 'wscript.exe' ('"' + $edge + '" on')
    # Bring the widgets back if iCUE isn't showing them: the switch shortcut first (quickest), then restart iCUE + the shortcut if that wasn't enough.
    function WidgetsUp { $ids = @(Get-Process -Name 'iCUE', 'QtWebEngineProcess' -ErrorAction SilentlyContinue | ForEach-Object { $_.Id }); if (-not $ids.Count) { return $false }; [BxMon]::CoversEdge([int[]]$ids) }
    Start-Sleep -Seconds 6
    if (WidgetsUp) { Log 'widgets are up' } else {
      Log 'widgets missing: showing them'; [BxMon]::ShowWidgets() | Out-Null; Start-Sleep -Seconds 2
      if (WidgetsUp) { Log 'widgets up' } else {
        Log 'still missing: restarting iCUE'; Start-Process 'wscript.exe' ('"' + (Join-Path $here 'restart-icue.vbs') + '"')
        $up = $false; for ($w = 0; $w -lt 12 -and -not $up; $w++) { Start-Sleep -Seconds 2; $up = WidgetsUp }
        if (-not $up) { Log 'still on desktop: showing them'; [BxMon]::ShowWidgets() | Out-Null; Start-Sleep -Seconds 2 }
        Log ('widgets ' + $(if (WidgetsUp) { 'up' } else { 'still missing' })) } } }
  else { Log 'main monitor off: Edge off'; Start-Process 'wscript.exe' ('"' + $edge + '" off') } }
