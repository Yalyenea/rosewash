# Changelog

## Unreleased

- Added `Alt+Shift+P` PDF Open in: download ordinary/arXiv PDFs, preserve
  pending state across MV3 worker suspension, then request a configurable local
  URL Scheme. Settings include a Serein preset and constrained custom template.
- Optional Zhihu article layout from 720px: hide the top bar and other
  non-article chrome, center a widescreen column, and pick 720–1080px.

## 0.2.0 - 2026-08-16

- 28 Codex-aligned palettes; light and dark chosen independently; Auto follows
  the system.
- Settings and popup use palette cards, separate light/dark selectors, and a
  compact General / Theme / Sites layout.
- Full-page paper cover, including CSS Color 4 pages, dark-only sites, and
  transparent canvases.
- Optional compact X layout from 720px: collapsed rail, centered timeline,
  search in the rail. Split threads from 1280px.
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
