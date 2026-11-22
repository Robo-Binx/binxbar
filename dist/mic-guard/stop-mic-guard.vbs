' Stops the running mic guard.
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
For Each p In wmi.ExecQuery("SELECT * FROM Win32_Process WHERE Name='powershell.exe'")
  If Not IsNull(p.CommandLine) Then
    If InStr(LCase(p.CommandLine), "mic-guard.ps1") > 0 Then p.Terminate
  End If
Next
