(function () {
  "use strict";

  const DEFAULT_SETTINGS = {
    enabled: true,
    mode: "auto",
    disabledHosts: []
  };

  const enabledInput = document.querySelector("#enabled");
  const hostLabel = document.querySelector("#host");
  const modeButtons = Array.from(document.querySelectorAll("[data-mode]"));
  const siteButton = document.querySelector("#site-toggle");
  const optionsButton = document.querySelector("#options");
  const refreshButton = document.querySelector("#refresh");

  let activeTab = null;
  let activeHost = "";
  let settings = DEFAULT_SETTINGS;

  function normalizeHost(host) {
    return String(host || "").trim().toLowerCase().replace(/^\.+/, "");
  }

  function hostFromUrl(value) {
    try {
      return normalizeHost(new URL(value).hostname);
    } catch {
      return "";
    }
  }

  function isHostDisabled(host, disabledHosts) {
    const normalizedHost = normalizeHost(host);
    return disabledHosts.some((entry) => {
      const disabledHost = normalizeHost(entry);
      return disabledHost
        && (normalizedHost === disabledHost || normalizedHost.endsWith(`.${disabledHost}`));
    });
  }

  function storageGet() {
    return chrome.storage.sync.get(DEFAULT_SETTINGS);
  }

  function storageSet(nextSettings) {
    settings = nextSettings;
    return chrome.storage.sync.set(nextSettings);
  }

  function activeTabQuery() {
    return chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs[0] || null);
  }

  function syncContentScript() {
    if (!activeTab || !activeTab.id) {
      return Promise.resolve();
    }

    return chrome.tabs
      .sendMessage(activeTab.id, { type: "rosewash:settings-updated", settings })
      .catch(() => undefined);
  }

  function render() {
    enabledInput.checked = settings.enabled;
    hostLabel.textContent = activeHost || "unsupported page";

    for (const button of modeButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.mode === settings.mode));
    }

    const disabled = activeHost && isHostDisabled(activeHost, settings.disabledHosts);
    siteButton.textContent = disabled ? "Blocked" : "Allowed";
    siteButton.disabled = !activeHost;
  }

  async function updateSettings(nextSettings) {
    const normalizedHosts = Array.from(new Set(nextSettings.disabledHosts.map(normalizeHost).filter(Boolean))).sort();
    await storageSet({ ...nextSettings, disabledHosts: normalizedHosts });
    render();
    await syncContentScript();
  }

  enabledInput.addEventListener("change", () => {
    updateSettings({ ...settings, enabled: enabledInput.checked });
  });

  for (const button of modeButtons) {
    button.addEventListener("click", () => {
      updateSettings({ ...settings, mode: button.dataset.mode });
    });
  }

  siteButton.addEventListener("click", () => {
    if (!activeHost) {
      return;
    }

    const disabledHosts = settings.disabledHosts.filter((host) => !isHostDisabled(activeHost, [host]));
    if (disabledHosts.length === settings.disabledHosts.length) {
      disabledHosts.push(activeHost);
    }

    updateSettings({ ...settings, disabledHosts });
  });

  optionsButton.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  refreshButton.addEventListener("click", () => {
    syncContentScript();
  });

  async function init() {
    activeTab = await activeTabQuery();
    activeHost = activeTab ? hostFromUrl(activeTab.url) : "";
    settings = await storageGet();
    render();
  }

  init();
})();

