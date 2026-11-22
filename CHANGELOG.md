# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.1.0] - 2026-11-22

### Added
- **SPEAKER button:** third button under ON and MUTE ALL. One tap moves Windows sound from your headset to a speaker (Bluetooth or wired), the next tap moves it back. Shows HEADSET, or the speaker's name in blue. Set it up in `edge-display/speaker-switch.ini` and Stream Deck key 14.

### Changed
- Bigger top section (mic panel and audio buttons), easier to read at a glance; six buttons, three each side.
- Smaller clock and date; the weather keeps its size.

### Fixed
- **Google Calendar** events now load: mic-guard downloads your calendar's secret iCal link (`CalendarUrl` in `mic-guard.ini`) and the tile reads the local copy. View only.

## [1.0.0] - 2026-11-21

First public release.

### Added
- **Mic panel:** LIVE / MUTED at a glance, tap to mute, Discord call detection (shows ON DISCORD when live or muted in a call).
- **Wrong-mic guard:** warns when Discord captures a different mic, or a second mic stays hot after muting; one-tap fixes.
- **GO MOBILE** (optional): switches Discord's input to a headset mic; the panel follows the headset's mute. Can be hidden in settings.
- **STREAM GAME:** toggles Discord Go Live for the game you're playing; blinks green while live.
- **DISCONNECT DISCORD:** leaves any voice call, DMs included.
- **Voice bubbles:** voice channels with people in them, join alerts, you shown as YOU, the last channel kept for 10 minutes.
- **Tap-to-join:** up to 5 chosen channels can be joined by tapping their bubble.
- **Music row:** now playing from any app in the Windows media flyout, previous / play-pause / next, tap-anywhere volume bar, last played when idle, double-tap to open the player.
- **Weather station:** radar with a 2-hour rain forecast, cloud, wind, pressure and storm layers, city search with an on-screen keyboard.
- **Screen control:** brightness presets and a keyboard on/off key via Twinkle Tray.
- Flip clock, month calendar with Google Calendar (iCal).
- Guides for installation, Stream Deck keys, troubleshooting, architecture, and AI-assisted setup.

[Unreleased]: https://github.com/Robo-Binx/binxbar/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Robo-Binx/binxbar/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Robo-Binx/binxbar/releases/tag/v1.0.0
