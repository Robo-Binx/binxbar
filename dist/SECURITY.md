# Security Policy

## Supported versions
Security fixes go into the latest release only.

| Version | Supported |
|---|---|
| 1.0.x | ✅ |

## Reporting a vulnerability
Please **don't open a public issue** for security problems. Use GitHub's [private vulnerability reporting](https://github.com/Robo-Binx/binxbar/security/advisories/new) instead. Include what's affected, how to reproduce it, and the impact you expect. You'll get a reply as soon as the maintainers can; please give them time to fix it before disclosing publicly.

## What Binxbar touches
Knowing this helps you judge risk:
- **The widget** runs inside iCUE's sandboxed browser and can only reach the domains listed in `widget/manifest.json` (Open-Meteo, RainViewer, CARTO, Google Calendar). It reads and stores small settings in iCUE's local storage.
- **mic-guard** (PowerShell, runs as your user, no admin) reads audio device state, the system volume and window titles, fetches your Discord server's public **Server Widget** feed, and writes small JSON files into the widget folder.
- **edge-display** scripts call Twinkle Tray's command line and bring your music app's window forward.

Nothing is sent anywhere except the weather/map/calendar requests above and the Discord widget feed.

## Keeping your setup private
- Your **CARTO key**, **Google Calendar iCal link** and **Discord server ID** are personal. Keep them in your local settings; don't commit them or paste them in issues.
- Turning on Discord's Server Widget lets anyone with your server ID see who's online and in which voice channel.
