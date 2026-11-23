' Closes iCUE and starts it again (used by edge-follow when the widgets don't come back after the screen wakes).
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
For Each p In wmi.ExecQuery("SELECT * FROM Win32_Process WHERE Name='iCUE.exe'")
  p.Terminate
Next
WScript.Sleep 4000
CreateObject("WScript.Shell").Run """C:\Program Files\Corsair\Corsair iCUE5 Software\iCUE.exe"" --autorun", 1, False
