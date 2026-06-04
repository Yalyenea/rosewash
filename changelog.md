# Changelog

## Unreleased

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
