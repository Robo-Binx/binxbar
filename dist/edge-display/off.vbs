Set fso = CreateObject("Scripting.FileSystemObject")
CreateObject("WScript.Shell").Run "wscript.exe """ & fso.GetParentFolderName(WScript.ScriptFullName) & "\edge-display.vbs"" off", 0, False
