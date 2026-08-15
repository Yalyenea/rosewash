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
  const lightSelect = document.querySelector("#preset-light");
  const darkSelect = document.querySelector("#preset-dark");
  const siteButton = document.querySelector("#site-toggle");
  const xLayoutRow = document.querySelector("#x-layout-row");
  const xLayoutInput = document.querySelector("#x-compact-layout");
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

  function fillPresetOptions(select, variant) {
    for (const preset of core.listPresets(variant)) {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.label;
      select.appendChild(option);
    }
  }

  function resolvedPalette() {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const themeKey = core.resolveSettingsThemeKey(settings, prefersDark);
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
    return core.plainSettings(raw);
  }

  async function storageSet(nextSettings) {
    const normalized = core.plainSettings(nextSettings);
    settings = normalized;
    await chrome.storage.sync.set(normalized);
    // Drop legacy keys so they cannot fight the new schema on next read.
    await chrome.storage.sync.remove(["mode", "preset"]);
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
    lightSelect.value = settings.presetLight;
    darkSelect.value = settings.presetDark;
    xLayoutRow.hidden = activeHost !== "x.com";
    xLayoutInput.checked = settings.xCompactLayout;

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

  lightSelect.addEventListener("change", () => {
    updateSettings({ ...settings, presetLight: lightSelect.value });
  });

  darkSelect.addEventListener("change", () => {
    updateSettings({ ...settings, presetDark: darkSelect.value });
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

  xLayoutInput.addEventListener("change", () => {
    updateSettings({ ...settings, xCompactLayout: xLayoutInput.checked });
  });

  optionsButton.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  refreshButton.addEventListener("click", () => {
    syncContentScripts();
  });

  async function init() {
    fillPresetOptions(lightSelect, "light");
    fillPresetOptions(darkSelect, "dark");
    activeTab = await activeTabQuery();
    activeHost = activeTab ? hostFromUrl(activeTab.url) : "";
    settings = await storageGet();
    render();
  }

  init();
})();
