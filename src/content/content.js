(function () {
  "use strict";

  const core = globalThis.RosewashCore;
  const engine = core.createEngine({ document, window });
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  let applyFrame = 0;

  function readSettings(callback) {
    chrome.storage.sync.get(core.DEFAULT_SETTINGS, callback);
  }

  function applyStoredSettings() {
    readSettings((settings) => {
      engine.apply(settings);
    });
  }

  function scheduleApplyStoredSettings() {
    if (applyFrame) {
      window.cancelAnimationFrame(applyFrame);
    }

    applyFrame = window.requestAnimationFrame(() => {
      applyFrame = 0;
      applyStoredSettings();
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") {
      return;
    }

    if (changes.enabled || changes.mode || changes.disabledHosts) {
      applyStoredSettings();
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "rosewash:settings-updated") {
      return false;
    }

    engine.apply(message.settings);
    sendResponse({ ok: true, stats: engine.stats() });
    return true;
  });

  darkQuery.addEventListener("change", scheduleApplyStoredSettings);
  window.addEventListener("pageshow", scheduleApplyStoredSettings);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      scheduleApplyStoredSettings();
    }
  });

  applyStoredSettings();
})();
