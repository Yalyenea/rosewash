# PLAN

## Goal

Build a compact eye-comfort extension that stays fast and visually quiet. The
MVP starts with Rose Pine white-surface tinting instead of full page recoloring,
then grows into a small set of curated theme presets.

## Current Milestone: MVP

- [x] Manifest V3 extension scaffold.
- [x] Zero-dependency content tint engine.
- [x] Popup controls: enabled, Auto, Dawn, Moon, current-site block.
- [x] Options page for blocked sites.
- [x] Justfile, tests, validation script, docs, changelog.
- [x] Browser fixture verification.
- [x] Theme-switch restoration so Auto dark and manual Moon share one path.
- [x] Moon text tinting for explicit black/dark neutral text.
- [x] Runtime fixture for Auto system-theme change handling.
- [x] Cache-driven content runtime to avoid storage reads during Auto switches.
- [x] Invalidated-context fixture for orphaned content-script behavior.
- [x] No default pre-apply before stored settings load.
- [x] Stale Rosewash inline-style cleanup after extension reload.
- [x] Early `document_start` injection and immediate Auto theme reapply.
- [x] Dark-only page detection and Dawn adaptation for sites without a light
  appearance.
- [x] CSS Color 4 and SPA app-root sampling for modern dark-only pages.
- [x] Page-chrome tinting for headers, banners, nav, and known shells
  (arXiv-style bars, Zhihu `AppHeader` / `LeanAppHeaderBar` / `MobileAppHeader`).
- [x] Transparent `html`/`body` canvas tinting for legacy sites such as jmlr.org.

## Implementation Rules

- Keep content scanning bounded and throttled.
- Process added DOM nodes, not the whole document on every mutation.
- Preserve media, canvas, SVG, editors, form controls, and code blocks.
- Store user state in `chrome.storage.sync`.
- Avoid site-specific rules until the generic behavior proves insufficient.
- Keep dark-only adaptation generic: detect page tone first, then reuse the
  active light palette instead of adding URL rules.
- Include modern CSS color functions in tone detection before considering
  site-specific presets.
- Add theme presets through a shared palette registry, not scattered conditionals.
- Keep every preset small: base, surface, overlay, muted, text, and link tokens.

## Next Milestones

1. Ship companion Chromium theme packages (`themes/rosewash-dawn`,
   `themes/rosewash-moon`) whose frame/toolbar colors use the same **base**
   tokens as the content engine (`#faf4ed` / `#232136`), so Helium/Chrome UI
   matches Rosewash page canvas. Official Rosé Pine themes map toolbar to
   overlay and look one step darker than the page; document install steps for
   Helium and note that the built-in color picker cannot take exact hex.
2. Add a strength slider that blends original white with the selected preset's
   paper tones.
3. Add a theme preset selector. Keep Rose Pine as the default, then add a small
   curated set such as Catppuccin, Gruvbox, Nord, and Solarized.
4. Refactor settings from `mode` alone to `preset + appearance` so Auto, light,
   and dark variants work across all presets without duplicating UI logic.
5. Add keyboard shortcuts for global toggle and site toggle.
6. Split browser packaging into target-specific manifests and archives:
   Chromium first, Firefox next, Safari after the WebExtension wrapper path is
   understood.
7. Add Firefox packaging and validation:
   `browser_specific_settings.gecko.id`, Firefox manifest checks, and a real
   temporary-load smoke test.
8. Add Safari evaluation and packaging:
   Safari Web Extension conversion notes, Xcode wrapper output under `.tmp/`,
   and manual permission/storage/content-script smoke checks.
9. Add optional site presets for complex pages such as GitHub, arXiv, Notion,
   Overleaf, and Google Docs.
