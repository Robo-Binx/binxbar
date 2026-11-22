' One-time: start the Binxbar mic guard whenever you log in to Windows (per-user, no admin needed).
Set sh = CreateObject("WScript.Shell")
here = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.RegWrite "HKCU\Software\Microsoft\Windows\CurrentVersion\Run\BinxbarMicGuard", "wscript.exe """ & here & "\mic-guard.vbs""", "REG_SZ"
MsgBox "Binxbar mic guard will now start when you log in.", 64, "Binxbar"
