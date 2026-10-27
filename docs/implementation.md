# Rosewash Implementation

Agent-oriented reference for how the extension is built and how data flows.
For a shorter conceptual overview, see [architecture.md](./architecture.md).
For product roadmap, see [PLAN.md](../PLAN.md).

## What it is

Rosewash is a **zero-build Manifest V3** extension for Chromium and desktop
Firefox 148 or newer. It covers page
surfaces, text, and neutral borders with the selected palette, defaulting to
Rose Pine Dawn / Moon. There is
no bundler, no runtime npm dependency, and no TypeScript compile step.

Stage with `just dist` and load the `dist/` folder as an unpacked extension
(not the repo root). `just package` writes the Chrome Web Store zip to
`release/rosewash-vX.Y.Z.zip`, with `manifest.json` at the archive root.
`just dist edge` and `just dist firefox` stage `dist-edge/` and `dist-firefox/`.
`just package edge` / `firefox` write matching `-edge.zip` / `-firefox.zip`
archives; `just package-all` creates all three extension archives plus a
`-chromium-themes.zip` companion archive. JavaScript is copied unchanged.

## Repository layout

```text
manifest.json              MV3 entry: permissions, content scripts, SW, commands, icons
icons/                     icon.svg / icon-off.svg sources and their 16/32/48/128 PNGs
popup.html + src/popup/    Action popup (site policy, picker, palettes, matching site layout)
options.html + src/options/ Settings (palettes, appearance, images, site layouts, site and element rules)
src/settings/fonts.js     Automatic font picker (Chromium), font-name inputs (Firefox), previews
src/background/            Background runtime (settings writes and commands)
src/content/
  core.js                  Pure engine + host helpers (testable via vm)
  content.js               Chrome wiring for content world
  picker.js                Element picker overlay (top frame only)
  theme.css                Immediate CSS cover when data-rosewash-theme is set
src/sites/                 Optional site-specific layout runtimes and styles
test/                      Node tests + HTML fixtures
scripts/validate.mjs       Manifest / file presence / syntax checks
scripts/browsers.mjs       Browser manifests, static theme manifests, and artifact names
scripts/dist.mjs           Copies runtime files and writes the target manifest / zip
scripts/themes.mjs         Generates Chromium frame themes from the palette registry
justfile                   test · validate · check · dist · themes · package · package-all · clean
scripts/release-notes.mjs  GitHub Release notes from the version section in changelog.md
website/                   Bilingual static website: content, palette demo, images, and fonts
wrangler.website.jsonc     Cloudflare static assets and custom domain configuration
dist/                      Generated loadable extension (`just dist`, gitignored)
dist-edge/, dist-firefox/   Generated browser-specific folders (gitignored)
dist-themes/               Generated Chromium frame theme folders (gitignored)
release/                   Extension and companion theme zips (gitignored)
```

## Runtime topology

Popup and options send edits to the background runtime: a Chromium service
worker or Firefox event page. Keyboard
commands enter the same queue. The worker reads current settings, merges the
edit, and writes `chrome.storage.sync` before acknowledging the save.

Content scripts learn about saves through `storage.onChanged` and background
notifications. Both paths read current storage, replace the in-page cache,
and apply the engine. Page responses do not hold up the write queue.

| Layer | File(s) | Role |
| --- | --- | --- |
| Manifest | `manifest.json` | Registers scripts, storage, `<all_urls>`, commands |
| Engine | `src/content/core.js` → `globalThis.RosewashCore` | Color parse, cover, restore, host helpers |
| Content bootstrap | `src/content/content.js` | Stored site policy, settings cache, listeners |
| CSS cover | `src/content/theme.css` | First-frame canvas / SPA roots / known shells |
| Background | `src/background/background.js` | Settings write queue, commands, content notifications |
| Popup | `src/popup/popup.js` | Daily controls + immediate edit requests to background |
| Options | `src/options/options.js` | Palettes, appearance, site layouts, block list |
| X layout | `src/sites/x.js`, `x.css` | Compact navigation rail and centered single-column streams |
| Zhihu layout | `src/sites/zhihu.js`, `zhihu.css` | Centered reading columns; article-only header hiding |

## Browser frame themes

Firefox's generated manifest adds the `theme` permission. The background
runtime resolves the active palette from the existing appearance settings,
then applies its colors to the browser frame, toolbar, tabs, sidebar, and new
tab page. The frame and toolbar share the page's base color. Pausing Rosewash
or choosing a plain palette calls `theme.reset()`; per-site rules do not
change the browser-wide theme.

Theme updates run on browser startup, extension installation, and synced
settings changes. Firefox top-level content scripts relay system appearance
changes to wake the background event page. `content_color_scheme: "system"`
keeps website color-scheme preferences independent of the browser frame.

Chrome and Edge use separate static theme packages. Run `just themes` to
generate one folder per tinted preset and available light/dark variant under
`dist-themes/rosewash-<preset>-<variant>/`. Each folder contains its own theme
manifest. Plain palettes and missing variants are skipped; rerunning the
command replaces the generated folders.

`node scripts/themes.mjs --package` also creates
`release/rosewash-v<version>-chromium-themes.zip`. `just package-all` includes
this step, and the release workflow uploads the archive beside the three
extension archives. Chromium frame themes are selected separately from the
extension and do not follow its palette, Auto mode, or pause switch.

## Settings schema

Stored in **`chrome.storage.sync`**.

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
  "xCompactLayout": false,
  "xAutoExpandReplies": false,
  "xSingleColumnWidth": 600,
  "zhihuArticleLayout": false,
  "zhihuArticleWidth": 960,
  "dimImages": false,
  "imageBrightness": 80,
  "disabledHosts": [],
  "enabledHosts": [],
  "ignoredElements": {}
}
```

| Field | Values | Meaning |
| --- | --- | --- |
| `enabled` | boolean | Global off clears all tints and font overrides |
| `defaultEnabled` | boolean | Default state for sites without a matching rule; true for existing installs |
| `colorOverridesEnabled` | boolean | Enables theme overrides; true for existing installs. Turning it off keeps palettes saved and custom fonts active. |
| `customFontsEnabled` | boolean | Enables custom page fonts; off by default |
| `fontEnglish`, `fontChinese`, `fontMath`, `fontMonospace` | string | Local font family or face names; empty preserves page typography |
| `presetLight` | preset id with a light variant | Palette used when appearance resolves to light |
| `presetDark` | preset id with a dark variant | Palette used when appearance resolves to dark |
| `appearance` | `auto` \| `light` \| `dark` | `auto` follows `prefers-color-scheme` |
| `xCompactLayout` | boolean | Enables Rosewash's compact single-column layout on X |
| `xAutoExpandReplies` | boolean | Automatically expands truncated reply text on X post pages, independently of compact layout |
| `xSingleColumnWidth` | 520 / 600 / 680 / 760 | Centered X timeline width |
| `zhihuArticleLayout` | boolean | Enables the centered Zhihu reading layout on home, questions, and articles |
| `zhihuArticleWidth` | 720 / 840 / 960 / 1080 | Centered Zhihu column width |
| `dimImages` | boolean | Dims images and videos while a tinted dark palette is active |
| `imageBrightness` | 70 / 80 / 90 | Image brightness in percent when dimming applies |
| `disabledHosts` | string[] | Hostnames (and parents) where Rosewash is blocked |
| `enabledHosts` | string[] | Hostnames (and parents) where Rosewash is explicitly enabled |
| `ignoredElements` | `{ host: selector[] }` | Picker rules; matched elements and their contents stay untouched on that exact host |

Normalization lives in `RosewashCore.normalizeSettings()`:

- Hosts lowercased, leading dots stripped, deduped, sorted.
- `ignoredElements` hosts follow the same rules; selectors are trimmed,
  deduped, sorted, and dropped beyond 300 characters. Hosts without selectors
  are removed.
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

`isHostEnabled` uses the most specific matching rule in `enabledHosts` or
`disabledHosts`, otherwise `defaultEnabled`. A disabled rule wins a tie.
The global `enabled` flag takes priority over every site choice.

Embedded frames use the tab's top-level host. `policyHostForLocation` reads the
last entry of `location.ancestorOrigins`, which Chromium exposes even to
cross-origin and `about:blank` frames, so an iframe on a site that is turned off
stays untouched.

`hostPolicyForHost` returns the current hostname's explicit `on` / `off`
choice, or `default`. `setHostPolicy` removes that exact hostname from both
lists, then adds it to the chosen list for `on` or `off`, even when its value
matches the current default. Selecting `default` leaves no explicit rule and
restores the parent rule, if present, or the global default. Parent and sibling
rules remain intact. `toggleHostEnabled` saves the opposite of the current
effective state as an explicit choice; the background shortcut uses this helper.

## Manifest details

- **MV3**, version must match `package.json` (`scripts/validate.mjs` enforces).
- Chromium permissions: `storage`, `fontSettings`; Firefox omits `fontSettings`.
  Both use `"host_permissions": ["<all_urls>"]`.
- Content scripts at `document_start`: `theme.css`, then `core.js`, then
  `content.js` (order matters: engine must exist before bootstrap). They run
  in every frame (`all_frames`, `match_about_blank`); site layouts only apply
  to the top-level page.
- `icons` and `action.default_icon` list the PNGs under `icons/`; `just dist`
  copies them, and `scripts/validate.mjs` checks that they exist.
- Background service worker: `src/background/background.js`.
- Firefox uses `background.scripts`, loading `core.js` before `background.js`.
  Its stable add-on ID is `rosewash@rosewash`, minimum version is `148.0`,
  and required data collection permissions are `["none"]`.
- Command `toggle-current-site`: suggested key **`Alt+Shift+B`** (Mac:
  Option+Shift+B). Command `toggle-enabled`: suggested key **`Alt+Shift+P`**
  pauses or resumes Rosewash everywhere. Both are user-rebindable at
  `chrome://extensions/shortcuts` or `edge://extensions/shortcuts`. Firefox's
  button shows instructions for `about:addons` → gear menu → Manage Extension
  Shortcuts, since extensions cannot open that privileged page directly.
  Chrome may leave a new command unassigned
  on update, and the settings page then shows Not set.
- `src/content/picker.js` loads after `content.js` in every frame but only
  runs in the top frame.

`browserKind()` identifies Firefox by its extension URL scheme, then Edge by
its user agent. `pageRestrictionForUrl()` reports browser-internal pages and
the corresponding store restrictions; Firefox also excludes its protected
Mozilla account, support, and add-on domains.

## Content pipeline (critical path)

On every page match, roughly:

1. **CSS inject** (`theme.css`) is available but inactive until
   `html[data-rosewash-theme]` exists.
2. **`loadSettings()`** reads raw `chrome.storage.sync` (no default merge,
   so a legacy `preset` is not hidden by default `presetLight`/`presetDark`),
   replaces the cache, and marks settings loaded. No colors, fonts, or layouts
   apply before this read, so default-off and blocked sites stay untouched.
3. **`applyCachedSettings()`** resolves the site policy, applies layouts, and
   runs the engine. `theme.css` becomes active when the engine sets the theme
   attribute. Disabled sites clear the theme instead.
4. `storage.onChanged` and background notifications read current storage,
   replace the cache, and re-apply. A read counter discards older overlapping
   results. Notifications carry no settings snapshot.
5. `matchMedia` dark changes, `DOMContentLoaded`, `load`, `pageshow`, and
   `visibilitychange` re-apply from the **in-page settings cache**. System theme
   changes need no storage read. If the resolved palette did not change,
   ordinary re-applies skip the full DOM walk and only refresh root CSS
   variables. `DOMContentLoaded` and `load` also request a batched refresh
   to cover styles that arrived after the initial scan.

### Extension context safety

Chrome leaves old content scripts alive after extension reload. Calls into
`chrome.*` then throw `Extension context invalidated`. `content.js`:

- Checks `chrome.runtime.id` before wiring.
- `dispose()` removes listeners and disconnects the observer on failure.
- Does not keep calling storage from a dead context.

### Stale style cleanup

The engine records each inline property it changes, including its previous
value and priority and the applied override. Restoration writes the previous
value only while the current declaration still matches that override. Later
website updates and untouched properties, such as X's asynchronously loaded
background images, remain in place. Restored records are discarded so the
next tint captures the current page styles.

Records are mirrored onto `data-rosewash-style-overrides`, written once per
element after each scan slice rather than once per property. A new
content-script instance calls `restoreStaleTintedElements()` on first apply to
remove orphaned tints, including those inside open shadow roots. Whole-style
snapshots from earlier versions are also cleaned up.

Attributes used:

| Attribute | Purpose |
| --- | --- |
| `data-rosewash-theme` | Active theme key for CSS (`{preset}-light` / `{preset}-dark`; legacy aliases `dawn` / `moon` still resolve in `PALETTES`) |
| `data-rosewash-tinted` | Element was touched by the engine |
| `data-rosewash-style-overrides` | Original and applied declarations for properties changed by the engine |
| `data-rosewash-had-style`, `data-rosewash-original-style` | Whole-style snapshots from earlier versions, read only during stale cleanup |
| `data-rosewash-ignore` | Opt-out marker (also in `SKIP_SELECTOR`) |
| `data-rosewash-dim` | Image dimming is active; `--rosewash-image-brightness` holds the factor |

## Engine (`src/content/core.js`)

IIFE that freezes `globalThis.RosewashCore`. Tested by loading the file in a
Node `vm` context (`test/core.test.js`). Arrays returned from the sandbox need
`JSON` round-trip (`plain()`) before `assert.deepEqual` across realms.

### Palettes

Presets live in `RosewashCore.PRESETS` (28 families aligned with Codex app code
themes, plus plain Light and Dark options). Each entry has optional `light` / `dark` token sets:

`base`, `surface`, `overlay`, `muted`, `text`, `link`.

The plain presets use `tint: false`. Their tokens color only the popup and
settings UI; pages retain their own colors and browser controls. `listPresets`
puts the plain option first, Rose Pine second, then sorts other families by
label within each variant.

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
`color(srgb ...)`, `lab()`, `oklab()`, `lch()`, `oklch()` (enough for modern
Tailwind output). sRGB parsing handles numeric and percentage channels, alpha,
and missing (`none`) components. This covers computed colors from
`color-mix(in srgb, ...)` and relative RGB colors, including translucent page
headers such as Lanyon.AI's. Other `color()` spaces are not parsed.

Helpers classify near-white, dark surfaces, opaque text, low-chroma borders,
and generated gradients. A background containing `url()` is treated as media,
including backgrounds with both image and gradient layers.

### Full-page cover (`processElement`)

For each non-skipped element:

1. **Page chrome** (`header`, `[role=banner]`, top-level `nav`, Zhihu
   `.AppHeader` / `.LeanAppHeaderBar` / `.MobileAppHeader` outside
   `main`/`article`): force `palette.base` + clear generated backgrounds with
   `!important`; descendants get forced text color.
2. **Surfaces**: any opaque background (or CSS gradient) maps via
   `surfaceColorFor` to `base` / `surface` / `overlay`. If that color still
   shares paper with an opaque ancestor (`colorsSharePaper`, about 12 levels
   per channel), it keeps the ancestor's fill instead. Transparent
   `html`/`body` still count as the default canvas. `url()` backgrounds are
   left alone. Colors already matching one of the active palette's three
   surface tokens keep that role, so repeated scans cannot turn a page shell
   or elevated region into a different layer.
3. **Text**: opaque colors → `palette.text`; anchors → `palette.link`.
   Generated gradients clipped to text become palette text rather than a
   painted surface. Their background image is cleared and
   `-webkit-text-fill-color` is set to `currentColor`; the original fill is
   restored when tinting is cleared. Ordinary `code`, `kbd`, and `samp`
   elements and their children follow the palette.
4. **Borders**: a low-chroma border is recolored to `palette.muted` only when
   that side is already painted (`isPaintedBorder`: width above 0 and a style
   other than `none` / `hidden`) and the stroke is not the same paper as the
   element's own fill. Unpainted sides are not written. Sites such as
   WordPress global styles turn an inline `border-*-color` into
   `border-style: solid`, which would frame every element.

Skip list includes media, canvas, SVG, iframe, form controls, editor and
rendered formula surfaces (CodeMirror, Monaco, hljs, KaTeX, MathJax), and
`[data-rosewash-ignore]`.

### Root CSS variable remapping

Pseudo-elements cannot take per-element inline tints.

- **`theme.css`**: while `data-rosewash-theme` is set, force ChatGPT surface
  tokens and Substack publication tokens on root / `.dark` scopes; pin sticky
  footer fade pseudos (`thread-bottom-container`, `threadFooterContentFade`)
  to `--rosewash-base`; cover SPA roots plus Substack shells (`#entry`,
  `#main`, `.use-theme-bg`, `.intro-popup`).
- **Engine** (`SURFACE_VAR_*` / `TEXT_VAR_*` / `FORCED_SURFACE_VARS` in
  `core.js`): rewrite matching root custom properties to palette colors with
  `!important`. Known ChatGPT / Substack surface names are forced even for
  unparseable values. Records retain original and applied values and priorities.
  Restoration writes the original declaration only if the current value and
  priority still match the applied override. Later website writes survive;
  re-applying captures them as the new original before tinting again.

### Scan slices

Scans run through a queue in document order, so ancestors are painted before
their descendants. Each frame processes batches of 1000 elements until 8 ms
have passed, then continues in the next frame. Protected formula subtrees
skip style reads; inherited custom fonts and unchanged theme tokens avoid
redundant writes. A batch restores the elements
it is about to refresh, reads all of their computed styles, then writes, so
styles recalculate once per batch. Elements waiting in the queue keep their
previous tint; refreshes and theme changes do not flash page colors. A
document refresh, theme change, or clear resets the queue.

### Backdrop canvases

Canvas pixels cannot take CSS surface colors. A `canvas` covering at least
half the viewport is treated as a painted backdrop: the engine reads five
48×48 patches through its 2D context, averages the luminance of opaque
pixels, and sets `filter: invert(1) hue-rotate(180deg)` when the tone fights
the resolved palette (dark canvas under a light palette, or the reverse).
Samples between the two thresholds keep the current state so animated
canvases do not flicker. Mostly transparent canvases, WebGL and tainted
contexts, small canvases, and picker-ignored subtrees stay untouched. The
filter uses the same inline-style records as tints, so palette changes and
`clear()` restore it. Sampling runs after each scan flush and on apply,
which also catches canvases that paint after `document_start`.

### Shadow DOM

Open shadow roots are queued right after their host, remembered, and observed
with the same options as the document. Ancestor lookups for shared paper and
page chrome cross from a shadow root to its host. Restore, stats, and stale
cleanup include shadow content. Closed shadow roots, and custom elements that
attach a shadow root after their host was scanned, are not covered.

### MutationObserver

- Observes added nodes and class changes. New subtrees are scanned directly;
  class changes restore and rescan only the affected subtree.
- Inserting or editing a `style` element, or loading a stylesheet `link`,
  reads that sheet's rules. Only rules that declare colors, backgrounds,
  borders, fonts, or custom properties matter; their selectors are queried in
  the sheet's own document or shadow root, and the matched elements refresh as
  subtrees. A rule that matches `html` refreshes the whole page, as do sheets
  whose rules cannot be read (cross-origin links) or selectors that cannot be
  queried. Unrelated rules, such as `will-change` styles injected on X, cause
  no refresh.
- Nested scan requests are folded into their queued ancestor; a child refresh
  promotes that ancestor to refresh too. Inline style changes made by the
  engine are not observed, avoiding a scan loop.
- Coalesces to **`requestAnimationFrame`** (not a multi-hundred-ms debounce)
  so SPA navigations cover before the next paint when possible.
- Restore walks **connected** `[data-rosewash-tinted]` nodes. Detached feed
  cells are not kept in a strong `Set`, so infinite-scroll pages can GC them.

### Apply / clear rules

- Disabled or blocked host → `clear()` (restore inline styles, CSS vars, drop
  theme attribute, disconnect observer).
- Plain Light / Dark → restore previous tints and root CSS variables, clear
  theme tokens, and skip page-tone sampling and color overrides. With no
  custom fonts selected, skip DOM scanning and disconnect the observer.
  Custom fonts and site layouts remain independent of palette tinting.
- Theme overrides off → resolve to the corresponding plain palette without
  changing `presetLight` or `presetDark`. Image dimming also stops.
- Theme/mode change → full rescan that restores each element in its own
  slice. Switching to a state with nothing to scan restores everything at once.
- Same resolved theme (tab focus, `pageshow`) refreshes root CSS
  variables and keeps the observer, but does **not** walk the whole document.
  New nodes still arrive through the mutation scan.
- Page completion and stylesheet updates explicitly request a refresh even
  when the resolved theme is unchanged. Pending scans and stylesheet listeners
  are removed on clear or disconnect.
- Page-tone sampling runs on first apply and on palette change only. Full
  cover does not use page tone for surface choice.

## Custom fonts

`core.js` registers local `FontFace` objects in `document.fonts`. English and
Chinese faces have separate Unicode ranges; MathML and monospace faces cover
all characters but are applied only to their respective content.
`createFontFaces` constructs the same definitions for page rendering and settings
previews. Static families register Regular (400), Bold (700), Italic (400), and
Bold Italic (700). Local sources use common full and PostScript face names;
variant sources contain only that variant's names. Selected names ending in
Regular also resolve sibling styles from their shared base name.

Families explicitly ending in the word Variable register normal and italic
faces with a `1 1000` weight range. The browser limits this range to the font's
actual supported weights. This naming rule covers families such as Inter Variable;
it does not inspect font metadata or detect every variable family.

`registerFontFaces` adds and loads the faces, removing any that fail to load.
An unavailable variant then leaves the family's other faces eligible for normal
browser matching and synthesis. The engine deduplicates family aliases before
prepending them to a page's font stack.

Only the font family is replaced; page sizes, weights, italics, and line spacing
retain their CSS values. Separate heading/body choices and additional static
weights remain planned in `PLAN.md`. `test/fixtures/font-styles-page.html` provides
regular, bold, italic, bold italic, heading, mixed-text, and code samples.

Font routing uses the same batched computed-style snapshots as tinting.
Native `math` descendants use the math face; `pre`, `code`, `kbd`, `samp`,
and computed monospace text use the monospace face. SVG, KaTeX, MathJax,
editors, icon fonts, and opt-out elements retain their original font stacks.
The original page stack remains after each custom face for uncovered glyphs.

Changing fonts restores styles and rescans even when the palette is unchanged.
Disabling the extension, blocking the site, or turning custom fonts off removes
the registered faces and restores inline font declarations and priorities.
Newly added subtrees receive the current font settings through the observer.

## theme.css

Active only under `html[data-rosewash-theme]`:

- Sets `--rosewash-*` tokens and `color-scheme`.
- Forces `html`/`body` base + body text.
- Covers common SPA roots (`#react-root`, `#root`, `#app`, `#__next`,
  `[data-testid=primaryColumn]`, `main`, …) and Substack shells (`#entry`,
  `#main`, `.use-theme-bg`, intro popup).
- Forces Zhihu header shells and descendant text/links with `!important`
  (`:is(div, span, a, …)`, not `:not(svg *)`).
- Selection and default link colors.

This is the first-frame layer; nested boxes still need the JS engine.

## Background settings queue

`src/background/background.js` loads core with `importScripts` in Chromium;
Firefox loads it first through `background.scripts`.
All settings writes run through `settingsQueue`: popup edits, options saves
and resets, and the site-toggle shortcut. Each operation reads current storage,
normalizes and merges its edit, persists it, and removes migrated legacy keys.
A rejected operation reports an error without blocking later saves.

`mergeSettingsEdits(latest, baseline, edited)` applies fields changed from the
UI baseline. Host lists merge additions and removals with the latest lists.
`ignoredElements` merges the same way per host, so a picker save made while the
settings page is open survives that page's next automatic save.
An explicit addition removes the same hostname from the opposite list; if the
edited form includes it in both lists, the disabled rule wins. Other hosts and
untouched fields retain external changes.

The popup sends every edit immediately. Once received, the worker owns the
save even if the popup closes. Message handlers accept write requests only
from this extension's UI pages, checking the sender ID and extension URL.
Replies use `{ ok: true, settings }` or `{ ok: false, error }`.

The picker's `rosewash:ignore-element` message is the only write accepted from
a content script. It must come from this extension and from the tab's top
frame (`frameId` 0); the host is taken from the sender tab's URL, never from
the message. The worker appends the selector and notifies that tab.

`toggle-enabled` flips `enabled` and notifies all tabs.

The worker also sets a per-tab toolbar icon with `chrome.action.setIcon`:
`icons/icon-*.png` while Rosewash runs on the tab's site, `icons/icon-off-*.png`
when it is paused globally, the site is off, or the page is protected. Icons
refresh when a tab starts loading or changes URL, on every sync storage change,
and on startup and install.

The `toggle-current-site` command resolves the command tab (or active tab),
skips protected pages, and calls `toggleHostEnabled` against current settings.
After saving, it notifies that tab; UI saves notify all tabs. Notifications
contain only `{ type: "rosewash:settings-updated" }`. Content scripts read
current storage before applying, so delayed notifications cannot restore an
old snapshot. Notification responses never block the next save.

## Popup & options

**Popup**

- Uses a 292px classic layout: host, global switch, appearance, light and dark
  palette selectors, Fonts switch, site controls, and Settings / Refresh.
- Pick sits immediately before Allowed / Blocked. The site button saves an
  explicit on/off rule. Storage changes update the open popup.
- X and Zhihu layout switches appear only on their matching hosts. Font
  choices, image dimming, widths, site lists, and shortcut bindings live in
  settings. The popup Fonts switch shares `customFontsEnabled` with settings.
- Browser-protected pages show Unavailable with a reason and disable the site
  button, picker, and Refresh.
- Every edit sends its baseline and edited settings to the worker immediately.
  Pending edits remain visible until saves finish, then current storage reloads.
- Pick starts the top-frame element picker and closes the popup. It is disabled
  while globally paused, blocked on the site, or on a protected page.

**Options**

- Four tabs: Theme, Fonts, Sites, and Shortcuts. The tab label identifies
  its panel; there is no repeated panel heading.
- Light and dark palettes remain expanded in equal-width button grids.
  Settings chrome follows the selected palette and system appearance.
- Override theme and Override fonts are independent switches. Theme overrides
  use `colorOverridesEnabled`, which defaults to true for existing installs.
- Changes save automatically through the background merge queue. Text and
  sliders debounce by 350ms; change, tab switches, page hiding, and page exit
  flush pending input. Each edit advances its baseline before sending, so
  rapid reversals remain ordered. Save responses leave current form edits intact.
- Saving / Saved feedback clears after success; failures remain visible.
- The shared font picker enumerates system fonts in Chromium with
  `chrome.fontSettings.getFontList()`. Its searchable list is capped at 280px,
  scrolls, and opens above the field when space below is limited. Arrow keys
  navigate, Enter commits, and Escape closes; searching never saves a font.
  In Firefox, its four fields accept
  installed font names directly; blank fields preserve page fonts. Four
  independent previews use the same local FontFace definitions as pages.
  Enumeration and preview errors are shown.
- Clean Layout groups X.com and 知乎 zhihu.com cards with a switch and column
  width slider. Always on / Always off lists and ignored elements follow.
- Images use one row for the dimming switch, brightness slider, and percentage.
  The slider is disabled while dimming is off.
- Shortcuts shows actual bindings or Not set. Change shortcuts opens Chromium
  shortcut settings or displays Firefox's manual instructions; bindings refresh
  on opening, focus, and return.
- Removing an ignored-element rule saves immediately through the per-site merge.

## Element picker

`src/content/picker.js` starts on `rosewash:start-picker` from an extension
page. It draws a highlight box and a tooltip inside a closed shadow root on a
host marked `data-rosewash-ignore`, so neither the engine nor page styles
touch it. Pointer movement selects the element under the cursor, read from
`composedPath()` so open shadow roots resolve to the inner element. ↑ widens
the selection to the parent and ↓ steps back. Clicks and pointer presses are
blocked in the capture phase, so selecting a link does not follow it. A click
saves the selector; Esc cancels.

`selectorForElement(element, countMatches)` in `core.js` builds the shortest
`>` path that matches only the element in its document or shadow root. It
prefers ids without long digit runs, then the tag with up to two stable
classes, and adds `:nth-of-type()` among same-tag siblings. Hashed build
classes (`css-1jxf684`, `r-bcqeeo`) and state classes (`is-active`, `open`, …)
never anchor a selector.

The engine joins the site's queryable selectors into one list. Elements that
match it, or sit inside a match across shadow boundaries, are skipped by the
scan queue: no tint and no custom font. Changing the list restores and rescans
like a palette change, so newly ignored elements return to their page styles.

## Image dimming

`applyImageDimming` sets `data-rosewash-dim` and
`--rosewash-image-brightness` on `html` only when `dimImages` is on and the
resolved theme is a tinted dark palette; plain Dark leaves pages unchanged.
`theme.css` then applies `filter: brightness(...)` to `img`, `video`, and SVG
`image` elements. `clear()` removes both. The stylesheet does not reach inside
shadow roots, and CSS background images are not dimmed.

## X compact layout

`manifest.json` injects `src/sites/x.css` and `x.js` on `https://x.com/*` at
`document_start`. The content runtime marks X with `data-rosewash-x-compact`
when Rosewash is enabled, X is not blocked, and `xCompactLayout` is true.

- `x.js` marks the compose and account-switcher controls so the tint engine
  does not paint over the compact rail. It associates newly opened profile
  cards with their avatar links in a `WeakMap`. Delegated pointer events
  retain the native hover state while the pointer is inside the portaled
  card, releasing X's avatar-only hover poll first. Leaving the card releases
  that state; disabling the layout stops hover handling and releases it too.
- The independent `xAutoExpandReplies` switch in Settings → Sites → X.com
  defaults to off. The content runtime sets `data-rosewash-x-expand-replies`
  while Rosewash and the site are enabled. At any viewport width, `x.js`
  clicks `tweet-text-show-more-link` controls in posts after the current detail
  post, skipping ancestors, the current post, and quoted content. Added replies
  and native navigation events trigger batched checks. A `WeakMap` prevents
  repeat clicks while allowing virtualized buttons to serve different posts.
  Home timelines and controls that load additional replies remain untouched.
- `x.css` collapses the navigation rail, keeps X's Explore/search entry in that
  rail, hides the redundant right search column, and stretches virtualized post
  cells to the selected single-column width from `min-width: 720px`. The width
  shrinks to the available viewport. The column stays viewport-centered when
  space permits and keeps at least 12px clear of the 88px navigation rail.
  Rail containers reset native horizontal margins and padding, with navigation
  icons, the compose button, and the account avatar centered in the rail.
  Home, bookmarks, profiles, search, and thread pages share that column.
  Below 720px, X keeps its native mobile layout.
- `test/x-layout.test.js` covers the rail, centering, width setting, and the
  absence of a split-thread overlay.

## Zhihu clean layout

`manifest.json` injects `src/sites/zhihu.css` and `zhihu.js` on `zhihu.com`,
`www.zhihu.com`, and `zhuanlan.zhihu.com` at `document_start`. The content
runtime marks Zhihu hosts with `data-rosewash-zhihu-layout` when Rosewash is
enabled, Zhihu is not blocked, and `zhihuArticleLayout` is true. `zhihu.js`
adds a page marker at every viewport width: `data-rosewash-zhihu-home` on `/`, `/follow`,
and `/hot`; `data-rosewash-zhihu-question` on `/question/{id}`; and
`data-rosewash-zhihu-article` on `/p/{id}`. The isolated content script listens
to the native `navigation.currententrychange` event, covering page-world
`history.pushState` / `replaceState` and browser back/forward navigation.
The observer only watches the layout attribute on `html`.

- `zhihu.css` hides article top bars and extra side chrome, then centers
  reading content at the selected width. Home, question, profile, and other
  non-article pages retain navigation and its native top clearance. Reading
  width variables are scoped to content so the header keeps its own layout.
  The width shrinks to the available viewport with 24px gutters. Question headers clear native minimum
  widths; author details shrink beside follow buttons. Topic metadata, home
  composer tools, and content action bars wrap as needed. Fixed answer actions
  and their placeholders use the reading-column width after resizing.
- `test/zhihu-layout.test.js` covers the hide/center rules, route markers,
  and width setting.

Popup and options load `src/content/core.js` for `PRESETS` / `listPresets` /
`normalizeSettings`. Engine + background also share `core.js`.

## Messaging contract

| Message type | Direction | Purpose |
| --- | --- | --- |
| `rosewash:edit-settings` | popup / options → background | Merge `baseline` and edited `settings` into current storage |
| `rosewash:set-host-policy` | popup → background | Apply `host` and `policy` to current settings |
| `rosewash:reset-settings` | options → background | Save defaults through the write queue |
| `rosewash:reapply` | popup → background | Notify open tabs to read and apply current storage |
| `rosewash:start-picker` | popup → content (top frame) | Start the element picker |
| `rosewash:ignore-element` | picker → background | Save `selector` for the sender tab's host |
| `rosewash:settings-updated` | background → content | Read current storage, apply, and respond with `stats` |

Storage remains the source of truth across tabs and the service worker.

## Testing & packaging

```sh
just test       # node --test test/*.test.js
just validate   # manifest + required files + --check scripts
just check      # test + validate
just dist       # copy manifest + html + src → dist/ (Load unpacked)
just package    # check + dist + zip → release/rosewash-vX.Y.Z.zip
just clean      # remove .tmp and local debug leftovers
```

| Area | How |
| --- | --- |
| Engine unit tests | `test/core.test.js` loads `core.js` in `vm` |
| Content startup | `test/content.test.js` verifies stored policy gating and layout changes |
| Background | `test/background.test.js` covers ordered writes, closed senders, blocked notifications, shortcut concurrency, failures, and protected pages |
| Settings UI | `test/settings.test.js` runs UI and background scripts with mocked browser APIs; covers popup closure, stale reads, form merging, conflicting site rules, and migration |
| Browser fixtures | `test/fixtures/*` HTML + runners (manual / scripted) |
| Validate | Requires background runtime files, the site-toggle command, storage + `<all_urls>` |

No commit/push automation unless the user asks. Feature work should land on a
branch other than `main`.

## Invariants / design rules

1. **No site-specific rules** until generic cover fails; known chrome classes
   (Zhihu) are narrow exceptions already documented.
2. **Bounded DOM work**: added nodes and class changes scan their subtrees;
   stylesheets refresh only the elements their color rules select; page
   completion requests a full refresh. Scans run in time-boxed slices.
   No continuous `getComputedStyle` loops.
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
| Settings field | schema in all of: core defaults, content `handleStorageChanged`, popup, options, docs |

## Related docs

- [architecture.md](./architecture.md) — conceptual layers
- [../README.md](../README.md) — install and feature list
- [../PLAN.md](../PLAN.md) — milestones and next work
- [../changelog.md](../changelog.md) — shipped changes
- [../AGENTS.md](../AGENTS.md) — agent entry point for this repo
