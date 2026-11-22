# Contributing to Binxbar

Thanks for helping. Bug reports, ideas, docs fixes and pull requests are all welcome.

## Reporting a bug
Open an [issue](https://github.com/Robo-Binx/binxbar/issues/new/choose) using the bug template. Please include:
- iCUE and Stream Deck app versions, and Windows version
- what you expected and what happened
- the last 20 lines of `mic-guard/mic-guard.log` if it involves mics, volume or voice bubbles
- a photo or screenshot of the tile if it's visual

**Remove anything personal** before posting: Discord server IDs, map keys, calendar links, usernames.

## Suggesting a feature
Open an issue with the feature template. Say what you want to do at your desk, not just the button you have in mind; there may be a simpler way to fit it on the tile.

## Pull requests
1. Fork the repo and create a branch from `main`.
2. Make your change. Keep it focused: one feature or fix per pull request.
3. Test it on a real Xeneon Edge if you can (see [Developing](docs/architecture.md#developing)). If you can't, say so in the pull request.
4. Update the docs if behavior, settings or Stream Deck keys change, and add a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md).
5. Open the pull request using the template.

## Project conventions
- **No new outside services without a reason.** Each domain the widget talks to must be in `widget/manifest.json` permissions, and iCUE only grants those on a fresh import.
- **The tile can't run programs.** Anything that needs the PC goes through a Stream Deck key or the `mic-guard` helper (see [architecture](docs/architecture.md)).
- **Stream Deck key positions are part of the public setup.** Don't move existing keys; add new ones in free spots and document them in [stream-deck-keys.md](docs/stream-deck-keys.md).
- **Plain JavaScript, no build step.** The widget loads straight from its folder.
- **Write for first-timers.** Docs assume the reader has never used GitHub or edited a config file.

## Using AI assistants
AI-assisted contributions are welcome. Read [AGENTS.md](AGENTS.md) (or hand it to your coding agent), and review what it produces before you open a pull request: you're responsible for the change.

## Code of Conduct
This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.
