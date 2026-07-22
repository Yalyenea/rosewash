(function () {
  "use strict";

  const core = globalThis.RosewashCore;
  const engine = core.createEngine({ document, window });
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  let settingsCache = core.DEFAULT_SETTINGS;
  let settingsLoaded = false;
  let disposed = false;

  function hasExtensionContext() {
    try {
      return Boolean(globalThis.chrome && chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  function dispose() {
    disposed = true;
    darkQuery.removeEventListener("change", applyCachedSettings);
    document.removeEventListener("DOMContentLoaded", applyCachedSettings);
    window.removeEventListener("load", applyCachedSettings);
    window.removeEventListener("pageshow", applyCachedSettings);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    engine.disconnect();
  }

  function applyCachedSettings() {
    if (disposed) {
      return;
    }

    engine.apply(settingsCache);
  }

  // Paint the canvas token before chrome.storage returns so theme.css can
  // force html/body on the first frame. Refined once real settings load.
  function paintProvisionalRoot() {
    if (disposed || !document.documentElement) {
      return;
    }

    const theme = core.resolveThemeMode("auto", darkQuery.matches);
    document.documentElement.setAttribute("data-rosewash-theme", theme);
  }

  async function loadSettings() {
    if (!hasExtensionContext()) {
      dispose();
      return;
    }

    try {
      settingsCache = core.normalizeSettings(await chrome.storage.sync.get(core.DEFAULT_SETTINGS));
      settingsLoaded = true;
      applyCachedSettings();
    } catch {
      dispose();
    }
  }

  function handleStorageChanged(changes, areaName) {
    if (areaName !== "sync") {
      return;
    }

    const nextSettings = { ...settingsCache };
    let shouldApply = false;
    for (const key of ["enabled", "mode", "disabledHosts"]) {
      if (changes[key]) {
        nextSettings[key] = changes[key].newValue;
        shouldApply = true;
      }
    }

    if (shouldApply) {
      settingsCache = core.normalizeSettings(nextSettings);
      settingsLoaded = true;
      applyCachedSettings();
    }
  }

  function handleMessage(message, _sender, sendResponse) {
    if (!message || message.type !== "rosewash:settings-updated") {
      return false;
    }

    settingsCache = core.normalizeSettings(message.settings);
    settingsLoaded = true;
    engine.apply(settingsCache);
    sendResponse({ ok: true, stats: engine.stats() });
    return true;
  }

  function handleVisibilityChange() {
    if (!document.hidden) {
      applyCachedSettings();
    }
  }

  function start() {
    if (!hasExtensionContext()) {
      dispose();
      return;
    }

    darkQuery.addEventListener("change", applyCachedSettings);
    document.addEventListener("DOMContentLoaded", applyCachedSettings);
    window.addEventListener("load", applyCachedSettings);
    window.addEventListener("pageshow", applyCachedSettings);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    try {
      chrome.storage.onChanged.addListener(handleStorageChanged);
      chrome.runtime.onMessage.addListener(handleMessage);
      // 1) Attribute so theme.css covers the canvas this frame.
      paintProvisionalRoot();
      // 2) Default full cover immediately (document_start DOM is small).
      applyCachedSettings();
      // 3) Storage refines enabled/mode/blocklist without a blank gap.
      loadSettings();
    } catch {
      dispose();
    }
  }

  start();
})();
