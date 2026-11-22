# AGENTS.md

Instructions for AI coding agents (Claude, Codex, Copilot and others) working on this repository. Human contributors: see [CONTRIBUTING.md](CONTRIBUTING.md). If you're helping someone **install** Binxbar rather than change it, use [docs/ai-setup.md](docs/ai-setup.md) instead.

## What this is
An iCUE HTML widget for the Corsair Xeneon Edge touchscreen (`widget/`), plus Windows helpers it depends on (`mic-guard/`, `edge-display/`). See [docs/architecture.md](docs/architecture.md) before changing anything.

## Hard constraints
- **The widget is sandboxed.** It cannot spawn processes, read arbitrary files, or reach `localhost`. Network access is limited to the domains in `widget/manifest.json` `permissions`, granted only when the `.icuewidget` is imported.
- **Two ways out of the tile:** pressing keys on the virtual Stream Deck (`window.Binxbar.tapKey(logicalIndex)` in `widget/scripts/mic.js`), and reading JSON files that `mic-guard` writes to `widget/resources/`.
- **Stream Deck layout is a public contract.** The virtual deck is 8 × 4. Logical keys 0–11 map to the left three columns; 12+ fill the right five (`phys()` / `logical()` in `mic.js`). Never renumber existing keys; document any new key in [docs/stream-deck-keys.md](docs/stream-deck-keys.md).
- **No build step, no frameworks.** Plain ES2020 in `widget/scripts/*.js`; styles in `widget/styles/hub.css` are appended layers (later rules win).
- **Settings** are `<meta name="x-icue-property">` tags in `widget/index.html`. Read them with `prop(name)`; handle missing values (settings added to an existing install can be undefined).
- **Windows helpers** are PowerShell launched hidden through `.vbs` wrappers; they must run per-user without admin.

## Privacy rules
Never commit personal data: Discord server IDs, usernames, map keys, calendar links, monitor IDs, device names from a specific machine, or screenshots that show any of these. Defaults in code and docs must be generic (e.g. `CHANGE_ME`, `UID12345`, "Yeti").

## Making a change
1. Keep changes small and focused. Match the existing style.
2. Test what you can: `node --check widget/scripts/*.js`. Visual changes should be checked in a browser against `widget/index.html` with mocked data, and on a real Edge if available.
3. Update docs for any user-visible change, and add an **Unreleased** entry in [CHANGELOG.md](CHANGELOG.md).
4. Package with `tools/build-widget.ps1` (or zip the contents of `widget/`) into `dist/Binxbar-<version>.icuewidget` when cutting a release.

## Writing style for docs
Readers may never have used GitHub. Use short steps, say exactly where to click, explain why a step exists when it isn't obvious, and keep optional features clearly marked as optional.
