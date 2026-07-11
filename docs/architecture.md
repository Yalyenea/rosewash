# Architecture

Rosewash has three small layers.

## Content Engine

`src/content/core.js` is the testable engine. It owns:

- Rose Pine Dawn and Moon tokens.
- Color parsing and near-white detection, including the CSS Color 4 `lab()`,
  `oklab()`, `lch()`, and `oklch()` forms used by modern Tailwind output.
- Dark-only page tone detection for Dawn light adaptation.
- Site block matching.
- DOM tinting and restoration.
- A throttled `MutationObserver` for newly inserted elements.

The engine only writes inline styles to elements it has classified as needing a
small accessibility tint: near-white surfaces, near-white borders, dark neutral
text in Moon mode, dark-only page surfaces in Dawn mode, or page-level chrome
bars. Transparent `html`/`body` roots on non-dark-only pages are treated as the
default white canvas (legacy sites such as jmlr.org never set an explicit white
fill). Original inline values are recorded and restored when the extension is
disabled, the current host is blocked, or the active theme changes.

Page chrome is `header`, `[role=banner]`, top-level `nav`, and known app shells
such as Zhihu's `.AppHeader` / `.LeanAppHeaderBar` / `.MobileAppHeader`, when
they sit outside `main`/`article`. Opaque, gradient, or known transparent
shells are filled with `palette.base` using `!important`, and descendant text
is forced to `palette.text` with `!important` so branded top bars (arXiv red,
Zhihu Emotion-styled white bars) blend into the page. `theme.css` also pins the
known Zhihu shell selectors to `--rosewash-base` so CSS-in-JS layers cannot win
the cascade. Chrome membership is rebuilt on every restore so disable/theme
changes do not leave stale force-color tracking.

Before scanning, the engine samples root, SPA app roots such as `#root > *`, and
major layout elements to classify the page as `light-page`, `dark-only`, or
`mixed`. Dark-only adaptation runs only when the resolved theme is Dawn; it
changes dark neutral surfaces and dark CSS gradients to Dawn paper tones, and
light neutral text to Dawn text, while continuing to skip media, SVG, iframes,
inputs, editors, and code.

If the first document-start pass can only classify the page as `mixed`, the
next runtime re-apply restores Rosewash's own inline styles before sampling
again. This keeps early `color-scheme: light` writes from masking a dark-only
page once the body and app roots have rendered.

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
