# PLAN

## Goal

Build a compact eye-comfort extension that stays fast and visually quiet. The
MVP covers pages with Rose Pine Dawn/Moon (full-page palette remap, media and
recognized syntax highlighting protected), then grows into a small set of
curated theme presets.

## Current Milestone: MVP

- [x] Manifest V3 extension scaffold.
- [x] Zero-dependency content tint engine.
- [x] Popup controls: enabled, Auto, Dawn, Moon, current-site block.
- [x] Options page for blocked sites.
- [x] Keyboard shortcut to toggle blocked / allowed for the current site.
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
- [x] Full-page Rose Pine cover for arbitrary light/dark/cool-paper sites.
- [x] Dark-only page tone sampling retained for mixed re-detect diagnostics.
- [x] CSS Color 4 and SPA app-root sampling for modern pages.
- [x] Page-chrome tinting for headers, banners, nav, and known shells
  (arXiv-style bars, Zhihu `AppHeader` / `LeanAppHeaderBar` / `MobileAppHeader`).
- [x] Transparent `html`/`body` canvas tinting for legacy sites such as jmlr.org.
- [x] Root surface CSS-variable remapping so token-driven `::after` fades
  (ChatGPT thread footer) follow the paper palette.

## Known Limitations

### Chrome Web Store developer dashboard — 2026-09-30

- **Status:** blocked by Chromium policy; page tinting remains unavailable.
- **Affected pages:** `chrome.google.com` and `chromewebstore.google.com`,
  including `/u/1/webstore/devconsole/.../edit` and their subdomains.
- **Cause:** Chromium rejects extension script injection across these domains.
  The restriction includes the developer dashboard and applies even with
  `<all_urls>` host permissions.
- **Current handling:** the popup shows `Unavailable` with the reason and
  disables site toggling and Refresh. The site-toggle shortcut skips these
  pages. These changes explain the limitation; they do not enable tinting.
- **Revisit when:** Chromium changes this restriction or Google provides a
  supported way to customize the dashboard appearance.
- **Sources:** Chromium's
  [script injection restriction](https://github.com/chromium/chromium/blob/main/chrome/common/extensions/chrome_extensions_client.cc)
  and [Web Store domain matching](https://github.com/chromium/chromium/blob/main/extensions/common/extension_urls.cc).

## Implementation Rules

- Keep content scanning bounded and throttled.
- Process added DOM nodes, not the whole document on every mutation.
- Preserve media, canvas, SVG, editors, form controls, and recognized syntax
  highlighting; ordinary code follows the page palette.
- Store user state in `chrome.storage.sync`.
- Avoid site-specific rules until the generic behavior proves insufficient.
- Keep dark-only adaptation generic: detect page tone first, then reuse the
  active light palette instead of adding URL rules.
- Include modern CSS color functions in tone detection before considering
  site-specific presets.
- Add theme presets through a shared palette registry, not scattered conditionals.
- Keep every preset small: base, surface, overlay, muted, text, and link tokens.

## Next Milestones

1. Implemented, awaiting release: companion Chromium theme packages.
   `scripts/themes.mjs`
   generates a static Chromium theme per tinted preset/variant under
   `dist-themes/`, with frame/toolbar colors taken from the preset **base**
   tokens. `just themes` stages; `just package-all` and the release workflow
   archive `rosewash-v<version>-chromium-themes.zip`.
2. Add a strength slider that blends original white with the selected preset's
   paper tones.
3. ~~Add a theme preset selector.~~ Shipped: 28 Codex-aligned presets (Rose Pine
   default) with popup/options selector. Light and dark slots are independent.
4. ~~Refactor settings from `mode` alone to `preset + appearance`.~~ Shipped, then
   split to `presetLight` + `presetDark` + `appearance` with legacy `preset` /
   `mode` migration.
5. ~~Add keyboard shortcuts for global toggle and site toggle.~~ Site toggle
   shipped (`Alt+Shift+B`); global pause/resume shipped (`Alt+Shift+P`).
6. ~~Split browser packaging into target-specific manifests and archives.~~
   Shipped: `scripts/dist.mjs` and `scripts/browsers.mjs` target
   `chrome`, `edge`, `firefox` with per-browser manifests and archives;
   `just dist <browser>`, `just package <browser>`, `just package-all`.
7. ~~Add Firefox packaging and validation.~~ Shipped: `manifestForBrowser`
   sets `browser_specific_settings.gecko.id`, `strict_min_version: "148.0"`,
   `data_collection_permissions`, switches the background to an event page,
   and drops `fontSettings`. The release workflow
   archives `rosewash-v<version>-firefox.zip`.
8. Add Safari evaluation and packaging:
   Safari Web Extension conversion notes, Xcode wrapper output under `.tmp/`,
   and manual permission/storage/content-script smoke checks.
9. Add optional site presets for complex pages such as GitHub, arXiv, Notion,
   Overleaf, and Google Docs.
10. Implemented, awaiting release: Firefox browser-frame colors follow the
    active palette through the `theme` permission. Pausing or choosing a plain
    palette resets the browser theme.
11. Implemented, awaiting release: independent X reply-text expansion under
    Settings → Sites → X.com, including newly loaded replies and in-page navigation.
12. Preserve page typography when changing font families. Keep the page's
    heading hierarchy, font sizes, weights, italics, and line spacing by default.
    Match the selected family's actual light, regular, bold, and italic faces,
    including variable font weight ranges. Current local faces resolve mainly
    to Regular, so bold and italic text can use browser synthesis.
    Add optional, separate body and heading font choices, such as Inter for
    body text and Inter Display for headings. Preview and verify body text,
    headings, bold, and italics together when switching families.
