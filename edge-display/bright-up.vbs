' Stream Deck key: one brightness step up (10 / 25 / 50 / 75 / 100).
Set fso = CreateObject("Scripting.FileSystemObject")
CreateObject("WScript.Shell").Run "wscript.exe """ & fso.GetParentFolderName(WScript.ScriptFullName) & "\edge-display.vbs"" up", 0, False
