' Opens Phone Link on the Xeneon Edge (over Binxbar) to pair your phone. Close Phone Link when done.
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & here & "\phonelink-on-edge.ps1""", 0, False
