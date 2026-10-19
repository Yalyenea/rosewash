# Changelog

## 0.2.5 - 2026-10-18

- Add separate Edge and Firefox packages. Firefox supports desktop version
  148 or newer and accepts installed font names in settings; Chrome and Edge
  keep the automatic font picker.
- Show browser-specific shortcut instructions and protected-page states.
- Restore the compact classic popup with Pick beside the site state and
  layout controls shown only on their matching site.
- Rebuild settings into Appearance, Fonts, Sites, and Shortcuts tabs. Keep
  palette choices expanded and aligned; combine image dimming controls into
  one row and remove repeated headings and explanatory copy.
- Save settings automatically, including pending text edits when leaving the
  page. Preserve concurrent edits and rapid switch changes.
- Keep Zhihu navigation visible on home, question, profile, and other
  non-article pages. Only articles hide the top bar.
- Skip protected formula subtrees before reading styles. Reuse inherited
  custom fonts and avoid repeated writes of unchanged theme tokens.
- Keep scrolling smooth on pages that insert styles while they load content.
  New styles repaint only the elements their color, border, or font rules
  select, instead of the whole page. On X, scrolling no longer triggers
  page-wide repaints.
- Tint large pages across several frames instead of one long pause. Elements
  awaiting their turn keep the previous colors, so refreshes and theme changes
  do not flash the original page.
- Tint embedded frames, including cross-origin and blank frames. Frames follow
  the current site's on/off rule; X and Zhihu layouts stay on the top page.
- Tint content inside open shadow roots, such as Reddit's components.
- Add a Rosewash icon to the toolbar and extension pages, styled after the
  browser's lettered placeholder. It fades when Rosewash is paused, off for
  the current site, or blocked on the page.
- Pause or resume Rosewash on all sites with `Alt+Shift+P`. The settings page
  lists both shortcuts.
- Pick an element in the popup to leave it, and everything inside it,
  untouched on the current site. The settings page lists and removes each rule.
- Dim images and videos with dark palettes at 70, 80, or 90% brightness. The
  settings page combines the dimming switch, brightness slider, and value.
- Toggle the current site with an Allowed / Blocked button and reflect
  external settings changes immediately.
- Save popup, settings-page, and shortcut changes in order through the
  background service. Closing the popup keeps pending saves, and delayed
  page updates use the latest saved settings.
- Preserve changes made elsewhere when saving an open settings page. Merge
  site-list edits and replace conflicting rules when explicitly adding a site.
- Update Zhihu's reading layout after in-page navigation and browser
  back/forward actions.
- Preserve image backgrounds that include gradient layers.
- Restore root CSS variables with their original priorities, while preserving
  values changed later by the website.
- Keep X profile cards open when moving from an author's avatar into the
  card. Preserve native links and controls, and dismiss the card after the
  pointer leaves.
- Make Zhihu's clean layout work below 720px. Keep question headers, author
  controls, topic cards, and action bars within the viewport; wrap controls
  on narrow screens and keep fixed answer actions aligned after resizing.
- Fix X compact navigation overlapping the timeline in narrow windows. Keep
  at least 12px between the rail and content, and align navigation icons,
  the compose button, and the account avatar across desktop widths.
- Fix light headers left behind in dark mode when their computed backgrounds
  use `color(srgb ...)`, including Lanyon.AI. Parse sRGB colors produced by
  `color-mix()` and relative colors so surfaces, text, and borders follow the
  selected palette.

## 0.2.4 - 2026-10-11

- Keep the popup focused on the current site, appearance, and palettes. Move
  default site rules, fonts, and layout controls into More settings while
  retaining automatic font loading and immediate saving.
- Show the browser's actual shortcut in a button beside the current-site
  selector. Clicking it opens the browser's extension shortcut settings;
  unassigned shortcuts show Set key.
- Add the current shortcut and a Change shortcut button to the settings page.
  Refresh the binding when returning from the browser's shortcut settings,
  and report unavailable bindings explicitly.

## 0.2.3 - 2026-10-11

- Choose whether Rosewash starts enabled or disabled on new sites. Each site
  can follow the default, stay always on, or stay always off. Changing the
  default preserves explicit site choices; the shortcut saves an on/off choice.
- Expand the popup with all four font selectors, X and Zhihu layout controls,
  and column widths. Changes save immediately.
- Load installed system fonts automatically in the popup and settings page
  through the browser's font settings API. Add the required `fontSettings`
  permission and support regular face names for family-based font selections.
- Read stored site rules before applying colors, fonts, or layouts so sites
  that start disabled do not briefly receive the theme.

## 0.2.2 - 2026-10-08

- Fix blank X avatars and image previews after page loading, tint refreshes,
  or theme changes. Restore only properties changed by Rosewash and preserve
  later website style updates, including newly loaded background images.
- Explain browser restrictions on the Chrome Web Store and its developer
  dashboard in the popup. Disable unavailable site controls and skip the
  site-toggle shortcut on these pages.
- Keep gradient text readable when its background is replaced by the palette.
  Ordinary code, keyboard labels, and sample output now follow page colors;
  editors and recognized syntax-highlighting regions remain protected.
- Repair tints after page loading, late stylesheet loads, inserted or edited
  styles, and element class changes. Batch overlapping scans into the next
  frame while keeping idle tab-focus updates free of full-page scans.
- Add plain Light and Dark options at the top of their palette lists. They
  preserve website colors and restore previous tints; custom fonts and site
  layouts keep their independent settings.

## 0.2.1 - 2026-09-24

- Nested fills that match the page or their parent stay on the same paper
  color. Only borders that are already drawn are recolored, using the muted
  token, so block-heavy pages do not turn into stripes and frames.
- Add separate English, Chinese, native MathML, and monospace font settings,
  with a system font picker and live previews. Font access requires browser
  permission; leaving a category unset preserves its page font.
- Flatten and compact the settings page, remove redundant descriptions, and
  follow the selected light/dark palettes and system appearance.
- Cut content-engine work on idle tabs: drop detached tinted nodes, skip the
  full DOM walk when the palette is unchanged, and batch computed-style reads
  before writes. Zhihu layout watches `pushState` instead of the whole tree.
  Theme CSS drops `:not(svg *)` and the broad `thread-bottom` substring.
  X compact still stretches timeline cells when the column width changes.
- Optional X compact layout from 720px: collapse the navigation rail, hide the
  right search column, and center a single-column stream at 520–760px. Thread
  pages stay native single-column.
- Optional Zhihu clean layout from 720px: hide the top bar and other chrome
  on home, questions, and articles, center a widescreen column, and pick
  720–1080px.

## 0.2.0 - 2026-08-16

- 28 Codex-aligned palettes; light and dark chosen independently; Auto follows
  the system.
- Settings and popup use palette cards, separate light/dark selectors, and a
  compact General / Theme / Sites layout.
- Full-page paper cover, including CSS Color 4 pages, dark-only sites, and
  transparent canvases.
- Site covers for ChatGPT, Substack, Zhihu, arXiv, and jmlr-style pages.
- Fewer white flashes and background seams on SPA and infinite-scroll pages.
- `Alt+Shift+B` toggles the current site. Load unpacked from `dist/` after
  `just dist`; GitHub Releases ship a zip.

## 0.1.0 - 2026-04-29

- Added the initial Manifest V3 Rosewash extension.
- Added Dawn, Moon, and Auto mode.
- Added near-white background, border, and neutral-text tinting.
- Added popup controls and a settings page.
- Added per-site block list support.
- Added `just` tasks, Node tests, manifest validation, and project docs.
- Added JavaScript syntax checks to the validation path.
- Fixed theme switching so Auto dark and manual Moon resolve through the same
  restored tint path.
- Fixed Moon mode so explicit black and dark neutral text turns into Rose Pine
  Moon text.
- Fixed Auto system-theme changes by reapplying after the media-query change
  settles and by restoring when the raw mode changes.
- Added a runtime fixture that exercises Auto light-to-dark changes through the
  content script path.
- Reworked the content runtime around a settings cache so Auto theme changes do
  not call `chrome.storage` from old page contexts.
- Added an invalidated-context fixture for orphaned content scripts after
  extension reloads.
- Stopped applying default settings before stored settings load.
- Added stale Rosewash inline-style cleanup for extension reloads.
- Added explicit `<all_urls>` host permission for page tinting.
- Switched content injection to `document_start` and removed the extra
  animation-frame delay from Auto theme reapplication.
