param([switch]$NoWait, [switch]$Offscreen)
# Opens Phone Link on the two-thirds of the Xeneon Edge that Binxbar doesn't use, on top of iCUE, so you can pair your phone
# without leaving your game on the main screen. Close Phone Link when you're done.
Add-Type @"
using System; using System.Text; using System.Runtime.InteropServices;
public static class PL {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr p);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint f);
  public static IntPtr Find(string title) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, p) => { if (!IsWindowVisible(h)) return true; var sb = new StringBuilder(256); GetWindowText(h, sb, 256);
      if (sb.ToString() == title) { found = h; return false; } return true; }, IntPtr.Zero);
    return found; }
}
"@
[PL]::SetProcessDPIAware() | Out-Null
Add-Type -AssemblyName System.Windows.Forms
$edge = [System.Windows.Forms.Screen]::AllScreens | Where-Object { $b = $_.Bounds; ($b.Width -ge 3 * $b.Height) -or ($b.Height -ge 3 * $b.Width) } | Select-Object -First 1
if (-not $edge) { exit }
$b = $edge.Bounds
if ($b.Height -gt $b.Width) {   # Edge standing up: Binxbar is the top third, so use the bottom two-thirds
  $third = [int]($b.Height / 3); $x = $b.X; $y = $b.Y + $third; $w = $b.Width; $h = $b.Height - $third
} else {                        # Edge lying sideways: use the right two-thirds
  $third = [int]($b.Width / 3); $x = $b.X + $third; $y = $b.Y; $w = $b.Width - $third; $h = $b.Height }

Start-Process 'explorer.exe' 'shell:AppsFolder\Microsoft.YourPhone_8wekyb3d8bbwe!App'
$hwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 80 -and $hwnd -eq [IntPtr]::Zero; $i++) { Start-Sleep -Milliseconds 250; $hwnd = [PL]::Find('Phone Link') }
if ($hwnd -eq [IntPtr]::Zero) { exit }
if ($Offscreen) {   # dialing from Binxbar: keep Phone Link working but out of sight, off the left side of the screens
  [PL]::ShowWindow($hwnd, 9) | Out-Null
  [PL]::SetWindowPos($hwnd, [IntPtr]::Zero, -6000, 0, $w, $h, 0x14) | Out-Null; exit }
$TOP = [IntPtr](-1)
[PL]::ShowWindow($hwnd, 9) | Out-Null   # restore if maximized/minimized
[PL]::SetWindowPos($hwnd, $TOP, $x, $y, $w, $h, $(if ($NoWait) { 0x40 } else { 0x50 })) | Out-Null   # NoWait (REPLY): take focus so you can type; otherwise don't pull focus from your game
if ($NoWait) { [PL]::SetForegroundWindow($hwnd) | Out-Null; exit }   # REPLY: focus it so you can type
while ([PL]::IsWindow($hwnd) -and [PL]::IsWindowVisible($hwnd)) { Start-Sleep -Seconds 2; [PL]::SetWindowPos($hwnd, $TOP, 0, 0, 0, 0, 0x13) | Out-Null }
