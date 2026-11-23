# Binxbar SPEAKER button: flips Windows sound between your headset and a speaker (Bluetooth or any other).
# First press: switches to the speaker (and remembers what you were on). Next press: back to your headset.
# Set the device names in speaker-switch.ini next to this file.
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$cfg = @{ Speaker = ''; Headset = ''; WidgetFolder = '%APPDATA%\Corsair\CUE5\html_widgets\com\personal\binxbar' }
$ini = Join-Path $here 'speaker-switch.ini'
if (Test-Path $ini) { Get-Content $ini | ForEach-Object { if ($_ -match '^\s*([A-Za-z]+)\s*=\s*(.*?)\s*$') { $cfg[$matches[1]] = $matches[2] } } }
$Speaker = $cfg['Speaker']; $Headset = $cfg['Headset']
if (-not $Speaker -or $Speaker -eq 'CHANGE_ME') { exit }
$memo = Join-Path $here 'speaker-switch.last'

Add-Type @"
using System; using System.Collections.Generic; using System.Runtime.InteropServices;
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorCo {}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  [PreserveSig] int EnumAudioEndpoints(int flow, int mask, out IMMDeviceCollection c);
  [PreserveSig] int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice d);
  [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice d); }
[Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceCollection { [PreserveSig] int GetCount(out int n); [PreserveSig] int Item(int i, out IMMDevice d); }
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  [PreserveSig] int Activate(ref Guid iid, int ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o);
  [PreserveSig] int OpenPropertyStore(int access, out IPropertyStore ps);
  [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
  [PreserveSig] int GetState(out int s); }
[StructLayout(LayoutKind.Sequential)] struct PKEY { public Guid fmt; public int pid; }
[StructLayout(LayoutKind.Sequential)] struct PVAR { public ushort vt, r1, r2, r3; public IntPtr p, p2; }
[Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPropertyStore {
  [PreserveSig] int GetCount(out int c); [PreserveSig] int GetAt(int i, out PKEY k);
  [PreserveSig] int GetValue(ref PKEY k, out PVAR v); }
[ComImport, Guid("870af99c-171d-4f9e-af0d-e63df40c2bc9")] class PolicyConfigCo {}
[Guid("f8679f50-850a-41cf-9c72-430f290290c8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPolicyConfig {
  [PreserveSig] int GetMixFormat(); [PreserveSig] int GetDeviceFormat(); [PreserveSig] int ResetDeviceFormat();
  [PreserveSig] int SetDeviceFormat(); [PreserveSig] int GetProcessingPeriod(); [PreserveSig] int SetProcessingPeriod();
  [PreserveSig] int GetShareMode(); [PreserveSig] int SetShareMode(); [PreserveSig] int GetPropertyValue(); [PreserveSig] int SetPropertyValue();
  [PreserveSig] int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string id, int role); }
public static class Spk {
  static IMMDeviceEnumerator E() { return (IMMDeviceEnumerator)(new MMDeviceEnumeratorCo()); }
  static string Name(IMMDevice d) {
    try { IPropertyStore ps; d.OpenPropertyStore(0, out ps);
      PKEY k = new PKEY(); k.fmt = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"); k.pid = 14;
      PVAR v; ps.GetValue(ref k, out v); return v.p == IntPtr.Zero ? "" : Marshal.PtrToStringUni(v.p); } catch { return ""; } }
  // Active speakers/headphones as "id|name".
  public static List<string> Outputs() {
    var l = new List<string>(); IMMDeviceCollection c; E().EnumAudioEndpoints(0, 1, out c);
    int n; c.GetCount(out n); for (int i = 0; i < n; i++) { IMMDevice d; c.Item(i, out d); string id; d.GetId(out id); l.Add(id + "|" + Name(d)); }
    return l; }
  public static string Current() { IMMDevice d; if (E().GetDefaultAudioEndpoint(0, 1, out d) != 0 || d == null) return "|"; string id; d.GetId(out id); return id + "|" + Name(d); }
  public static void Use(string id) { var p = (IPolicyConfig)(new PolicyConfigCo()); for (int r = 0; r < 3; r++) p.SetDefaultEndpoint(id, r); }
}
"@

$cur = [Spk]::Current(); $curId, $curName = $cur.Split('|', 2)
$outs = [Spk]::Outputs() | ForEach-Object { $i, $n = $_.Split('|', 2); [pscustomobject]@{ Id = $i; Name = $n } }
$onSpeaker = $curName -like "*$Speaker*"

if ($onSpeaker) {
  # Back to your headset if it's connected; else what you were on before; else any non-speaker device.
  $back = $null
  if ($Headset) { $back = $outs | Where-Object { $_.Name -like "*$Headset*" } | Sort-Object { $_.Name -match 'hands-free' } | Select-Object -First 1 }
  if (-not $back -and (Test-Path $memo)) { $saved = (Get-Content $memo -Raw).Trim(); $back = $outs | Where-Object { $_.Id -eq $saved } | Select-Object -First 1 }
  if (-not $back) { $back = $outs | Where-Object { $_.Name -notlike "*$Speaker*" } | Select-Object -First 1 }
  if ($back) { [Spk]::Use($back.Id); $state = $false; $now = $back.Name } else { $state = $true; $now = $curName }
} else {
  # To the speaker; prefer its stereo endpoint over a "hands-free" one.
  $spk = $outs | Where-Object { $_.Name -like "*$Speaker*" } | Sort-Object { $_.Name -match 'hands-free|headset' } | Select-Object -First 1
  if ($spk) { Set-Content -Path $memo -Value $curId -NoNewline; [Spk]::Use($spk.Id); $state = $true; $now = $spk.Name }
  else { $state = $false; $now = $curName; $missing = $true }   # speaker off or not paired/connected
}

# Tell Binxbar what's playing where (for the button's label).
$widgetRes = Join-Path ([Environment]::ExpandEnvironmentVariables($cfg['WidgetFolder'])) 'resources'
try { if (Test-Path $widgetRes) {
  $j = @{ speaker = [bool]$state; device = "$now"; name = "$Speaker"; missing = [bool]$missing; t = [DateTimeOffset]::Now.ToUnixTimeMilliseconds() } | ConvertTo-Json -Compress
  Set-Content -Path (Join-Path $widgetRes 'speaker.json') -Value $j -Encoding UTF8 } } catch {}
