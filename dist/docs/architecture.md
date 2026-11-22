# Architecture

```
┌───────────── Xeneon Edge (iCUE) ─────────────┐
│  Binxbar widget (HTML/JS inside iCUE)        │
│   • listens to your mic's audio              │──► pure digital silence = muted
│   • presses keys on a virtual Stream Deck    │──► keys do the real work (mute, volume,
│     (8×4, "iCUE Widget N")                   │    brightness, Discord mic/join/stream/leave)
│   • reads the icon of a Discord key          │──► Discord dims its keys when you're not in a call
│   • reads resources/*.json                   │◄── written by mic-guard
│   • iCUE Media plugin                        │──► now playing + play/pause/skip
│   • Open-Meteo, RainViewer, CARTO            │──► weather, radar, map
└──────────────────────────────────────────────┘
mic-guard (PowerShell + C# Core Audio, hidden, event-driven)
   • which mics Discord is capturing from → mic2.json
   • PC volume → vol.json, which app/site is playing → media-src.json
   • your server's Discord widget feed every 30 s → lounge.json
edge-display (Twinkle Tray command line) → brightness, power
```

iCUE's built-in browser can't run programs or reach `localhost`, so the only ways out of the tile are virtual Stream Deck keys and files inside the widget folder.

## Customizing
- **Colors/look:** `widget/styles/hub.css` (later rules win). Mic states are classes on `#modMic`: `state-live`, `state-muted`, `state-nocall`, `state-warn2`, `wrong-mic`, `mobile`.
- **Key positions:** constants at the top of `widget/scripts/mic.js` and `widget/scripts/music.js`.
- **More music sources:** the `SITES` / `APPS` lists in `widget/scripts/music.js`.

## Developing
```
widget/        the iCUE widget (index.html, manifest.json, scripts/, styles/, resources/)
mic-guard/     background mic watcher
edge-display/  Twinkle Tray wrappers, show-player
tools/         build-widget.ps1 (makes the .icuewidget), update-installed-widget.ps1
docs/          screenshots, videos
```
The installed copy lives in `%AppData%\Corsair\CUE5\html_widgets\com\personal\binxbar`. Edit files there (or run `tools/update-installed-widget.ps1`), then change `resources/build.txt`; the tile checks it every 20 s and reloads itself. New internet domains in `manifest.json` only take effect on a fresh import.
