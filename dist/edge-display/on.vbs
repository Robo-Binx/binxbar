Set fso = CreateObject("Scripting.FileSystemObject")
CreateObject("WScript.Shell").Run "wscript.exe """ & fso.GetParentFolderName(WScript.ScriptFullName) & "\edge-display.vbs"" on", 0, False
