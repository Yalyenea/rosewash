# Changelog

## Unreleased

- Added agent-facing docs: `AGENTS.md` entry point and
  `docs/implementation.md` (settings, content pipeline, engine, commands, tests).
- Added default keyboard shortcut `Alt+Shift+B` to toggle blocked / allowed for
  the current site (`chrome.commands` + background service worker). Rebind under
  `chrome://extensions/shortcuts`.
- Fixed full-cover FOUC and SPA white flashes: provisional `data-rosewash-theme`
  at `document_start` so theme.css paints the canvas before storage returns;
  dropped mixed-tone full restore on load; mutation scans run on the next
  animation frame instead of a 250ms delay; CSS-var re-apply is diffed; surface
  and text tints use `!important`; common SPA roots (`#react-root`, `main`, …)
  get base paper from theme.css so x.com-style navigations do not flash white.
- Switched from selective near-white tinting to full-page Rose Pine cover:
  any opaque surface, text, and low-chroma border maps into the active Dawn or
  Moon palette, so cool paper sites (e.g. mikaelhuuhtanen.com), dark-only
  shells, and ordinary light pages all follow Auto / Dawn / Moon.
- Remapped additional root design tokens (`--ground`, `--ink`, theme
  backgrounds) so CSS-variable pages and pseudo-elements track the paper
  palette.
- Forced `html`/`body` canvas and link colors through `theme.css` for an
  immediate base cover before the DOM scan finishes.
- Fixed ChatGPT-style sticky footer fades painted on `::after` via design tokens
  such as `--main-surface-primary`: Rosewash now remaps near-white root surface
  CSS variables to the active paper palette so pseudo-elements and token-based
  shadows follow the page base (inline styles cannot target `::before`/`::after`).
- Expanded README install docs: Install From Release (download zip, extract,
  load unpacked, update steps) and Install From Source for development.
- Blended page-level headers and navigation bars into the page base, including
  colored top bars on arXiv and similarly structured pages.
- Included Zhihu-style `.AppHeader` shells in page-chrome tinting so white and
  branded top bars map to the active page base.
- Forced Zhihu top bars (`.AppHeader`, `.LeanAppHeaderBar`, `.MobileAppHeader`)
  through extension CSS and `!important` inline fills so Emotion/CSS-in-JS
  backgrounds cannot keep pure white chrome.
- Fixed page-chrome restore tracking, near-white surface overwrites of chrome
  base fills, and `tintText` stripping chrome `!important` text colors.
- Tinted default transparent `html`/`body` canvases so legacy journal sites
  such as jmlr.org (no explicit white background) receive the page base.
- Planned companion Chromium theme packages that map Helium/Chrome chrome UI to
  the same Rosewash base colors as the page canvas (official Rosé Pine themes
  use overlay for the toolbar and look one step darker).
- Planned the next roadmap around strength control, curated theme presets, and
  target-specific Chromium, Firefox, and Safari packaging.
- Documented the future `preset + appearance` settings direction for adding
  non-Rose-Pine palettes without spreading theme-specific branches through the
  content engine.
- Added the MIT license file for public repository publishing.
- Added a GitHub Actions release workflow that builds and uploads the extension
  zip for version tags.
- Added README screenshots for Dawn and Moon effects on public, account-free
  pages.
- Removed the local absolute install path from README.
- Added dark-only page detection so Dawn and Auto-light can adapt sites that do
  not provide a native light appearance.
- Fixed dark-only detection for modern CSS Color 4 pages that expose colors as
  `lab()`, `oklab()`, `lch()`, or `oklch()` and for SPA roots outside semantic
  layout elements.
- Fixed document-start dark-only pages so Dawn/Auto-light re-detects them after
  the page body loads instead of requiring the popup switch to be toggled.
- Fixed dark-only detection for branded publication shells such as Substack
  pages that paint a dark theme through nested `#entry` / `div#main` wrappers
  and CSS variables (`--theme_bg_is_dark`, `--web_bg_color`) without a
  semantic `<main>` or `prefers-color-scheme` signal.

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
