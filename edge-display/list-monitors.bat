@echo off
rem Writes every monitor Twinkle Tray can see (with its MonitorID) to monitors.txt next to this file.
"%LocalAppData%\Programs\twinkle-tray\Twinkle Tray.exe" --List > "%~dp0monitors.txt" 2>&1
start "" notepad "%~dp0monitors.txt"
