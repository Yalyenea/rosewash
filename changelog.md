# Changelog

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
