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
- Load unpacked from `dist/` after `just dist` (not the repo root).

## Working rules

- Prefer small, explicit changes. Do not add fallback or compatibility layers
  unless required.
- Avoid unnecessary secondary labels and descriptions. Let the layout do the explaining.
- Treat existing UI and interactions as constraints. Add new functionality within
  the established layout, colors, and control styles. Explain the proposed change
  before reordering, replacing, or removing existing controls.
- Define each control's meaning, scope, effects, and relationships before coding.
- Keep control positions and visibility stable. Avoid making controls appear or
  disappear without a clear need.
- Verify interaction outcomes as well as tests: check affected features, keyboard
  cancellation, and the actual rendered UI against the requested behavior.
- Do not develop on `main`; use a feature/fix branch.
- Do not commit or push unless the user asks.
- After behavior changes: update `changelog.md` and any docs that describe the
  old behavior (`docs/implementation.md`, `docs/architecture.md`, `README.md`
  as needed).
- Run `just check` (tests + validate) before considering work done.
- Put temporary files under `.tmp/`.

## Browser verification

- Use the `kimi-webbridge` skill to connect to the user's Helium browser for
  page inspection and visual verification. This is the preferred browser
  workflow for this project.
- Run `just dist`, reload the unpacked Rosewash extension from `dist/`, then
  refresh the test page so verification uses the current implementation.
- Use Computer Use (`cua_repl`) for Helium's internal pages when WebBridge
  cannot access them. Routine development actions, such as clicking Rosewash's
  Reload button on `chrome://extensions/`, should be completed directly without
  asking the user to repeat them. Verify the reload confirmation in the UI.
- Keep task tabs in one WebBridge session with a descriptive tab group. Leave
  the verified page visible for the user to test, and save screenshots under
  `.tmp/`.
- Before finishing, disconnect browser debugging and verify its indicator is
  gone. Leave the verified page open for the user.
- If WebBridge cannot connect, follow the skill's startup instructions. Stop
  and ask the user if the connection remains blocked after a reasonable retry.

## Dev commands

```sh
just test
just validate
just check
just dist
just package
just clean
```

## Where to edit (quick map)

| Task | Primary files |
| --- | --- |
| Tint / color / DOM cover | `src/content/core.js`, `src/content/theme.css`, `test/core.test.js` |
| Storage / lifecycle / FOUC | `src/content/content.js` |
| Site layouts (X, Zhihu) | `src/sites/`, `src/content/content.js`, popup / options |
| Keyboard shortcuts | `manifest.json`, `src/background/background.js` |
| Popup / site toggle UI | `popup.html`, `src/popup/popup.js` |
| Block list page | `options.html`, `src/options/options.js` |
| Packaging / CI checks | `scripts/validate.mjs`, `justfile`, `manifest.json` |
