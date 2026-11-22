' Stops the running mic guard (if any) and starts it again. Use after editing mic-guard.ini or mic-guard.ps1.
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
For Each p In wmi.ExecQuery("SELECT * FROM Win32_Process WHERE Name='powershell.exe'")
  If Not IsNull(p.CommandLine) Then
    If InStr(LCase(p.CommandLine), "mic-guard.ps1") > 0 Then p.Terminate
  End If
Next
WScript.Sleep 1500
here = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "wscript.exe """ & here & "\mic-guard.vbs""", 0, False
