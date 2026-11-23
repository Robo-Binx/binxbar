' Starts the "Edge follows the main monitor" watcher with no window. Safe to run more than once (only one copy runs).
Set sh = CreateObject("WScript.Shell")
dir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\edge-follow.ps1""", 0, False
