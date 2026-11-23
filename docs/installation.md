# Installation

Plan on 30–45 minutes the first time. Steps 1–4 get the tile working; the rest are optional extras.

> Prefer to have an AI assistant walk you through it? See [AI-assisted setup](ai-setup.md).

## 0. What you need

Everything here is **free**. Windows only (iCUE widgets don't run on Mac).

| # | Program | What it does for Binxbar | Where to get it | Needed? |
|---|---|---|---|---|
| 1 | **Corsair iCUE** (version 5.52 or newer) | Runs the widget on the Edge. Its built-in *Media* plugin feeds the music row. | [corsair.com/icue](https://www.corsair.com/icue) | **Yes** |
| 2 | **Elgato Stream Deck** app | The tile's buttons work by pressing keys on a *virtual* Stream Deck that iCUE creates. **You don't need a real Stream Deck.** | [elgato.com/downloads](https://www.elgato.com/downloads) | **Yes** |
| 3 | **Discord** plugin for Stream Deck (by Elgato) | Tells the tile whether you're in a call, and switches Discord's mic. | Inside the Stream Deck app: **Marketplace** (the shopping-bag icon) → search **Discord** → Install. You'll be asked to authorize it in Discord once. | **Yes** (for anything Discord) |
| 4 | **Audio Mute** plugin for Stream Deck (by Fred Emmott) | Mutes/unmutes a specific mic. That's what tapping the panel does. | Stream Deck **Marketplace** → search **Audio Mute** → Install | **Yes** |
| 5 | **Discord** desktop app | You probably have this. The browser version won't work with the Stream Deck plugin. | [discord.com/download](https://discord.com/download) | **Yes** |
| 6 | **Twinkle Tray** | Changes the Edge's brightness (and can turn it off/on). | [twinkletray.com](https://twinkletray.com), or the Microsoft Store | Only for the brightness swipe |
| 7 | A **free CARTO map key** | The street map under the radar. It's a sign-up, not a program: you get the key by email in about a minute. | [carto.com/basemaps/apikey](https://carto.com/basemaps/apikey/) | Only for the radar map |
| 8 | A music app (Spotify, a browser, VLC…) | Whatever you already use. Anything that shows up in Windows' media pop-up works. | — | Only for the music row |
| 9 | **Microsoft Phone Link** + your phone + Bluetooth on the PC | Calls, call/text alerts and the PHONE app. Phone Link is already in Windows 10/11; the phone gets **Link to Windows**. | Start menu → Phone Link | Only for the phone features |

Already built into Windows, nothing to install: **PowerShell** (runs the helper scripts) and **Windows Script Host** (the `.vbs` files that start them without a window popping up).

---

### 1. Install the widget in iCUE
1. Open **iCUE** → click your **Xeneon Edge** → **Widgets**.
2. Click **+** (import) and pick `Binxbar-x.y.z.icuewidget`.
3. Drag **Binxbar** onto the Edge. It's built for the **M** size in the left column.
4. **Standing the Edge up?** Binxbar works both ways. Set the Edge's orientation to portrait in iCUE's screen settings for the Edge; the tile rearranges itself (buttons stack, the clock stays on one line, the PHONE app fills the tile). Nothing to change in Binxbar.

### 2. Tell it which mic is yours
Click the tile in iCUE to open its settings:

| Setting | What to put |
|---|---|
| **Microphone Name Contains** | One word from your mic's Windows name, e.g. `Yeti`, `Wave`, `HyperX`, `Rode`. Find it in *Windows Settings → System → Sound → Input*. The buttons use this word (`SWITCH TO YETI`). |
| **Tap-to-Mute Device** | The virtual Stream Deck iCUE made, e.g. *iCUE Widget 1*. (Install the Stream Deck app first or this list is empty.) |
| **Mute Sensitivity** | Leave at −81 dB. If the tile says LIVE while you're muted, raise it toward −60. |
| **Your Discord Name** | Your Discord display name. In the voice bubbles you show up as **YOU**. |
| **Tap-to-Join Channels** | Up to 5 voice channel names, comma separated, e.g. `General, Gaming, Music`. Only these bubbles are tappable, in the same order as Stream Deck keys 5–8 and 12 (step 3). |
| **GO MOBILE Button** | Turn **off** if you only have one mic. The button disappears and the mic panel gets the space. |
| **Mobile Mode Mic Name Contains** | (Only if GO MOBILE is on) a word from your headset mic's Windows name, e.g. `Arctis`, `Cloud`. |
| **City**, **Units** | Your weather city and °F/°C. |
| **Radar Map Key** | The CARTO key from the table above. |

### 3. Set up the Stream Deck keys
The tile can't run programs itself (iCUE's sandbox doesn't allow it), so it presses keys on a **virtual Stream Deck** that iCUE creates, and those keys do the work. Follow **[Stream Deck keys](stream-deck-keys.md)** to set up the 8 × 4 grid, then come back here.

### 4. Check it works
- Tap the big mic panel → it should go red **MUTED**, tap again → green **LIVE**.
- Join a Discord voice channel → the small line should say **ON DISCORD**. Leave → **NOT IN DISCORD**.

If it doesn't, see [Troubleshooting](troubleshooting.md).

### 5. Mic guard: wrong-mic warnings, volume, music source, voice bubbles
`mic-guard` is a small background helper (a PowerShell script) that watches your mics and writes little status files the tile reads. Without it the tile still does mute/live, music and weather; with it you also get the wrong-mic warnings, the volume bar, the music source name and the Discord voice bubbles.

1. Open `mic-guard\mic-guard.ini` in Notepad. Set `MainMic=` to your mic's word (several are fine: `yeti,stereo`). Save.
2. Double-click **`mic-guard.vbs`**. Nothing appears; it runs hidden.
3. Double-click **`add-to-startup.vbs`** so it starts every time you log in (just for your Windows user; no admin needed). `remove-from-startup.vbs` undoes it.
4. To see what it's doing, open `mic-guard.log` in the same folder. After changing the ini, run `restart-mic-guard.vbs`.

It doesn't poll or use CPU in the background: it sleeps until Windows reports a mic change.

### 6. Voice bubbles, tap-to-join, stream and ESCAPE DISCORD (optional)
Shows one small bubble per voice channel with people in it (`GENERAL  YOU, ALEX, SAM`), and a *NAME JOINED CHANNEL* bubble when someone hops in. The channel you just left stays as a dimmed bubble for 10 minutes so you can tap back in. Bubbles for your **Tap-to-Join Channels** are tappable: one tap moves you there.

- **STREAM GAME** goes live in your current call with the game Discord sees you playing. It blinks green while you stream; tap again to stop. (Discord pauses a game stream while the game isn't the window in front.)
- **ESCAPE DISCORD** leaves any call, DMs included.

Point the bubbles at **any server where you have Manage Server**:

1. In Discord: Server Settings → **Widget** → turn on **Enable Server Widget**. Copy the **Server ID** shown there.
2. Put it in `mic-guard.ini` → `LoungeServerId=` and run `restart-mic-guard.vbs`.
3. Set **Your Discord Name** in the tile's settings so you show as **YOU**.

> Privacy: with the Server Widget on, anyone who knows your server ID can see who's online and in which voice channel. People set to Invisible don't show. Discord updates the feed about once a minute.

Leave `LoungeServerId` empty to hide the row.

### 7. Brightness and the screen on/off key (needs Twinkle Tray)
Binxbar is a control station, so set up both parts.

**Brightness (swipe the mic panel):**
1. Install [Twinkle Tray](https://twinkletray.com) (free, also in the Microsoft Store).
2. Double-click `edge-display\list-monitors.bat`. It writes `monitors.txt`; find the line with **XENEON EDGE** or **CRXED** and copy its ID (a unique end part like `UID12345` is enough).
3. Paste it into `edge-display\edge-display.ini` → `MonitorID=`.
4. Swipe the mic panel sideways on the Edge and tap a brightness.

**Screen on/off key:** once the Edge is powered off, touching it can't wake it, so give it a key on your keyboard:
1. Open Twinkle Tray → **Settings → Hotkeys** and add a hotkey that turns the Edge's power off and on (for example **Numpad +**). Or quit Twinkle Tray, merge [`docs/twinkle-tray/hotkey-snippet.json`](twinkle-tray/hotkey-snippet.json) into `%AppData%\twinkle-tray\settings.json` using your **full** monitor ID from `monitors.txt`, and start Twinkle Tray again.
2. Press your key: the Edge turns off. Press it again: it comes back.
3. Prefer a macro key or a real Stream Deck? Point it at `edge-display\toggle.vbs` (or `off.vbs` / `on.vbs`). For a macro key, make a shortcut to `wscript.exe "C:\...\edge-display\toggle.vbs"` and launch that.

Just want it dark, not off? Use the 10% preset.

### Screen follows your main monitor, and a key to switch widgets / desktop
`edge-display\edge-follow` is a small hidden helper that adds three things:

1. **The Edge follows your main monitor's power button.** Switch your main monitor off with its own button and Windows loses it; the helper notices within a few seconds and turns the Edge off too (the same way the on/off key does), so your windows don't get dumped onto the Edge. Switch the main monitor back on and the Edge comes back at its last brightness. If iCUE lost the widgets while the screen was off, the helper brings them back by itself (it re-shows them, and restarts iCUE only if it has to).
2. **Number-pad minus (–) flips the Edge between Binxbar and your Windows desktop.** It sits right above **Number-pad +** (on/off, from step 7), so the two Edge keys are together. Num Lock stays a normal key. While the helper runs, number-pad minus is used only for this (it no longer types a "–").
3. **Call status for the PHONE app** (see [Phone](phone.md)).

Setup: make sure `edge-display\edge-display.ini` has your `MonitorID` (step 7), then double-click **`edge-display\edge-follow.vbs`** once. Nothing appears. It adds itself to your Windows startup (a small launcher in `shell:startup` named *Binxbar edge follows monitor*; delete it there to stop it). Its log is `edge-display\edge-follow.log`.

> Works with monitors that disappear from Windows when switched off (most DisplayPort and many HDMI monitors). If yours stays "connected" while off, the helper can't tell, and you'll just use the on/off key.

### Phone: calls, alerts and the PHONE app (optional)
Link your phone with Microsoft Phone Link, then follow **[docs/phone.md](phone.md)**: Bluetooth calls, notifications, `PhoneCalls` / `PhoneAlertsFrom` in `mic-guard.ini`, Stream Deck keys 15, 16, 20, 21 and importing your contacts.

> 🔒 Everything Binxbar keeps for this (contacts, recent calls, who can pop up) stays **on your PC** and is only used by Binxbar. See [privacy.md](privacy.md).

### Google Calendar (optional, view only)
Tap the date on the clock to open the month calendar. To show your events on it:
1. Open Google Calendar on the web → ⚙️ **Settings** → click your calendar on the left → **Integrate calendar**.
2. Copy **Secret address in iCal format** (it ends in `basic.ics`). No Google account sign-in, API key or token is needed.
3. Paste it into `mic-guard\mic-guard.ini` after `CalendarUrl=`, save, and run `restart-mic-guard.vbs`. **More than one calendar** (yours plus a shared one, say)? Put a space between the links; their events show together.

mic-guard downloads the calendar every 10 minutes into the widget folder; the tile reads that copy (it can't fetch Google directly). **Keep the link private**: anyone who has it can read your calendar. It stays in your local `mic-guard.ini` and is never logged. Adding or editing events from the Edge isn't supported.

### Speaker switch (optional)

The **SPEAKER** button (right side, under MUTE ALL) flips your PC's sound between your headset and a speaker.

1. Open `edge-display\speaker-switch.ini`. Set `Speaker=` to a word from your speaker's name and `Headset=` to a word from your headset's name. Find the names in Windows: **Settings > System > Sound > Output**.
2. In the Stream Deck app, set up key 14 (**System → Open** → `edge-display\speaker-switch.vbs`). See [Stream Deck keys](stream-deck-keys.md).
3. Tap **SPEAKER** on the tile. It turns blue and shows your speaker's name; tap again to go back to **HEADSET**. If the speaker is off or not connected, it shows **NO SPEAKER** and your sound stays where it was.

### 8. Music
Nothing to set up beyond keys 10, 11 and 17. **Double-tap the music row** to bring your music app up on your main monitor. If nothing is open, pressing play starts Spotify and resumes.

### 9. Weather station
Tap the weather → **RADAR**:

| Layer | Shows |
|---|---|
| **RAIN** | The last 30 minutes of real radar, then forecast frames every 15 minutes for the next 2 hours |
| **CLOUDS** | Cloud cover |
| **WIND** | Arrows for direction, colored by speed, plus your spot's speed and gusts |
| **PRESSURE** | Readings across the map with **H** / **L** |
| **STORMS** | Thunderstorm potential |

Drag to pan, **+ / −** or double-tap to zoom, **◎** to recenter, **🔍** to search any city. Radar is from RainViewer, forecasts from Open-Meteo (no keys needed for either).

---
