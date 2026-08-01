(function () {
  "use strict";

  const core = globalThis.RosewashCore;
  if (!core) {
    document.body.innerHTML = "<p style=\"padding:12px\">Rosewash core failed to load.</p>";
    return;
  }

  const DEFAULT_SETTINGS = core.plainSettings(core.DEFAULT_SETTINGS);

  const enabledInput = document.querySelector("#enabled");
  const hostLabel = document.querySelector("#host");
  const appearanceButtons = Array.from(document.querySelectorAll("[data-appearance]"));
  const presetSelect = document.querySelector("#preset");
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

  function fillPresetOptions() {
    const presets = Object.values(core.PRESETS).slice().sort((a, b) => {
      if (a.id === "rose-pine") {
        return -1;
      }
      if (b.id === "rose-pine") {
        return 1;
      }
      return a.label.localeCompare(b.label);
    });

    for (const preset of presets) {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.label;
      presetSelect.appendChild(option);
    }
  }

  function resolvedPalette() {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const themeKey = core.resolveThemeKey(settings.preset, settings.appearance, prefersDark);
    return { themeKey, palette: core.PALETTES[themeKey] };
  }

  function paintPopupChrome() {
    const { themeKey, palette } = resolvedPalette();
    if (!palette) {
      return;
    }

    const root = document.documentElement;
    root.dataset.theme = themeKey;
    root.style.setProperty("--base", palette.base);
    root.style.setProperty("--surface", palette.surface);
    root.style.setProperty("--overlay", palette.overlay);
    root.style.setProperty("--text", palette.text);
    root.style.setProperty("--muted", palette.muted);
    root.style.setProperty("--accent", palette.link);
    root.style.colorScheme = core.isDarkThemeKey(themeKey) ? "dark" : "light";
  }

  async function storageGet() {
    const raw = await chrome.storage.sync.get(null);
    return core.plainSettings({ ...DEFAULT_SETTINGS, ...raw });
  }

  async function storageSet(nextSettings) {
    const normalized = core.plainSettings(nextSettings);
    settings = normalized;
    await chrome.storage.sync.set(normalized);
    // Drop legacy key so it cannot fight the new schema on next read.
    await chrome.storage.sync.remove("mode");
    return normalized;
  }

  function activeTabQuery() {
    return chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs[0] || null);
  }

  async function syncContentScripts() {
    const tabs = await chrome.tabs.query({});
    let reached = 0;
    await Promise.all(
      tabs.map((tab) => {
        if (!tab.id) {
          return Promise.resolve();
        }
        return chrome.tabs
          .sendMessage(tab.id, { type: "rosewash:settings-updated", settings })
          .then(() => {
            reached += 1;
          })
          .catch(() => undefined);
      })
    );
    return reached;
  }

  function render() {
    enabledInput.checked = settings.enabled;
    hostLabel.textContent = activeHost || "unsupported page";
    presetSelect.value = settings.preset;

    for (const button of appearanceButtons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.appearance === settings.appearance)
      );
    }

    const disabled = activeHost && isHostDisabled(activeHost, settings.disabledHosts);
    siteButton.textContent = disabled ? "Blocked" : "Allowed";
    siteButton.disabled = !activeHost;
    paintPopupChrome();
  }

  async function updateSettings(nextSettings) {
    const normalizedHosts = Array.from(
      new Set((nextSettings.disabledHosts || []).map(normalizeHost).filter(Boolean))
    ).sort();
    await storageSet({ ...nextSettings, disabledHosts: normalizedHosts });
    render();
    await syncContentScripts();
  }

  enabledInput.addEventListener("change", () => {
    updateSettings({ ...settings, enabled: enabledInput.checked });
  });

  for (const button of appearanceButtons) {
    button.addEventListener("click", () => {
      updateSettings({ ...settings, appearance: button.dataset.appearance });
    });
  }

  presetSelect.addEventListener("change", () => {
    updateSettings({ ...settings, preset: presetSelect.value });
  });

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
    syncContentScripts();
  });

  async function init() {
    fillPresetOptions();
    activeTab = await activeTabQuery();
    activeHost = activeTab ? hostFromUrl(activeTab.url) : "";
    settings = await storageGet();
    render();
  }

  init();
})();
