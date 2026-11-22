# Binxbar mic guard. Runs hidden in the background (no polling loop):
#  - wakes when your main mic is muted/unmuted, or when any app starts using a mic (e.g. joining a Discord call)
#  - checks which mics Discord is listening through and writes resources\mic2.json for the Binxbar tile
#  - a quick double flip of your main mic's mute (sent by the tile's buttons) means "fix it":
#      main mic muted -> mute the other mic Discord hears;  main mic live -> make main mic the Windows default
# Settings: mic-guard.ini.  Log: mic-guard.log.
$cs = @'
using System; using System.IO; using System.Text; using System.Threading; using System.Diagnostics;
using System.Collections.Generic; using System.Runtime.InteropServices; using System.Net; using System.Text.RegularExpressions;

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
[Guid("657804FA-D6AD-4496-8A60-352752AF4F89"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioEndpointVolumeCallback { [PreserveSig] int OnNotify(IntPtr data); }
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  [PreserveSig] int RegisterControlChangeNotify(IAudioEndpointVolumeCallback cb);
  [PreserveSig] int UnregisterControlChangeNotify(IAudioEndpointVolumeCallback cb);
  [PreserveSig] int GetChannelCount(out int n);
  [PreserveSig] int SetMasterVolumeLevel(float f, ref Guid g);
  [PreserveSig] int SetMasterVolumeLevelScalar(float f, ref Guid g);
  [PreserveSig] int GetMasterVolumeLevel(out float f);
  [PreserveSig] int GetMasterVolumeLevelScalar(out float f);
  [PreserveSig] int SetChannelVolumeLevel(int c, float f, ref Guid g);
  [PreserveSig] int SetChannelVolumeLevelScalar(int c, float f, ref Guid g);
  [PreserveSig] int GetChannelVolumeLevel(int c, out float f);
  [PreserveSig] int GetChannelVolumeLevelScalar(int c, out float f);
  [PreserveSig] int SetMute(int m, ref Guid g);
  [PreserveSig] int GetMute(out int m); }
[Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionManager2 {
  [PreserveSig] int GetAudioSessionControl(IntPtr g, int f, out IntPtr c);
  [PreserveSig] int GetSimpleAudioVolume(IntPtr g, int f, out IntPtr v);
  [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator e);
  [PreserveSig] int RegisterSessionNotification(IAudioSessionNotification n);
  [PreserveSig] int UnregisterSessionNotification(IAudioSessionNotification n); }
[Guid("641DD20B-4D41-49CC-ABA3-174B9477BB08"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioSessionNotification { [PreserveSig] int OnSessionCreated(IntPtr s); }
[Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionEnumerator {
  [PreserveSig] int GetCount(out int n);
  [PreserveSig] int GetSession(int i, [MarshalAs(UnmanagedType.IUnknown)] out object s); }
[Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionControl2 {
  [PreserveSig] int GetState(out int s);
  [PreserveSig] int GetDisplayName(out IntPtr n);
  [PreserveSig] int SetDisplayName(IntPtr n, IntPtr g);
  [PreserveSig] int GetIconPath(out IntPtr p);
  [PreserveSig] int SetIconPath(IntPtr p, IntPtr g);
  [PreserveSig] int GetGroupingParam(out Guid g);
  [PreserveSig] int SetGroupingParam(ref Guid g, IntPtr c);
  [PreserveSig] int RegisterAudioSessionNotification(IntPtr n);
  [PreserveSig] int UnregisterAudioSessionNotification(IntPtr n);
  [PreserveSig] int GetSessionIdentifier(out IntPtr s);
  [PreserveSig] int GetSessionInstanceIdentifier(out IntPtr s);
  [PreserveSig] int GetProcessId(out uint pid); }

[ComImport, Guid("870af99c-171d-4f9e-af0d-e63df40c2bc9")] class PolicyConfigCo {}
[Guid("f8679f50-850a-41cf-9c72-430f290290c8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPolicyConfig {
  [PreserveSig] int GetMixFormat(); [PreserveSig] int GetDeviceFormat(); [PreserveSig] int ResetDeviceFormat();
  [PreserveSig] int SetDeviceFormat(); [PreserveSig] int GetProcessingPeriod(); [PreserveSig] int SetProcessingPeriod();
  [PreserveSig] int GetShareMode(); [PreserveSig] int SetShareMode(); [PreserveSig] int GetPropertyValue(); [PreserveSig] int SetPropertyValue();
  [PreserveSig] int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string id, int role); }

[ComVisible(true)]
public class MuteCb : IAudioEndpointVolumeCallback {
  public int OnNotify(IntPtr data) {
    try { int m = Marshal.ReadInt32(data, 16); if (m != MicGuard.lastMute) {
        DateTime now = DateTime.Now;
        // Binxbar buttons flip the main mic's mute twice quickly: that's a "fix it" request.
        if ((now - MicGuard.lastFlip).TotalMilliseconds < 1500 && m == MicGuard.beforeFlip) { MicGuard.cmdPending = true; MicGuard.lastFlip = DateTime.MinValue; }
        else { MicGuard.beforeFlip = MicGuard.lastMute; MicGuard.lastFlip = now; }
        MicGuard.lastMute = m; MicGuard.ev.Set(); } } catch {}
    return 0; } }

[ComVisible(true)]
public class SessionCb : IAudioSessionNotification {
  public int OnSessionCreated(IntPtr s) { MicGuard.ev.Set(); return 0; } }

[ComVisible(true)]
public class VolCb : IAudioEndpointVolumeCallback {
  public int OnNotify(IntPtr data) {
    try { int m = Marshal.ReadInt32(data, 16); float v = BitConverter.ToSingle(BitConverter.GetBytes(Marshal.ReadInt32(data, 20)), 0);
      MicGuard.WriteVol(v, m != 0); } catch {}
    return 0; } }

public static class Win {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder sb, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid); }

public static class MicGuard {
  static SessionCb scb = new SessionCb();
  static Dictionary<string, object> sesRegs = new Dictionary<string, object>();
  static void EnsureSessionRegs() {
    try { foreach (var d in Mics()) { string id; d.GetId(out id); if (sesRegs.ContainsKey(id)) continue;
        object o; d.Activate(ref IID_SES, 23, IntPtr.Zero, out o); var m = (IAudioSessionManager2)o;
        IAudioSessionEnumerator se; m.GetSessionEnumerator(out se);
        m.RegisterSessionNotification(scb); sesRegs[id] = m; Log("listening for apps on " + Name(d)); } }
    catch (Exception e) { Log("session hook failed: " + e.Message); } }
  public static AutoResetEvent ev = new AutoResetEvent(false);
  public static volatile int lastMute = -1;
  public static volatile bool cmdPending = false; public static int beforeFlip = -1; public static DateTime lastFlip = DateTime.MinValue;
  // Context-aware fix: main mic muted -> mute the other mic Discord hears; main mic live -> make it the default mic.
  static void Fix() {
    cmdPending = false; Log("button: fix requested (main mic " + (lastMute != 0 ? "muted" : "live") + ")");
    if (lastMute != 0) MuteOthers(); else SwitchToMain(); }
  static string outPath, logPath; static string[] mainNames;
  static Mutex mtx; static IAudioEndpointVolume reg; static string regId; static MuteCb cb = new MuteCb();
  static Guid IID_VOL = new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");
  static Guid IID_SES = new Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F");

  static void Log(string s) {
    try { if (File.Exists(logPath) && new FileInfo(logPath).Length > 300000) File.Delete(logPath);
      File.AppendAllText(logPath, DateTime.Now.ToString("MM-dd HH:mm:ss") + "  " + s + "\r\n"); } catch {} }
  static IMMDeviceEnumerator Enum() { return (IMMDeviceEnumerator)(new MMDeviceEnumeratorCo()); }
  static string Name(IMMDevice d) {
    try { IPropertyStore ps; d.OpenPropertyStore(0, out ps);
      PKEY k = new PKEY(); k.fmt = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"); k.pid = 14;
      PVAR v; ps.GetValue(ref k, out v); return v.p == IntPtr.Zero ? "?" : Marshal.PtrToStringUni(v.p); } catch { return "?"; } }
  static bool IsMain(string n) { n = n.ToLowerInvariant(); foreach (var m in mainNames) if (m.Length > 0 && n.Contains(m)) return true; return false; }
  static string Esc(string s) { return s.Replace("\\", "\\\\").Replace("\"", "'"); }

  static List<IMMDevice> Mics() {
    var l = new List<IMMDevice>(); IMMDeviceCollection c; Enum().EnumAudioEndpoints(1, 1, out c);
    int n; c.GetCount(out n); for (int i = 0; i < n; i++) { IMMDevice d; c.Item(i, out d); l.Add(d); } return l; }

  static void EnsureReg() {
    try {
      if (reg != null) { IMMDevice d; int st = 0;
        if (Enum().GetDevice(regId, out d) == 0 && d != null) d.GetState(out st);
        if (st == 1) return;
        try { reg.UnregisterControlChangeNotify(cb); } catch {} reg = null; Log("main mic went away"); }
      foreach (var d in Mics()) { string nm = Name(d); if (!IsMain(nm)) continue;
        object o; d.Activate(ref IID_VOL, 23, IntPtr.Zero, out o); var v = (IAudioEndpointVolume)o;
        int m; v.GetMute(out m); lastMute = m; v.RegisterControlChangeNotify(cb); reg = v; d.GetId(out regId);
        Log("watching " + nm + (m != 0 ? " (muted)" : " (live)")); return; }
    } catch (Exception e) { Log("register failed: " + e.Message); } }

  static object lk = new object();
  static bool Check(string why) { lock (lk) { return CheckInner(why); } }
  static bool CheckInner(string why) {
    bool mainMuted = false; var live = new List<string>(); var used = new List<string>(); var sb = new StringBuilder();
    try {
      foreach (var d in Mics()) {
        string nm = Name(d); int m = 0; bool disc = false; string who = "";
        try { object o; d.Activate(ref IID_VOL, 23, IntPtr.Zero, out o); ((IAudioEndpointVolume)o).GetMute(out m); } catch {}
        try { object o; d.Activate(ref IID_SES, 23, IntPtr.Zero, out o); IAudioSessionEnumerator se;
          ((IAudioSessionManager2)o).GetSessionEnumerator(out se); int n; se.GetCount(out n);
          for (int i = 0; i < n; i++) { object so; se.GetSession(i, out so); var s2 = so as IAudioSessionControl2; if (s2 == null) continue;
            uint pid; int st; s2.GetProcessId(out pid); s2.GetState(out st); string pn = "?";
            try { pn = Process.GetProcessById((int)pid).ProcessName; } catch {}
            who += pn + ":" + st + " ";
            if (st == 1 && pn.StartsWith("Discord", StringComparison.OrdinalIgnoreCase)) disc = true; } } catch {}
        bool main = IsMain(nm); if (main && m != 0) mainMuted = true;
        if (!main && disc && m == 0) live.Add(nm);
        if (disc) used.Add(nm + (main ? "|main" : "") + (m != 0 ? "|muted" : ""));
        sb.Append("[" + nm + (m != 0 ? " muted" : " on") + (disc ? " DISCORD" : "") + " | " + who.Trim() + "] "); }
    } catch (Exception e) { sb.Append("error " + e.Message); }
    bool warn = mainMuted && live.Count > 0;
    var js = new StringBuilder("{\"t\":" + (long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalMilliseconds +
      ",\"mainMuted\":" + (mainMuted ? "true" : "false") + ",\"live\":[");
    for (int i = 0; i < live.Count; i++) js.Append((i > 0 ? "," : "") + "\"" + Esc(live[i]) + "\"");
    js.Append("],\"discord\":[");
    for (int i = 0; i < used.Count; i++) js.Append((i > 0 ? "," : "") + "\"" + Esc(used[i]) + "\"");
    js.Append("]}");
    try { File.WriteAllText(outPath + ".tmp", js.ToString()); File.Copy(outPath + ".tmp", outPath, true); File.Delete(outPath + ".tmp"); } catch (Exception e) { Log("write failed: " + e.Message); }
    Log(why + (warn ? "  WARN " : "  ok ") + sb.ToString());
    return warn; }

  // Make the main mic the Windows default mic (Discord follows it when its input is "Default").
  static string SwitchToMain() {
    string done = "none";
    try { foreach (var d in Mics()) { string nm = Name(d); if (!IsMain(nm)) continue;
        string id; d.GetId(out id); var pc = (IPolicyConfig)(new PolicyConfigCo());
        for (int r = 0; r < 3; r++) pc.SetDefaultEndpoint(id, r); done = nm; break; } }
    catch (Exception e) { Log("switch failed: " + e.Message); }
    Log("button: default mic -> " + done);
    Thread.Sleep(2500); Check("after switch"); return done; }
  static string MuteOthers() {
    var done = new List<string>();
    try { foreach (var d in Mics()) { string nm = Name(d); if (IsMain(nm)) continue;
        bool disc = false;
        try { object o; d.Activate(ref IID_SES, 23, IntPtr.Zero, out o); IAudioSessionEnumerator se;
          ((IAudioSessionManager2)o).GetSessionEnumerator(out se); int n; se.GetCount(out n);
          for (int i = 0; i < n; i++) { object so; se.GetSession(i, out so); var s2 = so as IAudioSessionControl2; if (s2 == null) continue;
            uint pid; int st; s2.GetProcessId(out pid); s2.GetState(out st); string pn = "?";
            try { pn = Process.GetProcessById((int)pid).ProcessName; } catch {}
            if (st == 1 && pn.StartsWith("Discord", StringComparison.OrdinalIgnoreCase)) disc = true; } } catch {}
        if (!disc) continue;
        object v; d.Activate(ref IID_VOL, 23, IntPtr.Zero, out v); Guid g = Guid.Empty;
        ((IAudioEndpointVolume)v).SetMute(1, ref g); done.Add(nm); } }
    catch (Exception e) { Log("mute2 failed: " + e.Message); }
    Log("button: muted " + (done.Count > 0 ? string.Join(", ", done) : "nothing"));
    Check("after mute2"); return done.Count.ToString(); }


  // ---- Extras for the Binxbar tile: PC volume, music source, Discord voice feed ----
  static string resDir; static string loungeId = ""; static IAudioEndpointVolume outVol; static string outId; static VolCb vcb = new VolCb();
  static object wlk = new object();
  static void WriteRes(string name, string text) {
    lock (wlk) { try { string f = Path.Combine(resDir, name); File.WriteAllText(f + ".tmp", text); File.Copy(f + ".tmp", f, true); File.Delete(f + ".tmp"); } catch {} } }
  public static void WriteVol(float v, bool muted) {
    WriteRes("vol.json", "{\"t\":" + (long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalMilliseconds + ",\"v\":" + (int)Math.Round(v * 100) + ",\"m\":" + (muted ? "true" : "false") + "}"); }
  static void EnsureOutVol() {
    try { IMMDevice d; if (Enum().GetDefaultAudioEndpoint(0, 1, out d) != 0 || d == null) return;
      string id; d.GetId(out id); if (id == outId && outVol != null) return;
      if (outVol != null) { try { outVol.UnregisterControlChangeNotify(vcb); } catch {} }
      object o; d.Activate(ref IID_VOL, 23, IntPtr.Zero, out o); outVol = (IAudioEndpointVolume)o; outId = id;
      outVol.RegisterControlChangeNotify(vcb);
      float v; int m; outVol.GetMasterVolumeLevelScalar(out v); outVol.GetMute(out m); WriteVol(v, m != 0);
      Log("watching volume on " + Name(d)); } catch (Exception e) { Log("volume hook failed: " + e.Message); } }
  static string lastSrc = "";
  static void MediaSourceLoop() {
    string[] names = { "spotify", "chrome", "msedge", "firefox", "opera", "brave", "vivaldi", "arc", "vlc", "itunes", "applemusic", "tidal", "deezer", "amazon music", "foobar2000", "musicbee", "winamp", "aimp", "soundcloud", "youtube music" };
    while (true) {
      try { var sb = new StringBuilder("{\"w\":[");  bool first = true; var t = new StringBuilder(512);
        Win.EnumWindows((h, l) => { if (!Win.IsWindowVisible(h)) return true; t.Clear(); Win.GetWindowText(h, t, 512); string title = t.ToString(); if (title.Length < 2) return true;
          uint pid; Win.GetWindowThreadProcessId(h, out pid); string pn = ""; try { pn = Process.GetProcessById((int)pid).ProcessName.ToLowerInvariant(); } catch { return true; }
          foreach (var n in names) if (pn.StartsWith(n)) { sb.Append((first ? "" : ",") + "{\"p\":\"" + Esc(pn) + "\",\"t\":\"" + Esc(title).Replace("\r", " ").Replace("\n", " ") + "\"}"); first = false; break; }
          return true; }, IntPtr.Zero);
        sb.Append("]}"); string js = sb.ToString(); if (js != lastSrc) { lastSrc = js; WriteRes("media-src.json", js); } } catch {}
      Thread.Sleep(3000); } }
  static void LoungeLoop() {
    ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072;  // TLS 1.2
    string url = "https://discord.com/api/guilds/" + loungeId + "/widget.json";
    while (true) {
      try { using (var wc = new WebClient()) { wc.Encoding = Encoding.UTF8; wc.Headers.Add("User-Agent", "Binxbar/1.0");
          string raw = wc.DownloadString(url);
          WriteRes("lounge.json", "{\"t\":" + (long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalMilliseconds + ",\"data\":" + raw + "}"); } }
      catch (Exception e) { Log("lounge fetch failed: " + e.Message); }
      Thread.Sleep(30000); } }
  // Google Calendar (view only): download your secret iCal link(s) every 10 minutes into resources/calendar.ics.
  // Several calendars (e.g. yours and a shared one) are separated by spaces; their events are merged.
  // The tile can't fetch Google directly (blocked by the browser), so it reads this local copy.
  // The links themselves are never logged.
  static string calUrl = "";
  static void CalendarLoop() {
    ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072;  // TLS 1.2
    string[] urls = calUrl.Split(new[] { ' ', ',', ';', '\t' }, StringSplitOptions.RemoveEmptyEntries);
    while (true) {
      var all = new StringBuilder(); int ok = 0;
      for (int i = 0; i < urls.Length; i++) {
        try { using (var wc = new WebClient()) { wc.Encoding = Encoding.UTF8; wc.Headers.Add("User-Agent", "Binxbar/1.0");
            string ics = wc.DownloadString(Regex.Replace(urls[i], "^webcal:", "https:", RegexOptions.IgnoreCase));
            if (ics.Contains("BEGIN:VCALENDAR")) { all.AppendLine(ics); ok++; } else Log("calendar " + (i + 1) + ": link didn't return a calendar"); } }
        catch (Exception e) { Log("calendar " + (i + 1) + " fetch failed: " + (e is WebException ? ((WebException)e).Status.ToString() : e.GetType().Name)); } }
      if (ok > 0) WriteRes("calendar.ics", all.ToString());
      Thread.Sleep(600000); } }
  static void StartExtras(string outFile, string lounge, string cal) {
    resDir = Path.GetDirectoryName(outFile); loungeId = (lounge ?? "").Trim(); calUrl = (cal ?? "").Trim();
    EnsureOutVol();
    var a = new Thread(MediaSourceLoop); a.IsBackground = true; a.Start();
    if (loungeId.Length > 0) { var b = new Thread(LoungeLoop); b.IsBackground = true; b.Start(); Log("lounge feed on for server " + loungeId); }
    if (calUrl.Length > 0) { var c = new Thread(CalendarLoop); c.IsBackground = true; c.Start(); Log("calendar sync on (" + calUrl.Split(new[] { ' ', ',', ';', '\t' }, StringSplitOptions.RemoveEmptyEntries).Length + " calendar(s))"); } }
  public static void Run(string outFile, string logFile, string names, string lounge, string cal) {
    outPath = outFile; logPath = logFile; mainNames = names.ToLowerInvariant().Split(',');
    bool created; mtx = new Mutex(true, "BinxbarMicGuard", out created);
    if (!created) { return; }
    Log("started"); StartExtras(outFile, lounge, cal); EnsureReg(); EnsureSessionRegs(); bool w0 = Check("startup"); while (w0) { if (ev.WaitOne(3000)) { ev.Set(); break; } w0 = Check("recheck"); }
    while (true) {
      if (!ev.WaitOne(60000)) { EnsureReg(); EnsureSessionRegs(); EnsureOutVol(); continue; }
      Thread.Sleep(1600); if (cmdPending) { Fix(); ev.Reset(); }
      bool warn = false, again = false;
      foreach (int w in new int[] { 400, 1600, 3000 }) { if (ev.WaitOne(w)) { again = true; break; } warn = Check(lastMute != 0 ? "muted" : "unmuted/app"); }
      if (again) { ev.Set(); continue; }
      while (warn) { if (ev.WaitOne(3000)) { ev.Set(); break; } warn = Check("recheck"); }
    }
  } }
'@
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
# Settings live in mic-guard.ini next to this script.
$cfg = @{ MainMic = 'CHANGE_ME'; WidgetFolder = '%APPDATA%\Corsair\CUE5\html_widgets\com\personal\binxbar'; LoungeServerId = ''; CalendarUrl = '' }
$ini = Join-Path $here 'mic-guard.ini'
if (Test-Path $ini) { foreach ($line in Get-Content $ini) {
    if ($line -match '^\s*([A-Za-z]+)\s*=\s*(.+?)\s*$' -and $line -notmatch '^\s*;') { $cfg[$matches[1]] = $matches[2] } } }
$widget = [Environment]::ExpandEnvironmentVariables($cfg['WidgetFolder'])
$out  = Join-Path $widget 'resources\mic2.json'
try {
  Add-Type -TypeDefinition $cs -Language CSharp -IgnoreWarnings
  [MicGuard]::Run($out, (Join-Path $here 'mic-guard.log'), $cfg['MainMic'], $cfg['LoungeServerId'], $cfg['CalendarUrl'])
} catch { Add-Content (Join-Path $here 'mic-guard.log') ("crash: " + $_) }
