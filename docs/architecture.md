# Architecture

Rosewash has three small layers.

## Content Engine

`src/content/core.js` is the testable engine. It owns:

- Rose Pine Dawn and Moon tokens.
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
per-element inline tints, so the engine remaps matching root custom properties
(`main-surface*`, `composer-surface*`, `bg-primary`, `--ground`, sidebar
canvas tokens, …) to `palette.base` / `palette.surface`, and text tokens such
as `--ink` / `--title-ink` to `palette.text`. Inverted icon/button tokens and
brand accents are left alone. Overrides restore with the rest of the theme.

If the first document-start pass can only classify the page as `mixed`, the
next runtime re-apply restores Rosewash's own inline styles before sampling
again. This keeps early `color-scheme` writes from masking a later SPA shell.

Original inline style snapshots are also mirrored onto `data-rosewash-*`
attributes. This lets a new content-script instance clean up stale inline styles
left by an older orphaned script after extension reload.

## Extension Runtime

`src/content/content.js` wires the engine to Chrome extension APIs:

- Reads settings from `chrome.storage.sync`.
- Keeps an in-page settings cache after the first storage read.
- Does not apply the default settings before storage has returned.
- Re-applies on storage changes.
- Re-applies after `DOMContentLoaded` and `load` using the already-loaded
  settings cache.
- Re-applies from the cache immediately after system dark mode changes in Auto
  mode.
- Re-checks settings when a page becomes visible again.
- Accepts popup refresh messages.
- Stops DOM listeners if the extension context is already invalidated.

## UI

`popup.html` is the daily control surface. `options.html` is only for editing
the block list. Both are plain HTML/CSS/JS and share the same storage schema:

```json
{
  "enabled": true,
  "mode": "auto",
  "disabledHosts": []
}
```

The next settings shape should separate the color family from the appearance
mode:

```json
{
  "enabled": true,
  "preset": "rose-pine",
  "appearance": "auto",
  "disabledHosts": []
}
```

Theme presets should live in one palette registry with light and dark variants.
The content engine should resolve `preset + appearance` into a concrete palette
before scanning, so adding Catppuccin, Gruvbox, Nord, Solarized, or another
curated preset does not add branching inside DOM processing.

## Performance Boundary

The MVP scans the existing DOM once on load, then only scans newly added nodes.
If the resolved theme or raw mode changes, already-tinted elements are restored
before the next scan so Auto dark and manual Moon use the same color path. It
does not walk every element on each mutation and does not call
`getComputedStyle()` inside a continuous loop.

System theme changes do not call `chrome.storage` again and do not wait for an
extra animation frame. This avoids both the common MV3 reload/update failure
where an orphaned content script keeps running in an old page context and
`chrome.*` calls throw `Extension context invalidated`, and the visible flash
from a delayed theme application.
