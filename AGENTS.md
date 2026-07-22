# AGENTS

Guidance for coding agents working in the Rosewash repository.

## Read first

| Doc | When |
| --- | --- |
| **[docs/implementation.md](docs/implementation.md)** | **Current plugin implementation details** (settings, content pipeline, engine, commands, tests). Start here before changing extension behavior. |
| [docs/architecture.md](docs/architecture.md) | Short conceptual layer overview |
| [PLAN.md](PLAN.md) | Roadmap and open milestones |
| [README.md](README.md) | Product summary, install, screenshots |
| [changelog.md](changelog.md) | Keep in sync with user-visible changes |

## Project shape

- Manifest V3 Chromium extension, **no build step**, no runtime dependencies.
- Testable engine: `src/content/core.js` → `globalThis.RosewashCore`.
- Chrome wiring: `src/content/content.js`, `src/background/background.js`, popup, options.
- Load unpacked from the repo root (`manifest.json`).

## Working rules

- Prefer small, explicit changes. Do not add fallback or compatibility layers
  unless required.
- Do not develop on `main`; use a feature/fix branch.
- Do not commit or push unless the user asks.
- After behavior changes: update `changelog.md` and any docs that describe the
  old behavior (`docs/implementation.md`, `docs/architecture.md`, `README.md`
  as needed).
- Run `just check` (tests + validate) before considering work done.
- Put temporary files under `.tmp/`.

## Dev commands

```sh
just test
just validate
just check
just package
```

## Where to edit (quick map)

| Task | Primary files |
| --- | --- |
| Tint / color / DOM cover | `src/content/core.js`, `src/content/theme.css`, `test/core.test.js` |
| Storage / lifecycle / FOUC | `src/content/content.js` |
| Keyboard shortcuts | `manifest.json`, `src/background/background.js` |
| Popup / site toggle UI | `popup.html`, `src/popup/popup.js` |
| Block list page | `options.html`, `src/options/options.js` |
| Packaging / CI checks | `scripts/validate.mjs`, `justfile`, `manifest.json` |
