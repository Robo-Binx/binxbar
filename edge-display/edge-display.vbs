' Binxbar screen control. Usage: wscript edge-display.vbs <10-100 | off | on | toggle>
' Reads edge-display.ini (MonitorID, TwinkleTray). Remembers the last level and on/off state.
Option Explicit
Dim fso, sh, here, cfg, tt, mon, arg, lvl, state, line, k, v
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
here = fso.GetParentFolderName(WScript.ScriptFullName) & "\"
Set cfg = CreateObject("Scripting.Dictionary")
If fso.FileExists(here & "edge-display.ini") Then
  Dim f : Set f = fso.OpenTextFile(here & "edge-display.ini")
  Do Until f.AtEndOfStream
    line = Trim(f.ReadLine)
    If Len(line) > 0 And Left(line, 1) <> ";" And InStr(line, "=") > 0 Then
      k = Trim(Left(line, InStr(line, "=") - 1)) : v = Trim(Mid(line, InStr(line, "=") + 1))
      cfg(k) = sh.ExpandEnvironmentStrings(v)
    End If
  Loop
  f.Close
End If
mon = cfg("MonitorID") : tt = """" & cfg("TwinkleTray") & """"
If mon = "" Or mon = "PUT_YOUR_EDGE_ID_HERE" Then
  MsgBox "Set MonitorID in edge-display.ini first (run list-monitors.bat to find it).", 48, "Binxbar"
  WScript.Quit 1
End If
If WScript.Arguments.Count = 0 Then WScript.Quit 1
arg = LCase(WScript.Arguments(0))
lvl = "75" : If fso.FileExists(here & "level.txt") Then lvl = Trim(fso.OpenTextFile(here & "level.txt").ReadLine)
state = "on" : If fso.FileExists(here & "state.txt") Then state = Trim(fso.OpenTextFile(here & "state.txt").ReadLine)
If arg = "up" Or arg = "down" Then        ' step through the presets 10 / 25 / 50 / 75 / 100
  Dim steps, i, cur : steps = Array(10, 25, 50, 75, 100) : cur = 2
  For i = 0 To 4
    If CInt(lvl) >= steps(i) Then cur = i
  Next
  If arg = "up" And cur < 4 Then cur = cur + 1
  If arg = "down" And cur > 0 Then cur = cur - 1
  arg = CStr(steps(cur))
End If
If arg = "toggle" Then
  If state = "off" Then arg = "on" Else arg = "off"
End If
Select Case arg
  Case "off"
    sh.Run tt & " --MonitorID=""" & mon & """ --VCP=""0xD6:4""", 0, False    ' DDC/CI power: 4 = off/standby
    fso.CreateTextFile(here & "state.txt", True).WriteLine "off"
  Case "on"
    sh.Run tt & " --MonitorID=""" & mon & """ --VCP=""0xD6:1""", 0, False    ' 1 = on
    WScript.Sleep 1500
    sh.Run tt & " --MonitorID=""" & mon & """ --Set=" & lvl, 0, False
    fso.CreateTextFile(here & "state.txt", True).WriteLine "on"
  Case Else
    If IsNumeric(arg) Then
      sh.Run tt & " --MonitorID=""" & mon & """ --Set=" & arg, 0, False
      fso.CreateTextFile(here & "level.txt", True).WriteLine arg
    End If
End Select
