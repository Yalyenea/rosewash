# Architecture

Rosewash has three small layers.

## Content Engine

`src/content/core.js` is the testable engine. It owns:

- Rose Pine Dawn and Moon tokens.
- Color parsing and near-white detection.
- Site block matching.
- DOM tinting and restoration.
- A throttled `MutationObserver` for newly inserted elements.

The engine only writes inline styles to elements it has classified as needing a
small accessibility tint: near-white surfaces, near-white borders, or dark
neutral text in Moon mode. Original inline values are recorded and restored when
the extension is disabled, the current host is blocked, or the active theme
changes.

Original inline style snapshots are also mirrored onto `data-rosewash-*`
attributes. This lets a new content-script instance clean up stale inline styles
left by an older orphaned script after extension reload.

## Extension Runtime

`src/content/content.js` wires the engine to Chrome extension APIs:

- Reads settings from `chrome.storage.sync`.
- Keeps an in-page settings cache after the first storage read.
- Does not apply the default settings before storage has returned.
- Re-applies on storage changes.
- Re-applies from the cache one animation frame after system dark mode changes
  in Auto mode, so page media-query recalculation and Rosewash tinting do not
  race.
- Re-checks settings when a page becomes visible again.
- Accepts popup refresh messages.
- Stops DOM listeners if the extension context is already invalidated.

## UI

`popup.html` is the daily control surface. `options.html` is only for editing
the block list. Both are plain HTML/CSS/JS and share the same storage schema:

```json
{
  "enabled": true,
  "mode": "auto",
  "disabledHosts": []
}
```

## Performance Boundary

The MVP scans the existing DOM once on load, then only scans newly added nodes.
If the resolved theme or raw mode changes, already-tinted elements are restored
before the next scan so Auto dark and manual Moon use the same color path. It
does not walk every element on each mutation and does not call
`getComputedStyle()` inside a continuous loop.

System theme changes do not call `chrome.storage` again. This avoids the common
MV3 reload/update failure where an orphaned content script keeps running in an
old page context and `chrome.*` calls throw `Extension context invalidated`.
