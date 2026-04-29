# PLAN

## Goal

Build a compact Rose Pine eye-comfort extension that stays fast and visually
quiet. The MVP focuses on white-surface tinting instead of full page recoloring.

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

## Implementation Rules

- Keep content scanning bounded and throttled.
- Process added DOM nodes, not the whole document on every mutation.
- Preserve media, canvas, SVG, editors, form controls, and code blocks.
- Store user state in `chrome.storage.sync`.
- Avoid site-specific rules until the generic behavior proves insufficient.

## Next Milestones

1. Add a strength slider that blends original white with Rose Pine paper tones.
2. Add keyboard shortcuts for global toggle and site toggle.
3. Add optional site presets for complex pages such as GitHub, arXiv, Notion,
   Overleaf, and Google Docs.
4. Add Firefox packaging after the Chromium version feels stable.
