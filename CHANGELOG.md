# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Coming next
- **TEXTS app:** read and answer texts on the Edge with the keyboard (code included, hidden until it's reliable).
- **One inbox for everything:** messages waiting for a reply from texts, Facebook Messenger, Discord DMs and more, gathered from Windows notifications, with replies sent from Binxbar.

## [1.2.0] - 2026-11-23

### Added
- **Phone calls (Microsoft Phone Link):** incoming calls take over the tile with the caller's name, a soft ringtone, **ANSWER** and **DECLINE**; missed calls show **CALL BACK**. See `docs/phone.md`.
- **Text alerts:** texts from people you choose take over the tile (who it's from, never the message), with **REPLY**.
- **PHONE app:** phone icon left of the clock. **RECENT** calls, **KEYPAD** (spells names too, keyboard works), **CONTACTS** (search box, A–Z jump, ★ favorites, 🔔 per-person text alerts), **MESSAGES** (opens Phone Link). An on-call screen shows **DIALING …**, **ON A CALL** with a timer, and **HANGING UP …**, and closes when the call really ends.
- `tools/import-contacts.ps1`: turns a Google Contacts export into the PHONE app's contact list (kept on your PC only).
- **edge-follow helper:** the Edge turns off and on with your main monitor's own power button and brings its widgets back; **number-pad minus** flips the Edge between Binxbar and the Windows desktop; reports call status to the PHONE app. Starts with Windows.
- **Calendar week view** with a WEEK / MONTH switch (remembers your choice).
- `docs/privacy.md`: everything Binxbar keeps stays on your PC and is only used by Binxbar.

### Changed
- **Portrait support:** with the Edge standing up, the tile uses the full width, the top buttons stack icon over bigger words, and the clock stays on one line.
- Bigger words and icons on the top buttons; every button has the same outline.
- **SPEAKER** button reads *PLAYING HEADSET / SWITCH* (or your speaker's name).
- *DISCONNECT DISCORD* is now **ESCAPE DISCORD**.

### Fixed
- The volume bar could slide your PC volume to 0 when the default output device changed (mic-guard now follows the current device; the tile stops a stuck volume).
- Tap-to-join bubbles did nothing when *Tap-to-Join Channels* was left empty.

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
