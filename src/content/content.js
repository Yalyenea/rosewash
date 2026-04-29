(function () {
  "use strict";

  const core = globalThis.RosewashCore;
  const engine = core.createEngine({ document, window });
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function readSettings(callback) {
    chrome.storage.sync.get(core.DEFAULT_SETTINGS, callback);
  }

  function applyStoredSettings() {
    readSettings((settings) => {
      engine.apply(settings);
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

  darkQuery.addEventListener("change", applyStoredSettings);
  applyStoredSettings();
})();

