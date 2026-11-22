' Starts the Binxbar mic guard hidden. Double-click to start it now.
Set sh = CreateObject("WScript.Shell")
here = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -MTA -WindowStyle Hidden -File """ & here & "\mic-guard.ps1""", 0, False
