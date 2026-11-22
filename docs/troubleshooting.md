# Troubleshooting

| Problem | Fix |
|---|---|
| Tapping the tile does nothing | Re-pick **Tap-to-Mute Device** in the tile's settings (needed every time you re-add the tile). Make sure the Stream Deck app is on **page 1**. |
| Always says LIVE, even muted | Key 2 has to mute the **device** (Audio Mute plugin), not just Discord. Check *Microphone Name Contains*. Try raising Mute Sensitivity. |
| Always NOT IN DISCORD | The Discord plugin isn't authorized yet: in the Stream Deck app, click key 18 or 19 and follow its *Authorize* prompt (Discord asks you to approve it once). |
| No wrong-mic warnings / volume bar doesn't move / LOUNGE OFFLINE | mic-guard isn't running. Double-click `mic-guard.vbs`, then check `mic-guard.log`. |
| `.vbs` files do nothing at all | Newer Windows 11 builds can have VBScript turned off: Settings → System → **Optional features** → add **VBSCRIPT**. |
| Radar map says API KEY REQUIRED | Add your free CARTO key in **Radar Map Key**. |
| Radar map stays blank after an update | iCUE only grants internet permissions when a widget is **imported**. Import the new `.icuewidget` instead of copying files over. |
| Music row never shows anything | Restart iCUE once after installing (it loads the Media plugin). The player has to show in Windows' media pop-up. |
| Brightness changes the wrong screen | Wrong `MonitorID` in `edge-display.ini`. |
| Tapping a bubble does nothing | Its channel must be in *Tap-to-Join Channels*, spelled like Discord shows it, and its key (5–8, 12) must be a Voice Channel action for that channel. |
| STREAM GAME / DISCONNECT do nothing | Keys 13 / 4, Discord plugin authorized, Stream Deck on page 1. Streaming needs you in a voice call. |
| GO MOBILE says MUTED and won't unmute | Key 26 must be **Audio Mute → Toggle Mute** on the **headset** mic. Unmute the headset once in Windows sound settings. (Some headsets' own mute button isn't visible to Windows; use the tile instead.) |
| Calendar shows no events | Check `CalendarUrl=` in `mic-guard.ini` (the *Secret address in iCal format*, ending in `basic.ics`), run `restart-mic-guard.vbs`, and look in `mic-guard.log` for `calendar sync on`. |

**Updating:** download the new `.icuewidget`, delete the old Binxbar tile from the Edge, import the new file, drag it back on, and re-pick **Tap-to-Mute Device**. Your Stream Deck keys and mic-guard settings stay as they are.

---
