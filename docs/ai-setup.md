# AI-assisted setup

**For the human:** open Claude, ChatGPT, Gemini or any AI assistant, attach this file (or paste the link to it), and say:

> Help me set up Binxbar on my PC using this guide. Go one step at a time, and ask me before changing anything.

If your assistant can run commands on your computer (for example Claude with access to your files, Claude Code, or another agent), it can do most of the file editing and checks itself. If it can only chat, it will tell you exactly what to click and type.

---

## Instructions for the AI assistant

You are helping a person install **Binxbar**, a custom iCUE widget for the Corsair Xeneon Edge touchscreen, plus its helper scripts. Assume they are **not technical**: never used GitHub, never edited a config file. Be patient, explain each step in plain words, and go one step at a time. Confirm each step worked before moving on.

### Ground rules
- **Ask before you change anything** on their PC, and say what you're about to do.
- Never ask for or type their passwords, Discord tokens or account details. Nothing in this setup needs them.
- The person must do anything inside **iCUE**, the **Stream Deck app** and **Discord** themselves (or you do it with screen control, if you have it and they agree). You can do everything that's files and commands.
- Everything is per-user. **Nothing needs admin rights.** If something asks for admin, stop and check.
- The full reference is [installation.md](installation.md) and [stream-deck-keys.md](stream-deck-keys.md). This guide is the order to do things in.

### Step 0. Learn their setup (ask these first)
1. Do you have a Corsair Xeneon Edge connected, with iCUE installed? *(Required.)*
2. What mic do you use at your desk? *(Get the name.)*
3. Do you also have a **headset with its own mic** you'd like to switch Discord to when you walk away? → if **no**, they'll turn the **GO MOBILE Button** setting off and skip keys 25–26.
4. Do you use Discord voice? Do you manage a Discord server you'd like to see voice bubbles for?
5. Do you want the brightness controls? *(Needs Twinkle Tray.)*
6. Do you want the radar map? *(Needs a free CARTO key, their own email.)*

Write down the answers; later steps depend on them.

### Step 1. Download and unpack
- Get the latest release from the project's GitHub **Releases** page: the `.icuewidget` file and the `Source code (zip)`.
- Before unzipping: right-click the zip → Properties → **Unblock** → OK (if the checkbox exists).
- Unzip to a permanent folder, e.g. `%USERPROFILE%\Documents\Binxbar`. Remember this path; call it `BINX` below.

*If you can run commands*, this unblocks every file in the folder after unzipping:
```powershell
Get-ChildItem "$env:USERPROFILE\Documents\Binxbar" -Recurse | Unblock-File
```

### Step 2. Install the programs
Check what's already installed, then have them install what's missing:

| Program | Check | Install |
|---|---|---|
| Corsair iCUE 5.52+ | iCUE → Settings → version | corsair.com/icue |
| Elgato Stream Deck app | Start menu → "Stream Deck" | elgato.com/downloads (no hardware needed) |
| Discord desktop app | Start menu → "Discord" | discord.com/download |
| Stream Deck plugin **Discord** (Elgato) | Stream Deck app → right-hand list has a "Discord" section | Stream Deck app → Marketplace → "Discord" → Install, then authorize in Discord |
| Stream Deck plugin **Audio Mute** (Fred Emmott) | right-hand list has "Audio Mute" / Toggle Mute | Marketplace → "Audio Mute" → Install |
| Twinkle Tray *(only for brightness)* | Start menu → "Twinkle Tray" | twinkletray.com, Microsoft Store, or `winget install twinkletray` |

*If you can run commands*, you can check some of these:
```powershell
Test-Path "$env:LOCALAPPDATA\Programs\twinkle-tray\Twinkle Tray.exe"   # Twinkle Tray
Test-Path "$env:APPDATA\Elgato\StreamDeck\Plugins\com.elgato.discord.sdPlugin"            # Discord plugin
Test-Path "$env:APPDATA\Elgato\StreamDeck\Plugins\com.fredemmott.micmutetoggle.sdPlugin"  # Audio Mute plugin
```

### Step 3. Find the exact mic names
They need a short, unique word for each mic.

*If you can run commands:*
```powershell
Get-CimInstance Win32_PnPEntity | Where-Object PNPClass -eq 'AudioEndpoint' | Select-Object -ExpandProperty Name
```
Otherwise: Windows Settings → System → Sound → Input lists them.

From a name like `Microphone (2- Yeti Stereo Microphone)`, a good word is `Yeti` (or `yeti,stereo` for mic-guard). Pick one that matches **only** that mic. Do the same for the headset mic if they're using GO MOBILE (e.g. `Arctis`).

### Step 4. Import the widget (person does this in iCUE)
1. iCUE → Xeneon Edge → **Widgets** → **+** → choose the `.icuewidget` file.
2. Drag **Binxbar** onto the Edge, size **M**, left column.
3. Click the tile and fill in its settings:
   - **Microphone Name Contains** → desk mic word
   - **Tap-to-Mute Device** → *iCUE Widget N* (appears once the Stream Deck app is installed)
   - **Your Discord Name** → their Discord display name
   - **Tap-to-Join Channels** → up to 5 voice channel names, comma separated, in the order of keys 5, 6, 7, 8, 12
   - **GO MOBILE Button** → off if they have no headset mic; otherwise **Mobile Mode Mic Name Contains** → headset word
   - **City**, **Units**, **Radar Map Key** (CARTO key, if they got one)

### Step 5. Stream Deck keys (person does this; you guide)
Stream Deck app → device **iCUE Widget N** → **page 1** → grid is **8 across × 4 down**. Keys are numbered left to right, top to bottom (key 1 top-left, key 9 starts row 2, key 17 row 3, key 25 row 4). Read them one key at a time and confirm each:

| Key | Action | Setting |
|---|---|---|
| 1 | System → Multimedia | Mute |
| 2 | Audio Mute → Toggle Mute | the **desk mic** by name |
| 3 | System → Open | `BINX\edge-display\bright-down.vbs` |
| 4 | Discord → Voice Channel | leave Server on **None (Leave any active channel)** = DISCONNECT |
| 5–8 | Discord → Voice Channel | Server: theirs; channels 1–4 from *Tap-to-Join Channels* |
| 9 | System → Open | `BINX\edge-display\bright-up.vbs` |
| 10 | System → Multimedia | Decrease Volume |
| 11 | System → Multimedia | Increase Volume |
| 12 | Discord → Voice Channel | channel 5 from *Tap-to-Join Channels* |
| 13 | Discord → Stream Toggle | nothing to set |
| 14 | System → Open | `BINX\edge-display\speaker-switch.vbs` *(SPEAKER button; they set `Speaker=` / `Headset=` in `edge-display\speaker-switch.ini`)* |
| 17 | System → Open | `BINX\edge-display\show-player.vbs` |
| 18 | Discord → Set Audio Device | Set Input → **desk mic** |
| 19 | Discord → Video Toggle | nothing (the tile reads its icon) |
| 25 | Discord → Set Audio Device | Set Input → **headset mic** *(GO MOBILE only)* |
| 26 | Audio Mute → Toggle Mute | **headset mic** *(GO MOBILE only)* |

Remind them: keep the Stream Deck app on **page 1**; skip 3/9 without brightness, 14 without a speaker, 25/26 without GO MOBILE, and unused channel keys. Copy-paste (Ctrl+C / Ctrl+V) a finished Voice Channel key to make the others faster.

**Test:** tap the big panel on the Edge → MUTED → tap → LIVE. Join a Discord voice channel → "ON DISCORD". Tap ESCAPE DISCORD → they leave the call.

### Step 6. Configure and start mic-guard (you can do this)
Edit `BINX\mic-guard\mic-guard.ini`:
- `MainMic=` desk mic word(s), comma-separated, lower case is fine
- `LoungeServerId=` the Discord server ID if they want voice bubbles (see Step 8), else leave empty
- Leave `WidgetFolder` as is unless they changed the widget id

Start it, add it to startup, and check the log:
```powershell
wscript "$env:USERPROFILE\Documents\Binxbar\mic-guard\mic-guard.vbs"
wscript "$env:USERPROFILE\Documents\Binxbar\mic-guard\add-to-startup.vbs"
Start-Sleep 5; Get-Content "$env:USERPROFILE\Documents\Binxbar\mic-guard\mic-guard.log" -Tail 10
```
A healthy log shows lines like `unmuted/app ok [Microphone (...) on DISCORD | Discord:1]`. After any ini change: `restart-mic-guard.vbs`.

If `.vbs` files do nothing: Settings → System → Optional features → add **VBSCRIPT**.

### Step 7. Brightness (optional, you can do this)
```powershell
cmd /c "$env:USERPROFILE\Documents\Binxbar\edge-display\list-monitors.bat"
Get-Content "$env:USERPROFILE\Documents\Binxbar\edge-display\monitors.txt"
```
Find the monitor whose name contains `XENEON EDGE` or `CRXED`, copy its ID (a unique tail like `UID12345` is enough) into `edge-display\edge-display.ini` → `MonitorID=`. Test: `wscript BINX\edge-display\set50.vbs` should set the Edge to 50%.

### Step 8. Discord voice bubbles (optional, person does the Discord part)
They need **Manage Server** on the server. Server Settings → **Widget** → **Enable Server Widget** → copy the Server ID → you put it in `mic-guard.ini` `LoungeServerId=` → restart mic-guard. Tell them plainly: with the server widget on, anyone with the server ID can see who's online and in which voice channel.

Check it's working: `BINX`'s widget folder gets a fresh `lounge.json` every 30 s:
```powershell
Get-Item "$env:APPDATA\Corsair\CUE5\html_widgets\com\personal\binxbar\resources\lounge.json" | Select-Object LastWriteTime
```

### Step 9. Radar map key (optional, person signs up)
They sign up with their own email at carto.com/basemaps/apikey and paste the key into the tile's **Radar Map Key** setting. Don't create accounts for them.

### When something's wrong
Use [troubleshooting.md](troubleshooting.md). The most common fixes:
1. Re-pick **Tap-to-Mute Device** in the tile settings.
2. The Stream Deck app isn't on page 1.
3. mic-guard isn't running (check the log's last time).
4. A mic word matches the wrong device. Make it more specific.

When everything works, have them try: tap to mute, the volume bar, double-tapping the music row, the weather → RADAR tab, and (if set up) GO MOBILE.


## Optional extras added in 1.2
- **Screen keys and monitor follow:** have the user set `MonitorID` in `edge-display\edge-display.ini`, then double-click `edge-display\edge-follow.vbs` (it adds itself to startup). See docs/installation.md, "Screen follows your main monitor".
- **Phone:** walk them through docs/phone.md. The Phone Link pairing, Bluetooth PIN, phone permissions and Windows notification settings must be done by the user (they need their phone in hand). You can set `PhoneCalls` / `PhoneAlertsFrom` in `mic-guard.ini`, the Stream Deck keys 15, 16, 20, 21, and run `tools\import-contacts.ps1` on their Google Contacts export.
- **Privacy:** tell the user that contacts, recent calls and alert picks stay on their PC only (docs/privacy.md). Never copy their contacts, numbers or messages anywhere else.
