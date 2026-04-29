(function () {
  "use strict";

  const core = globalThis.RosewashCore;
  const engine = core.createEngine({ document, window });
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  let settingsCache = core.DEFAULT_SETTINGS;
  let disposed = false;
  let applyFrame = 0;

  function hasExtensionContext() {
    try {
      return Boolean(globalThis.chrome && chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  function dispose() {
    disposed = true;
    if (applyFrame) {
      window.cancelAnimationFrame(applyFrame);
      applyFrame = 0;
    }
    darkQuery.removeEventListener("change", scheduleApply);
    window.removeEventListener("pageshow", scheduleApply);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    engine.disconnect();
  }

  function applyCachedSettings() {
    if (disposed) {
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
      settingsCache = await chrome.storage.sync.get(core.DEFAULT_SETTINGS);
      applyCachedSettings();
    } catch {
      dispose();
    }
  }

  function scheduleApply() {
    if (disposed) {
      return;
    }

    if (applyFrame) {
      window.cancelAnimationFrame(applyFrame);
    }

    applyFrame = window.requestAnimationFrame(() => {
      applyFrame = 0;
      applyCachedSettings();
    });
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
      applyCachedSettings();
    }
  }

  function handleMessage(message, _sender, sendResponse) {
    if (!message || message.type !== "rosewash:settings-updated") {
      return false;
    }

    settingsCache = core.normalizeSettings(message.settings);
    engine.apply(settingsCache);
    sendResponse({ ok: true, stats: engine.stats() });
    return true;
  }

  function handleVisibilityChange() {
    if (!document.hidden) {
      scheduleApply();
    }
  }

  function start() {
    if (!hasExtensionContext()) {
      dispose();
      return;
    }

    darkQuery.addEventListener("change", scheduleApply);
    window.addEventListener("pageshow", scheduleApply);
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
