' Stream Deck "Open" can't pass arguments, so each preset is its own tiny file.
Set fso = CreateObject("Scripting.FileSystemObject")
CreateObject("WScript.Shell").Run "wscript.exe """ & fso.GetParentFolderName(WScript.ScriptFullName) & "\edge-display.vbs"" 10", 0, False
