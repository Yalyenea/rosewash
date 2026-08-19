# Rosewash Implementation

Agent-oriented reference for how the extension is built and how data flows.
For a shorter conceptual overview, see [architecture.md](./architecture.md).
For product roadmap, see [PLAN.md](../PLAN.md).

## What it is

Rosewash is a **zero-build Manifest V3** Chromium extension. It covers page
surfaces, text, and neutral borders with Rose Pine Dawn / Moon tokens. There is
no bundler, no runtime npm dependency, and no TypeScript compile step.

Stage with `just dist` and load the `dist/` folder as an unpacked extension
(not the repo root). Package with `just package` → `dist/` plus
`.tmp/rosewash.zip`.

## Repository layout

```text
manifest.json              MV3 entry: permissions, content scripts, SW, commands
popup.html + src/popup/    Action popup (enable, appearance, light/dark palettes, site block)
options.html + src/options/ Settings (palettes, appearance, site layouts, block list)
src/background/            Service worker (keyboard commands)
src/shared/pdf-open.js     Pure PDF URL, opener-template, and pending-state helpers
src/content/
  core.js                  Pure engine + host helpers (testable via vm)
  content.js               Chrome wiring for content world
  theme.css                Immediate CSS cover when data-rosewash-theme is set
src/sites/                 Optional site-specific layout runtimes and styles
test/                      Node tests + HTML fixtures
scripts/validate.mjs       Manifest / file presence / syntax checks
justfile                   test · validate · check · dist · package · clean
scripts/release-notes.mjs  GitHub Release notes from the version section in changelog.md
dist/                      Generated loadable extension (`just dist`, gitignored)
```

## Runtime topology

```text
┌─────────────────────┐     chrome.storage.sync      ┌──────────────────────┐
│ popup / options UI  │ ───────────────────────────► │  settings blob       │
└─────────────────────┘                              └──────────┬───────────┘
                                                               │ onChanged
┌─────────────────────┐  commands.onCommand                    │
│ background SW       │ ─── settings + PDF download state ─────┤
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
| Background | `src/background/background.js` | Site toggle and PDF download/open commands |
| PDF helpers | `src/shared/pdf-open.js` → `globalThis.RosewashPdfOpen` | PDF URL detection, opener templates, serializable pending state |
| Popup | `src/popup/popup.js` | Daily controls + push message to active tab |
| Options | `src/options/options.js` | Palettes, appearance, site layouts, block list |
| X layout | `src/sites/x-core.js`, `x.js`, `x.css` | Responsive compact navigation and wide-screen split timelines |
| Zhihu layout | `src/sites/zhihu.js`, `zhihu.css` | Centered widescreen article column; hides page chrome |

## Settings schema

Stored in **`chrome.storage.sync`**.

```json
{
  "enabled": true,
  "presetLight": "rose-pine",
  "presetDark": "rose-pine",
  "appearance": "auto",
  "xCompactLayout": false,
  "xSingleColumnWidth": 600,
  "zhihuArticleLayout": false,
  "zhihuArticleWidth": 960,
  "disabledHosts": []
}
```

PDF opener settings are stored alongside the theme settings in
`chrome.storage.sync`:

```json
{
  "pdfOpener": "serein",
  "pdfCustomOpenerTemplate": ""
}
```

`pdfOpener` is `serein` or `custom`. The Serein preset expands
`serein://open?file={fileURL}`. A custom template must use a non-Web URL Scheme
and contain `{fileURL}` or `{filePath}`; values are percent-encoded after the
download API returns the final absolute filename.

| Field | Values | Meaning |
| --- | --- | --- |
| `enabled` | boolean | Global off clears all tints |
| `presetLight` | preset id with a light variant | Palette used when appearance resolves to light |
| `presetDark` | preset id with a dark variant | Palette used when appearance resolves to dark |
| `appearance` | `auto` \| `light` \| `dark` | `auto` follows `prefers-color-scheme` |
| `xCompactLayout` | boolean | Enables Rosewash's responsive compact layout on X |
| `xSingleColumnWidth` | 520 / 600 / 680 / 760 | Centered X timeline width |
| `zhihuArticleLayout` | boolean | Enables the centered Zhihu article reading layout |
| `zhihuArticleWidth` | 720 / 840 / 960 / 1080 | Centered Zhihu article width |
| `disabledHosts` | string[] | Hostnames (and parents) where Rosewash is blocked |

Normalization lives in `RosewashCore.normalizeSettings()`:

- Hosts lowercased, leading dots stripped, deduped, sorted.
- Unknown or variant-missing `presetLight` / `presetDark` become `rose-pine`.
- Unknown `appearance` falls back to `auto`.
- Legacy blobs with only `preset` copy that family into both slots when the
  family has that variant; otherwise the missing slot is `rose-pine`.
- Legacy blobs with only `mode: auto|dawn|moon` migrate to
  `appearance: auto|light|dark` (presets stay `rose-pine`).
- `enabled !== false` counts as true.

`resolveSettingsThemeKey(settings, prefersDark)` picks
`{presetLight|presetDark}-{light|dark}` from the resolved appearance.
`resolveThemeKey(preset, appearance, prefersDark)` still builds a key for one
family. Dark-only / light-only families fall back to the available variant.
Tokens are applied as `--rosewash-*` CSS variables plus `data-rosewash-theme`
on `documentElement`.

Host matching (`isHostDisabled`): exact match or subdomain of a listed host
(`news.example.com` matches entry `example.com`).

Toggle (`toggleHostDisabled`): remove any list entry that matches the host; if
none matched, append the host. Used by the background command; popup implements
the same algorithm inline.

## Manifest details

- **MV3**, version must match `package.json` (`scripts/validate.mjs` enforces).
- Permissions: `storage` and `downloads`; host access via
  `"host_permissions": ["<all_urls>"]`.
- Content scripts at `document_start`: `theme.css`, then `core.js`, then
  `content.js` (order matters: engine must exist before bootstrap).
- Background service worker: `src/background/background.js`.
- Command `toggle-current-site`: suggested key **`Alt+Shift+B`** (Mac:
  Option+Shift+B). User-rebindable at `chrome://extensions/shortcuts`.
- Command `open-pdf-locally`: suggested key **`Alt+Shift+P`** (Mac:
  Option+Shift+P). Downloads a supported PDF before requesting the configured
  local URL Scheme.

## Content pipeline (critical path)

On every page match, roughly:

1. **CSS inject** (`theme.css`) is available but inactive until
   `html[data-rosewash-theme]` exists.
2. **`paintProvisionalRoot()`** sets `data-rosewash-theme` from system Auto
   preference so theme.css paints the canvas on the first frame.
3. **`applyCachedSettings()`** with in-memory defaults (`enabled: true`,
   `appearance: auto`, both presets `rose-pine`) runs a full engine apply on the
   (still small) document_start DOM — intentional FOUC mitigation; not a blank
   wait for storage.
4. **`loadSettings()`** reads raw `chrome.storage.sync` (no default merge,
   so a legacy `preset` is not hidden by default `presetLight`/`presetDark`),
   replaces the cache, re-applies (may clear if disabled / blocked host).
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
| `data-rosewash-theme` | Active theme key for CSS (`{preset}-light` / `{preset}-dark`; legacy aliases `dawn` / `moon` still resolve in `PALETTES`) |
| `data-rosewash-tinted` | Element was touched by the engine |
| `data-rosewash-had-style` | Had an inline `style` before Rosewash |
| `data-rosewash-original-style` | Snapshot of that original inline style |
| `data-rosewash-ignore` | Opt-out marker (also in `SKIP_SELECTOR`) |

## Engine (`src/content/core.js`)

IIFE that freezes `globalThis.RosewashCore`. Tested by loading the file in a
Node `vm` context (`test/core.test.js`). Arrays returned from the sandbox need
`JSON` round-trip (`plain()`) before `assert.deepEqual` across realms.

### Palettes

Presets live in `RosewashCore.PRESETS` (28 families aligned with Codex app code
themes). Each entry has optional `light` / `dark` token sets:

`base`, `surface`, `overlay`, `muted`, `text`, `link`.

Default Rose Pine (former Dawn / Moon):

| Variant | base | surface | overlay | text | link |
| --- | --- | --- | --- | --- | --- |
| light | `#faf4ed` | `#fffaf3` | `#f2e9de` | `#575279` | `#286983` |
| dark | `#232136` | `#2a273f` | `#393552` | `#e0def4` | `#9ccfd8` |

`PALETTES` is a flat map of `{preset}-{light|dark}` keys (plus legacy
`dawn` / `moon` aliases). Adding a family means registering tokens only — not
branching inside `processElement`. `muted` is also used for scrollbar tracks.

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
   left alone. Colors already matching one of the active palette's three
   surface tokens keep that role, so repeated scans cannot turn a page shell
   or elevated region into a different layer.
3. **Text**: opaque colors → `palette.text`; anchors → `palette.link`.
4. **Borders**: low-chroma borders → `palette.overlay`.

Skip list includes media, canvas, SVG, iframe, form controls, code/editor
surfaces (CodeMirror, Monaco, hljs, KaTeX, MathJax), and
`[data-rosewash-ignore]`.

### Root CSS variable remapping

Pseudo-elements cannot take per-element inline tints.

- **`theme.css`**: while `data-rosewash-theme` is set, force ChatGPT surface
  tokens and Substack publication tokens on root / `.dark` scopes; pin sticky
  footer fade pseudos (`thread-bottom-container`, `threadFooterContentFade`) to
  `--rosewash-base`; cover SPA roots plus Substack shells (`#entry`, `#main`,
  `.use-theme-bg`, `.intro-popup`).
- **Engine** (`SURFACE_VAR_*` / `TEXT_VAR_*` / `FORCED_SURFACE_VARS` in
  `core.js`): rewrite matching root custom properties to palette colors with
  `!important`. Known ChatGPT / Substack surface names are forced even for
  unparseable values. Overrides are diffed and restored with the theme.

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
- Covers common SPA roots (`#react-root`, `#root`, `#app`, `#__next`, `main`, …)
  and Substack shells (`#entry`, `#main`, `.use-theme-bg`, intro popup).
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

The `open-pdf-locally` path is deliberately separate from the tint engine:

```text
active tab URL → normalize/detect PDF → chrome.downloads.download
→ persist download id + opener template in chrome.storage.session
→ downloads.onChanged complete → downloads.search final filename
→ encode file URL/path → chrome.tabs.create(configured URL Scheme)
```

Supported URL detection is intentionally narrow: ordinary HTTP(S) URLs whose
path ends in `.pdf`, arXiv `/pdf/{id}` URLs, and conservative arXiv
`/abs/{id}` → `/pdf/{id}.pdf` normalization. It does not probe MIME types or
introduce a PDF viewer. Google Scholar PDF Reader retains the source PDF tab
URL, so it follows the ordinary URL path.

Pending downloads live in `chrome.storage.session`, because MV3 service worker
globals do not survive worker suspension. The command also checks the download
immediately after persisting it, closing the fast-completion race. Per-tab
action badge/title feedback reports unsupported URL, downloading, failure, or
opener request.

The pure extension cannot enumerate installed applications, choose an app from
`/Applications`, launch an arbitrary executable, or verify that a URL Scheme
handler exists. `chrome.downloads.open()` is not used: it requires the separate
`downloads.open` permission and a user gesture at open time, which cannot be
reliably retained until an asynchronous download completes. Serein must
separately register and implement
`serein://open?file=<percent-encoded file URL>`; that external interface remains
a follow-up dependency.

## Popup & options

**Popup**

- Reads active tab host; toggles that host in `disabledHosts`.
- On X, exposes the `xCompactLayout` switch for the desktop layout.
- On Zhihu, exposes the `zhihuArticleLayout` switch for article pages.
- Two palette selects (`presetLight` / `presetDark`); lists only families
  that expose that variant.
- On change: write storage + `chrome.tabs.sendMessage` with
  `{ type: "rosewash:settings-updated", settings }` (best-effort; storage
  path still works if the content script is missing).
- Site button title documents `Alt+Shift+B`.

**Options**

- Edit enabled / appearance / light and dark palette grids / site layouts /
  full host list (one host per line). Each grid only lists families with that
  variant.
- Groups controls into General, Theme, and Sites panels. Palette cards use a
  responsive full-width grid for each variant; Save / Reset remain fixed at
  the bottom of the viewport.
- Mentions the site-toggle shortcut.
- Adds a compact PDF · Open in panel with a Serein preset and a constrained
  custom URL Scheme template.

## X compact layout

`manifest.json` injects `src/sites/x.css`, then `x-core.js` and `x.js`, on
`https://x.com/*` at `document_start`. The runtime enables its root marker only
when Rosewash is enabled, X is not blocked, and `xCompactLayout` is true.

- `x-core.js` owns the pure reply-stack and virtual-record cache helpers.
- `x.js` keeps observing X across SPA route changes, waits for the main post to
  hydrate, and writes split-thread layout coordinates.
- `x.css` collapses the navigation rail, keeps X's Explore/search entry in that
  rail, hides the redundant right search column, stretches virtualized post
  cells to the selected single-column width from `min-width: 720px`, shrinks that
  width to the available viewport, and applies the split thread layout at
  `min-width: 1280px`. Below 720px, X keeps its native mobile layout.
- `test/x-layout.test.js` covers the pure layout math and critical CSS rules.

## Zhihu article layout

`manifest.json` injects `src/sites/zhihu.css` and `zhihu.js` on `zhihu.com`,
`www.zhihu.com`, and `zhuanlan.zhihu.com` at `document_start`. The content
runtime marks Zhihu hosts with `data-rosewash-zhihu-layout` when Rosewash is
enabled, Zhihu is not blocked, and `zhihuArticleLayout` is true. `zhihu.js`
adds `data-rosewash-zhihu-article` only on `/p/{id}` routes from 720px.

- `zhihu.css` hides the top bar, column header, right rail, and bottom
  recommendations, then centers the article at the selected width. The width
  shrinks to the available viewport.
- `test/zhihu-layout.test.js` covers the hide/center rules and width setting.

Popup and options load `src/content/core.js` for `PRESETS` / `listPresets` /
`normalizeSettings`. Engine + background also share `core.js`.

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
just dist       # copy manifest + html + src → dist/ (Load unpacked)
just package    # check + dist + zip → .tmp/rosewash.zip
just clean      # remove .tmp and local debug leftovers
```

| Area | How |
| --- | --- |
| Engine unit tests | `test/core.test.js` loads `core.js` in `vm` |
| PDF unit tests | `test/pdf-open.test.js` loads `pdf-open.js` in `vm` |
| Browser fixtures | `test/fixtures/*` HTML + runners (manual / scripted) |
| Validate | Requires background/PDF runtime files, both commands, storage + downloads + `<all_urls>` |

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
| New palette family | `PRESETS` in `core.js` (tokens only); popup/options list from registry |
| New protected widget class | `SKIP_SELECTOR` in `core.js` |
| New design-token names | `SURFACE_VAR_INCLUDE` / `TEXT_VAR_*` + unit tests |
| New page-chrome shell | `PAGE_CHROME_CLASSES` + matching `theme.css` rules if CSS-in-JS |
| New keyboard command | `manifest.json` `commands` + `background.js` handler + validate |
| PDF opener behavior | `src/shared/pdf-open.js` + background orchestration + PDF tests |
| Settings field | schema in all of: core defaults, content `handleStorageChanged`, popup, options, docs |

## Related docs

- [architecture.md](./architecture.md) — conceptual layers
- [../README.md](../README.md) — install and feature list
- [../PLAN.md](../PLAN.md) — milestones and next work
- [../changelog.md](../changelog.md) — shipped changes
- [../AGENTS.md](../AGENTS.md) — agent entry point for this repo
