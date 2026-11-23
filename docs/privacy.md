# Privacy: your data stays on your PC

Binxbar is a widget and a few small scripts that run **on your own computer**. There's no Binxbar server, no account, no analytics and no telemetry. Nothing about you is ever sent to the people who make Binxbar.

## What Binxbar keeps, and where

Everything below lives **only on your PC**, in your own Windows user folders, and is **only used by Binxbar** to show things on your Edge:

| What | Where it's kept | Why |
|---|---|---|
| Your settings (mic name, city, Discord names...) | iCUE's own settings for the tile | So the tile knows your mic, your weather city, etc. |
| `mic-guard.ini`, `edge-display.ini`, `speaker-switch.ini` | The folders you unzipped Binxbar into | Your device names, your Discord server ID, your private calendar link |
| `contacts.json` | The widget folder (`%AppData%\Corsair\CUE5\html_widgets\com\personal\binxbar\resources`) | Names and numbers for the PHONE app. You create it yourself with `tools\import-contacts.ps1`. |
| `phone.json`, `phone-who.txt`, `call.json` | The widget folder | Who's calling or texting right now (name only, never the message), and whether a call is going |
| Recent calls, favorites, who can pop up, call/text requests | The widget's own storage inside iCUE (browser local storage) | The PHONE app's RECENT list, ★ and 🔔 |
| `calendar.ics`, `lounge.json`, `mic2.json`, `vol.json`, `media-src.json` | The widget folder | Your calendar copy, who's in your Discord voice channels, mic/volume/music status |
| `*.log` files | Next to each script | So you can see what the helpers did. They never contain message text; the phone log never contains numbers, only digit counts. |

## What goes over the internet

Only these, and only to the service named:
- **Weather and radar:** your city or map position goes to Open-Meteo, RainViewer and CARTO to fetch forecasts and map tiles.
- **Discord voice bubbles (optional):** mic-guard reads your server's public Discord widget feed, which you turn on yourself.
- **Google Calendar (optional):** mic-guard downloads your calendar using the private link you paste in.

Phone calls and texts go through **Microsoft Phone Link** and your phone exactly as they would without Binxbar.

## Removing your data
- Delete `contacts.json` (and any `contacts.csv` export) to remove your contacts.
- Remove the Binxbar tile in iCUE and delete its widget folder to remove everything the tile kept.
- Delete the Binxbar folders you unzipped, and run `mic-guard\remove-from-startup.vbs`. For the Edge helper, delete *Binxbar edge follows monitor* from your Startup folder (`shell:startup`).

## Sharing your setup
If you ever share your Binxbar folder or a fork of this repo, **don't include** your `.ini` files, `contacts.json`, logs or anything in the widget's `resources` folder besides the ones that came with Binxbar. The repo's `.gitignore` already keeps them out of git.
