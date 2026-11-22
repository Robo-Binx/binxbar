' Binxbar SPEAKER button: flips Windows sound between your headset and your speaker. Settings: speaker-switch.ini
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & here & "\speaker-switch.ps1""", 0, False
