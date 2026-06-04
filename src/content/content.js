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
    if (disposed || !settingsLoaded) {
      return;
    }

    engine.apply(settingsCache);
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
      loadSettings();
    } catch {
      dispose();
    }
  }

  start();
})();
