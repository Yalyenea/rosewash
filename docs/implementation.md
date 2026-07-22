# Rosewash Implementation

Agent-oriented reference for how the extension is built and how data flows.
For a shorter conceptual overview, see [architecture.md](./architecture.md).
For product roadmap, see [PLAN.md](../PLAN.md).

## What it is

Rosewash is a **zero-build Manifest V3** Chromium extension. It covers page
surfaces, text, and neutral borders with Rose Pine Dawn / Moon tokens. There is
no bundler, no runtime npm dependency, and no TypeScript compile step.

Load the repo root (the folder containing `manifest.json`) as an unpacked
extension. Package with `just package` → `.tmp/rosewash.zip`.

## Repository layout

```text
manifest.json              MV3 entry: permissions, content scripts, SW, commands
popup.html + src/popup/    Action popup (enable, mode, site block)
options.html + src/options/ Block-list editor
src/background/            Service worker (keyboard commands)
src/content/
  core.js                  Pure engine + host helpers (testable via vm)
  content.js               Chrome wiring for content world
  theme.css                Immediate CSS cover when data-rosewash-theme is set
test/                      Node tests + HTML fixtures
scripts/validate.mjs       Manifest / file presence / syntax checks
justfile                   test · validate · check · package
```

## Runtime topology

```text
┌─────────────────────┐     chrome.storage.sync      ┌──────────────────────┐
│ popup / options UI  │ ───────────────────────────► │  settings blob       │
└─────────────────────┘                              └──────────┬───────────┘
                                                               │ onChanged
┌─────────────────────┐  commands.onCommand                    │
│ background SW       │ ─── write disabledHosts ───────────────┤
│ (importScripts core)│                                        │
└─────────────────────┘                                        ▼
                                                    ┌──────────────────────┐
                                                    │ content.js per tab   │
                                                    │  → RosewashCore      │
                                                    │  → engine.apply()    │
                                                    │  → theme.css + DOM   │
                                                    └──────────────────────┘
```

| Layer | File(s) | Role |
| --- | --- | --- |
| Manifest | `manifest.json` | Registers scripts, storage, `<all_urls>`, commands |
| Engine | `src/content/core.js` → `globalThis.RosewashCore` | Color parse, cover, restore, host helpers |
| Content bootstrap | `src/content/content.js` | Storage cache, listeners, provisional paint |
| CSS cover | `src/content/theme.css` | First-frame canvas / SPA roots / known shells |
| Background | `src/background/background.js` | `toggle-current-site` command |
| Popup | `src/popup/popup.js` | Daily controls + push message to active tab |
| Options | `src/options/options.js` | Full block list edit |

## Settings schema

Stored in **`chrome.storage.sync`**.

```json
{
  "enabled": true,
  "mode": "auto",
  "disabledHosts": []
}
```

| Field | Values | Meaning |
| --- | --- | --- |
| `enabled` | boolean | Global off clears all tints |
| `mode` | `auto` \| `dawn` \| `moon` | `auto` → Dawn/Moon from `prefers-color-scheme` |
| `disabledHosts` | string[] | Hostnames (and parents) where Rosewash is blocked |

Normalization lives in `RosewashCore.normalizeSettings()`:

- Hosts lowercased, leading dots stripped, deduped, sorted.
- Unknown `mode` falls back to `auto`.
- `enabled !== false` counts as true.

Host matching (`isHostDisabled`): exact match or subdomain of a listed host
(`news.example.com` matches entry `example.com`).

Toggle (`toggleHostDisabled`): remove any list entry that matches the host; if
none matched, append the host. Used by the background command; popup implements
the same algorithm inline.

### Planned shape (not shipped)

```json
{
  "enabled": true,
  "preset": "rose-pine",
  "appearance": "auto",
  "disabledHosts": []
}
```

Presets should resolve through one palette registry before DOM work so new
families (Catppuccin, Nord, …) do not branch inside `processElement`.

## Manifest details

- **MV3**, version must match `package.json` (`scripts/validate.mjs` enforces).
- Permissions: `storage` only; host access via `"host_permissions": ["<all_urls>"]`.
- Content scripts at `document_start`: `theme.css`, then `core.js`, then
  `content.js` (order matters: engine must exist before bootstrap).
- Background service worker: `src/background/background.js`.
- Command `toggle-current-site`: suggested key **`Alt+Shift+B`** (Mac:
  Option+Shift+B). User-rebindable at `chrome://extensions/shortcuts`.

## Content pipeline (critical path)

On every page match, roughly:

1. **CSS inject** (`theme.css`) is available but inactive until
   `html[data-rosewash-theme]` exists.
2. **`paintProvisionalRoot()`** sets `data-rosewash-theme` from system Auto
   preference so theme.css paints the canvas on the first frame.
3. **`applyCachedSettings()`** with in-memory defaults (`enabled: true`,
   `mode: auto`) runs a full engine apply on the (still small) document_start
   DOM — intentional FOUC mitigation; not a blank wait for storage.
4. **`loadSettings()`** reads `chrome.storage.sync`, replaces the cache, re-
   applies (may clear if disabled / blocked host).
5. Later: `storage.onChanged`, `matchMedia` dark changes, `DOMContentLoaded`,
   `load`, `pageshow`, `visibilitychange`, and popup messages all re-apply from
   the **in-page settings cache** (no extra storage read on system theme
   switch).

### Extension context safety

Chrome leaves old content scripts alive after extension reload. Calls into
`chrome.*` then throw `Extension context invalidated`. `content.js`:

- Checks `chrome.runtime.id` before wiring.
- `dispose()` removes listeners and disconnects the observer on failure.
- Does not keep calling storage from a dead context.

### Stale style cleanup

Engine mirrors original inline styles onto `data-rosewash-*` attributes. A new
content-script instance calls `restoreStaleTintedElements()` on first apply so
orphaned tints from a previous extension version do not stick.

Attributes used:

| Attribute | Purpose |
| --- | --- |
| `data-rosewash-theme` | Active theme for CSS (`dawn` / `moon`) |
| `data-rosewash-tinted` | Element was touched by the engine |
| `data-rosewash-had-style` | Had an inline `style` before Rosewash |
| `data-rosewash-original-style` | Snapshot of that original inline style |
| `data-rosewash-ignore` | Opt-out marker (also in `SKIP_SELECTOR`) |

## Engine (`src/content/core.js`)

IIFE that freezes `globalThis.RosewashCore`. Tested by loading the file in a
Node `vm` context (`test/core.test.js`). Arrays returned from the sandbox need
`JSON` round-trip (`plain()`) before `assert.deepEqual` across realms.

### Palettes

| Theme | base | surface | overlay | text | link |
| --- | --- | --- | --- | --- | --- |
| Dawn | `#faf4ed` | `#fffaf3` | `#f2e9de` | `#575279` | `#286983` |
| Moon | `#232136` | `#2a273f` | `#393552` | `#e0def4` | `#9ccfd8` |

Also: `muted` for scrollbar tracks.

### Color parsing

Supports `#rgb` / `#rrggbb` / `#rrggbbaa`, `rgb()` / `rgba()`, and CSS Color 4
`lab()`, `oklab()`, `lch()`, `oklch()` (enough for modern Tailwind output).

Helpers classify near-white, dark surfaces, opaque text, low-chroma borders,
and generated gradients vs `url()` media backgrounds.

### Full-page cover (`processElement`)

For each non-skipped element:

1. **Page chrome** (`header`, `[role=banner]`, top-level `nav`, Zhihu
   `.AppHeader` / `.LeanAppHeaderBar` / `.MobileAppHeader` outside
   `main`/`article`): force `palette.base` + clear generated backgrounds with
   `!important`; descendants get forced text color.
2. **Surfaces**: any opaque background (or CSS gradient) maps via
   `surfaceColorFor` to `base` / `surface` / `overlay`. Transparent
   `html`/`body` still count as the default canvas. `url()` backgrounds are
   left alone.
3. **Text**: opaque colors → `palette.text`; anchors → `palette.link`.
4. **Borders**: low-chroma borders → `palette.overlay`.

Skip list includes media, canvas, SVG, iframe, form controls, code/editor
surfaces (CodeMirror, Monaco, hljs, KaTeX, MathJax), and
`[data-rosewash-ignore]`.

### Root CSS variable remapping

Pseudo-elements cannot take per-element inline tints. The engine rewrites
matching **root** custom properties (ChatGPT `main-surface*`, Substack/theme
`ground` / `ink`, sidebar canvas tokens, …) to palette colors. Include/exclude
regexes live as `SURFACE_VAR_*` / `TEXT_VAR_*` in `core.js`. Overrides are
diffed and restored with the theme.

### MutationObserver

- Observes the document for added nodes.
- Scans **added subtrees only**, not the whole document every time.
- Coalesces to **`requestAnimationFrame`** (not a multi-hundred-ms debounce)
  so SPA navigations (e.g. x.com) cover before the next paint when possible.

### Apply / clear rules

- Disabled or blocked host → `clear()` (restore inline styles, CSS vars, drop
  theme attribute, disconnect observer).
- Theme/mode change → restore previous tints, then full rescan.
- Page-tone re-detect when still `mixed` does **not** full-restore (avoids
  white flash). Full cover no longer depends on page tone for surface choice;
  tone sampling remains for diagnostics / mixed re-detect.

## theme.css

Active only under `html[data-rosewash-theme]`:

- Sets `--rosewash-*` tokens and `color-scheme`.
- Forces `html`/`body` base + body text.
- Covers common SPA roots (`#react-root`, `#root`, `#app`, `#__next`, `main`, …).
- Forces Zhihu header shells and link colors with `!important`.
- Selection and default link colors.

This is the first-frame layer; nested boxes still need the JS engine.

## Background command

`src/background/background.js`:

```text
importScripts("../content/core.js")
→ chrome.commands.onCommand
→ active tab URL → hostFromUrl
→ toggleHostDisabled → chrome.storage.sync.set
```

No direct message to the content script is required; pages listen to
`storage.onChanged`.

## Popup & options

**Popup**

- Reads active tab host; toggles that host in `disabledHosts`.
- On change: write storage + `chrome.tabs.sendMessage` with
  `{ type: "rosewash:settings-updated", settings }` (best-effort; storage
  path still works if the content script is missing).
- Site button title documents `Alt+Shift+B`.

**Options**

- Edit enabled / mode / full host list (one host per line).
- Mentions the site-toggle shortcut.

Host helper logic is duplicated in popup/options (small, no build step to
share modules with HTML pages). Engine + background share `core.js`.

## Messaging contract

| Message type | Direction | Purpose |
| --- | --- | --- |
| `rosewash:settings-updated` | popup → content | Immediate re-apply + `stats` response |

Storage remains the source of truth across tabs and the service worker.

## Testing & packaging

```sh
just test       # node --test test/*.test.js
just validate   # manifest + required files + --check scripts
just check      # test + validate
just package    # check then zip → .tmp/rosewash.zip
```

| Area | How |
| --- | --- |
| Engine unit tests | `test/core.test.js` loads `core.js` in `vm` |
| Browser fixtures | `test/fixtures/*` HTML + runners (manual / scripted) |
| Validate | Requires background SW file, `toggle-current-site` command, storage + `<all_urls>` |

No commit/push automation unless the user asks. Feature work should land on a
branch other than `main`.

## Invariants / design rules

1. **No site-specific rules** until generic cover fails; known chrome classes
   (Zhihu) are narrow exceptions already documented.
2. **Bounded DOM work**: initial scan + added nodes only; no continuous
   `getComputedStyle` loops.
3. **Cache-driven Auto**: system theme flips re-apply from memory, never
   re-read storage in the content script path.
4. **Prefer generic tone + palette registry** over URL allowlists for themes.
5. **No fallback soup**: keep paths explicit; avoid compatibility shims that
   hide real bugs.
6. Temporary artifacts go under **`.tmp/`**.

## Common change recipes

| Goal | Touch |
| --- | --- |
| New palette / mode | `PALETTES`, `theme.css` tokens, popup/options mode UI, `VALID_MODES` |
| New protected widget class | `SKIP_SELECTOR` in `core.js` |
| New design-token names | `SURFACE_VAR_INCLUDE` / `TEXT_VAR_*` + unit tests |
| New page-chrome shell | `PAGE_CHROME_CLASSES` + matching `theme.css` rules if CSS-in-JS |
| New keyboard command | `manifest.json` `commands` + `background.js` handler + validate |
| Settings field | schema in all of: core defaults, content `handleStorageChanged`, popup, options, docs |

## Related docs

- [architecture.md](./architecture.md) — conceptual layers
- [../README.md](../README.md) — install and feature list
- [../PLAN.md](../PLAN.md) — milestones and next work
- [../changelog.md](../changelog.md) — shipped changes
- [../AGENTS.md](../AGENTS.md) — agent entry point for this repo
