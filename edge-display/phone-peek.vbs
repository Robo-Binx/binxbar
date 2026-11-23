' Binxbar: reads the caller's name off Phone Link's call pop-up (run by the helper)
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & here & "\phone-action.ps1"" -Action peek", 0, False
