# Architecture

Rosewash has three small layers. For file-level behavior, settings schema,
content pipeline, and change recipes, see
[implementation.md](./implementation.md) (linked from [AGENTS.md](../AGENTS.md)).

## Content Engine

`src/content/core.js` is the testable engine. It owns:

- Curated preset registry (Rose Pine default, plus Codex-aligned families such
  as Catppuccin, Nord, Gruvbox, Tokyo Night, …) with light/dark variants, plus
  plain Light and Dark options that preserve website colors.
- Color parsing for hex, `rgb()`, and CSS Color 4 `color(srgb ...)`, `lab()`,
  `oklab()`, `lch()`, and `oklch()` forms. Computed sRGB colors from `color-mix()`
  and relative RGB colors follow the same surface, text, and border rules.
- Full-page surface and text covering into the active palette.
- Optional page-tone sampling (still used for diagnostics and mixed re-detect).
- Default site policy and per-host on/off rules, with subdomain matching.
- DOM tinting and restoration.
- A batched `MutationObserver` for inserted elements, class changes, and
  stylesheet edits, plus a listener for stylesheet loads. Open shadow roots
  are scanned and observed with the document.

The content scripts run in every frame. Embedded frames follow the tab's
top-level site rule, and site layouts only apply to the top-level page.

An element picker in the top frame saves CSS selectors per site. The engine
leaves matched elements and their contents untouched. With image dimming on,
a tinted dark palette also lowers image and video brightness through
`theme.css`.

At `document_start` the content runtime reads stored settings before applying
colors, fonts, or layouts. Disabled sites stay untouched while storage loads.
Enabled sites receive `data-rosewash-theme`, activating the CSS canvas cover.
MutationObserver scans coalesce to `requestAnimationFrame` (not a multi-hundred
millisecond delay). Theme re-apply only restores previous tints when the
resolved palette actually changes, so mixed page-tone re-detect no longer
flashes the whole document white. CSS variable overrides are diffed in place.

The engine writes inline styles (with `!important`) so every non-protected
painted surface becomes Rose Pine:

- Opaque backgrounds map to `base` (page roots), `surface`, or `overlay`
  (mid-luminance boxes keep a little hierarchy). A fill that still matches
  the page or a painted ancestor stays on that same color, so nested wrappers
  do not become stripes.
- Existing palette surface colors retain their role across repeated scans, so
  SPA roots and lazy-loaded regions do not develop `base` / `surface` seams.
- Transparent `html`/`body` roots are treated as the default document canvas.
- Opaque text maps to `palette.text`; anchors map to `palette.link`.
- Only a border that is already stroked is recolored, and it uses
  `palette.muted`. A zero-width or `none` border is left alone: writing the
  color can make the site turn it into a solid frame. A stroke that matches
  its own fill stays untouched.
- CSS gradients are flattened to solid palette fills. Gradients clipped to text
  become readable palette text without a surface fill. Backgrounds containing
  `url()` images retain all their layers, including any accompanying gradients.
- Ordinary code, keyboard labels, and sample output follow the palette. Media,
  canvas, SVG, iframes, inputs, editors, and recognized syntax-highlighting
  regions are skipped.

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

Inverted icon/button tokens and brand accents are left alone. Root variable
records retain the original value and priority plus the applied override.
Restoration only changes declarations that still match the override, preserving
later website writes. Re-applying captures those writes before tinting again.

Page-tone sampling runs on initial apply and palette or font changes. Surface
covering does not depend on the sampled tone.

Only properties changed by the engine are recorded and restored. A declaration
updated later by the website remains in place; untouched properties such as
X's dynamically loaded background images are preserved. The original and
applied declarations are mirrored onto `data-rosewash-style-overrides`, so a
new content-script instance can remove stale overrides after extension reload.

## Extension Runtime

`src/content/content.js` wires the engine to Chrome extension APIs:

- Reads the stored site policy at `document_start`, then applies colors, fonts,
  and layouts only when the extension and the current site are enabled.
- Reads settings from `chrome.storage.sync` and keeps an in-page cache.
- Re-applies on storage changes.
- Re-applies after `DOMContentLoaded` and `load` using the already-loaded
  settings cache, then requests a batched refresh for late page styles.
- Re-applies from the cache immediately after system dark mode changes in Auto
  mode.
- Re-applies cached settings when a page becomes visible again.
- Reads current storage after background update notifications, discarding
  older overlapping reads.
- Stops DOM listeners if the extension context is already invalidated.

## Background

`src/background/background.js` runs as a Chromium MV3 service worker or a
Firefox event page. Chromium loads `src/content/core.js` via `importScripts`;
the Firefox manifest lists core before background in `background.scripts`.
Popup edits, settings-page saves and resets, and keyboard commands share one
storage write queue. Each operation reads current storage, applies its edit,
and persists the result. Accepted operations continue after the popup closes.
A failed operation reports its error and lets later operations proceed.

`toggle-current-site` (default `Alt+Shift+B`) saves an explicit on/off rule
for the command's hostname. The worker notifies that tab after saving; UI saves
notify all tabs. Notifications contain only their message type, and content
scripts read current storage before applying. Tab responses do not block
subsequent writes. Storage change listeners keep other tabs synchronized.

Users can rebind shortcuts under `chrome://extensions/shortcuts`,
`edge://extensions/shortcuts`, or Firefox's `about:addons` gear menu.

## Browser Frame

Firefox's background runtime uses the `theme` permission to apply the active
palette to the browser frame and toolbar. Startup, installation, settings
changes, and system-appearance messages from top-level content scripts trigger
updates. Global pause and plain palettes reset the theme; per-site rules leave
it active. Website color-scheme preferences continue to follow the system.

Chrome and Edge use independent static themes generated by
`scripts/themes.mjs` from the shared palette registry. Each tinted variant
gets a manifest with matching frame and toolbar colors. These packages are
distributed in a companion release archive and do not track extension settings.

## UI

`popup.html` is the daily control surface. `options.html` is the full settings
page (appearance, palette grids, system fonts, site layouts, site rules). Both are
plain HTML/CSS/JS and share the same storage schema:

```json
{
  "enabled": true,
  "defaultEnabled": true,
  "colorOverridesEnabled": true,
  "customFontsEnabled": false,
  "fontEnglish": "",
  "fontChinese": "",
  "fontMath": "",
  "fontMonospace": "",
  "presetLight": "rose-pine",
  "presetDark": "rose-pine",
  "appearance": "auto",
  "disabledHosts": [],
  "enabledHosts": []
}
```

Theme presets live in one palette registry with light and/or dark variants. The
content engine resolves `presetLight` or `presetDark` from appearance into a
concrete palette before scanning, so adding another curated family does not add
branching inside DOM processing. Plain presets set `tint: false`: they restore
previous tints and skip color overrides, while custom fonts and site layouts
keep their own settings. Without custom fonts, these presets skip DOM scanning
and observation. Both UIs list the plain option first, followed by Rose Pine
and the remaining families sorted by label. Legacy `preset` and `mode: auto|dawn|moon`
storage still normalize cleanly.
The independent theme switch uses the plain palette path while retaining both
selected palettes. Fonts remain active, and image dimming stops.

The popup exposes an Allowed / Blocked button for the current hostname.
Remove a hostname from the settings site lists to clear its override. Explicit
choices persist when `defaultEnabled` changes. Clearing a hostname's rule
restores its parent rule if present, otherwise the global
default. The most specific hostname wins; a blocked rule wins a tie, and the
global enable switch pauses every site. Pick sits beside the site button;
X and Zhihu layout switches appear only on their matching site.
The popup's Fonts switch shares `customFontsEnabled` with the settings page.
Each popup change immediately sends an edit to the worker. Pending local edits
stay visible until the saves finish, then the popup reloads current storage.
The settings page sends its edited form and baseline to the same queue.
`mergeSettingsEdits` applies changed fields and host-list additions/removals
to current storage. Explicit additions clear the opposite rule for that host;
disabled wins when the edited form explicitly keeps both. Unrelated external
changes remain intact.
Settings has Theme, Fonts, Sites, and Shortcuts tabs. Palette grids stay
expanded, and changes save automatically. Text and sliders settle for 350ms;
leaving the field or page flushes pending input. The worker owns each save
once sent. Shortcuts displays the browser bindings and opens shortcut settings.

The flat settings layout follows the selected palette and system appearance.
The shared font picker enumerates installed families in Chromium with
`chrome.fontSettings.getFontList()` using the `fontSettings` permission.
Its searchable menu stays within 280px, scrolls through results, and supports
arrow keys, Enter, and Escape. Search text only filters; selecting a result
saves the font.
Firefox has no such API, so the same fields accept installed font names and
the Firefox manifest omits that permission.
The engine resolves local face names and applies separate local faces
for English, Chinese, native MathML, and monospace text, restoring original
fonts when disabled. Renderer-managed formulas and code editors are protected.

## Site Layouts

X also has an independent, default-off setting to expand truncated reply text
on post pages. It works at any viewport width and follows the global and site
enable switches. It skips the current post, ancestors, and quoted content.

Optional site-specific layouts are isolated under `src/sites/`. When
`xCompactLayout` is on, X pages from 720px get a compact navigation rail and
an adjustable centered timeline. The selected width shrinks to the available
viewport. Thread pages stay on that same single column; below 720px, and when
Rosewash is disabled, X is blocked, or the option is off, X keeps its native
layout.

The Zhihu clean layout is the same kind of optional overlay. When
`zhihuArticleLayout` is on, home (`/`, `/follow`, `/hot`), `/question/{id}`,
and `/p/{id}` pages center a reading column at the selected width. Only
articles hide the top bar; all other routes preserve navigation. The column
shrinks with the viewport, and controls wrap on narrow screens. Fixed answer actions follow the column when resized.
Other Zhihu routes keep the native layout. The isolated content script listens
to `navigation.currententrychange` for page-world `pushState`, `replaceState`,
and back/forward navigation, then updates the page marker.

## Performance Boundary

The engine scans the initial DOM, then scans added subtrees and restores and
rescans subtrees whose classes change. Page completion requests a full refresh.
Stylesheet loads and inserted or edited styles refresh only the existing
elements their color, border, font, or custom-property rules select; unreadable
sheets refresh the whole page. Requests coalesce into the next frame; nested
subtrees are scanned only through their queued ancestor.

Scans run in slices of about 8 ms per frame, in document order. Each batch
restores the elements it refreshes, reads their computed styles, then writes
inline tints, so elements waiting for a later slice keep their previous tint.
If the resolved theme, appearance, or custom font selection changes, the
rescan restores each element in its own slice. Ordinary re-applies with the
same palette, including tab focus, skip the document walk. The engine does not
walk every element on each mutation or read computed styles in a continuous
loop.

System theme changes do not call `chrome.storage` again and do not wait for an
extra animation frame. This avoids both the common MV3 reload/update failure
where an orphaned content script keeps running in an old page context and
`chrome.*` calls throw `Extension context invalidated`, and the visible flash
from a delayed theme application.
