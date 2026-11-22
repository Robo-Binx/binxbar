' Undo add-to-startup.vbs.
On Error Resume Next
CreateObject("WScript.Shell").RegDelete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run\BinxbarMicGuard"
MsgBox "Binxbar mic guard removed from startup.", 64, "Binxbar"
