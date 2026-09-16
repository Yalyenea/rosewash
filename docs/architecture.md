# Architecture

Rosewash has three small layers. For file-level behavior, settings schema,
content pipeline, and change recipes, see
[implementation.md](./implementation.md) (linked from [AGENTS.md](../AGENTS.md)).

## Content Engine

`src/content/core.js` is the testable engine. It owns:

- Curated preset registry (Rose Pine default, plus Codex-aligned families such
  as Catppuccin, Nord, Gruvbox, Tokyo Night, …) with light/dark variants.
- Color parsing for hex, `rgb()`, and CSS Color 4 `lab()`, `oklab()`, `lch()`,
  and `oklch()` forms used by modern Tailwind output.
- Full-page surface and text covering into the active palette.
- Optional page-tone sampling (still used for diagnostics and mixed re-detect).
- Site block matching.
- DOM tinting and restoration.
- A throttled `MutationObserver` for newly inserted elements.

At `document_start` the content runtime paints a provisional
`data-rosewash-theme` (Auto from system preference) and applies default
settings immediately so `theme.css` can force the page canvas before
`chrome.storage` returns. Stored settings then refine or clear the cover.
MutationObserver scans coalesce to `requestAnimationFrame` (not a multi-hundred
millisecond delay). Theme re-apply only restores previous tints when the
resolved palette actually changes, so mixed page-tone re-detect no longer
flashes the whole document white. CSS variable overrides are diffed in place.

The engine writes inline styles (with `!important`) so every non-protected
painted surface becomes Rose Pine:

- Opaque backgrounds map to `base` (page roots), `surface`, or `overlay`
  (mid-luminance boxes keep a little hierarchy).
- Existing palette surface colors retain their role across repeated scans, so
  SPA roots and lazy-loaded regions do not develop `base` / `surface` seams.
- Transparent `html`/`body` roots are treated as the default document canvas.
- Opaque text maps to `palette.text`; anchors map to `palette.link`.
- Low-chroma borders map to `palette.overlay`.
- CSS gradients are flattened to solid palette fills; `url()` media backgrounds
  are left alone.
- Media, canvas, SVG, iframes, inputs, editors, and code blocks are skipped.

Page chrome is `header`, `[role=banner]`, top-level `nav`, and known app shells
such as Zhihu's `.AppHeader` / `.LeanAppHeaderBar` / `.MobileAppHeader`, when
they sit outside `main`/`article`. Those shells get `palette.base` with
`!important`, and descendant text is forced to `palette.text` with
`!important`. `theme.css` also pins the known Zhihu shell selectors and the
document canvas to `--rosewash-*` tokens so CSS-in-JS layers cannot keep pure
white chrome.

Design-system pages often paint sticky composers and scroll fades on `::after`
with tokens such as `var(--main-surface-primary)`. Pseudo-elements cannot take
per-element inline tints, so:

1. **`theme.css`** forces ChatGPT-style surface tokens on `html` / `.dark` /
   `[data-theme=dark]` to `--rosewash-*`, and pins
   `[class*="thread-bottom-container"]::after` and
   `[class*="threadFooterContentFade"]` to `--rosewash-base`.
2. **Engine** remaps matching root custom properties (`main-surface*`,
   `composer-surface*`, `bg-primary`, `--ground`, sidebar canvas tokens, …)
   to `palette.base` / `surface` / `overlay`, and text tokens such as
   `--ink` to `palette.text`, with `!important`. Known ChatGPT token names
   are forced even when the current value cannot be parsed.

Inverted icon/button tokens and brand accents are left alone. Overrides
restore with the rest of the theme.

If the first document-start pass can only classify the page as `mixed`, the
next runtime re-apply restores Rosewash's own inline styles before sampling
again. This keeps early `color-scheme` writes from masking a later SPA shell.

Original inline style snapshots are also mirrored onto `data-rosewash-*`
attributes. This lets a new content-script instance clean up stale inline styles
left by an older orphaned script after extension reload.

## Extension Runtime

`src/content/content.js` wires the engine to Chrome extension APIs:

- Paints a provisional theme attribute, then applies default settings
  immediately at `document_start` so the canvas is covered before storage
  returns; stored settings refine or clear that cover.
- Reads settings from `chrome.storage.sync` and keeps an in-page cache.
- Re-applies on storage changes.
- Re-applies after `DOMContentLoaded` and `load` using the already-loaded
  settings cache.
- Re-applies from the cache immediately after system dark mode changes in Auto
  mode.
- Re-checks settings when a page becomes visible again.
- Accepts popup refresh messages.
- Stops DOM listeners if the extension context is already invalidated.

## Background

`src/background/background.js` is the MV3 service worker. It loads
`src/content/core.js` via `importScripts` for host helpers, then handles
`chrome.commands`:

- `toggle-current-site` (default `Alt+Shift+B`) toggles the active tab's host
  in `disabledHosts` and writes `chrome.storage.sync`. Content scripts pick up
  the change through `storage.onChanged`.

Users can rebind the shortcut under `chrome://extensions/shortcuts`.

## UI

`popup.html` is the daily control surface. `options.html` is the full settings
page (appearance, palette grids, system fonts, site layouts, block list). Both are
plain HTML/CSS/JS and share the same storage schema:

```json
{
  "enabled": true,
  "customFontsEnabled": false,
  "fontEnglish": "",
  "fontChinese": "",
  "fontMath": "",
  "fontMonospace": "",
  "presetLight": "rose-pine",
  "presetDark": "rose-pine",
  "appearance": "auto",
  "disabledHosts": []
}
```

Theme presets live in one palette registry with light and/or dark variants. The
content engine resolves `presetLight` or `presetDark` from appearance into a
concrete palette before scanning, so adding another curated family does not add
branching inside DOM processing. Legacy `preset` and `mode: auto|dawn|moon`
storage still normalize cleanly.

The flat settings layout follows the selected palette and system appearance.
Its font picker uses permission-gated Local Font Access to enumerate installed
faces and save their PostScript names. The engine applies separate local faces
for English, Chinese, native MathML, and monospace text, restoring original
fonts when disabled. Renderer-managed formulas and code editors are protected.

## Site Layouts

Optional site-specific layouts are isolated under `src/sites/`. When
`xCompactLayout` is on, X pages from 720px get a compact navigation rail and
an adjustable centered timeline. The selected width shrinks to the available
viewport. Thread pages stay on that same single column; below 720px, and when
Rosewash is disabled, X is blocked, or the option is off, X keeps its native
layout.

The Zhihu clean layout is the same kind of optional overlay. When
`zhihuArticleLayout` is on, home (`/`, `/follow`, `/hot`), `/question/{id}`,
and `/p/{id}` pages from 720px hide the top bar and other chrome and center a
widescreen column at the selected width. Other Zhihu routes and mobile widths
keep the native layout.

## Performance Boundary

The MVP scans the existing DOM once on load, then only scans newly added nodes.
If the resolved theme, raw mode, or custom font selection changes, already-tinted elements are restored
before the next scan so Auto dark and manual Moon use the same color path. A
later apply with the same palette (tab focus, `load`) does not walk the document
again. It does not walk every element on each mutation and does not call
`getComputedStyle()` inside a continuous loop. Scan reads computed styles in one
pass, then writes inline tints.

System theme changes do not call `chrome.storage` again and do not wait for an
extra animation frame. This avoids both the common MV3 reload/update failure
where an orphaned content script keeps running in an old page context and
`chrome.*` calls throw `Extension context invalidated`, and the visible flash
from a delayed theme application.
