(function () {
  "use strict";

  const core = globalThis.RosewashCore;
  const enabledInput = document.querySelector("#enabled");
  const lightSelect = document.querySelector("#preset-light");
  const darkSelect = document.querySelector("#preset-dark");
  const siteButton = document.querySelector("#site-toggle");
  const refreshButton = document.querySelector("#refresh");
  const saveStatus = document.querySelector("#save-status");
  const appearanceButtons = Array.from(document.querySelectorAll("[data-appearance]"));
  const systemAppearance = window.matchMedia("(prefers-color-scheme: dark)");
  const xLayoutInput = document.querySelector("#x-compact-layout");
  const zhihuLayoutInput = document.querySelector("#zhihu-article-layout");
  const pickButton = document.querySelector("#pick-element");
  let settings = core.plainSettings(core.DEFAULT_SETTINGS);
  let activeTab = null;
  let activeHost = "";
  let statusTimeout;
  let settingsRead = 0;
  let pendingSaves = 0;

  function paintPopupChrome() {
    const themeKey = core.resolveSettingsThemeKey(settings, systemAppearance.matches);
    const palette = core.PALETTES[themeKey];
    const root = document.documentElement;
    root.dataset.theme = themeKey;
    for (const token of ["base", "surface", "overlay", "text", "muted"]) {
      root.style.setProperty(`--${token}`, palette[token]);
    }
    root.style.setProperty("--accent", palette.link);
    root.style.setProperty("--love", core.isDarkThemeKey(themeKey) ? "#eb6f92" : "#b4637a");
    root.style.colorScheme = core.isDarkThemeKey(themeKey) ? "dark" : "light";
  }

  function render() {
    const restriction = core.pageRestrictionForUrl(activeTab?.url);
    enabledInput.checked = settings.enabled;
    enabledInput.title = settings.enabled ? "Pause Rosewash on all sites" : "Resume Rosewash on all sites";
    document.querySelector("#host").textContent = activeHost || "unsupported page";
    document.querySelector("#host").title = activeHost;
    lightSelect.value = settings.presetLight;
    darkSelect.value = settings.presetDark;
    xLayoutInput.checked = settings.xCompactLayout;
    zhihuLayoutInput.checked = settings.zhihuArticleLayout;
    document.querySelector("#x-layout-row").hidden = activeHost !== "x.com";
    document.querySelector("#zhihu-layout-row").hidden = !["zhihu.com", "www.zhihu.com", "zhuanlan.zhihu.com"].includes(activeHost);
    for (const button of appearanceButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.appearance === settings.appearance));
    }
    const allowed = core.isHostEnabled(activeHost, settings);
    siteButton.disabled = Boolean(restriction) || !activeHost;
    siteButton.textContent = siteButton.disabled ? "Unavailable" : !settings.enabled ? "Paused" : allowed ? "Allowed" : "Blocked";
    siteButton.setAttribute("aria-pressed", String(allowed));
    siteButton.title = settings.enabled ? "Toggle Rosewash on this site" : "Site preference; Rosewash is paused globally";
    const siteStatus = document.querySelector("#site-status");
    siteStatus.hidden = !restriction;
    siteStatus.textContent = restriction === "webstore"
      ? "The browser blocks extensions on the Web Store and its developer dashboard."
      : restriction ? "Rosewash cannot run on this page." : "";
    refreshButton.disabled = Boolean(restriction);
    pickButton.disabled = siteButton.disabled || !settings.enabled || !allowed;
    paintPopupChrome();
  }

  async function refreshSettings() {
    if (pendingSaves) return;
    const read = ++settingsRead;
    try {
      const raw = await chrome.storage.sync.get(null);
      if (read !== settingsRead || pendingSaves) return;
      settings = core.plainSettings(raw);
      render();
    } catch (error) {
      saveStatus.textContent = `Could not read settings: ${error.message}`;
    }
  }

  async function updateSettings(next, request) {
    next = core.plainSettings(next);
    const baseline = settings;
    settings = next;
    pendingSaves++;
    settingsRead++;
    render();
    window.clearTimeout(statusTimeout);
    saveStatus.textContent = "Saving…";
    try {
      // Dispatch before yielding: subsequent writes survive this popup being closed.
      const response = await chrome.runtime.sendMessage(request || {
        type: "rosewash:edit-settings", baseline, settings: next
      });
      if (!response?.ok) throw new Error(response?.error || "Settings were not saved");
      if (pendingSaves === 1) {
        saveStatus.textContent = "Saved";
        statusTimeout = window.setTimeout(() => { saveStatus.textContent = ""; }, 1600);
      }
    } catch (error) {
      saveStatus.textContent = `Save failed: ${error.message}`;
    } finally {
      pendingSaves--;
      if (!pendingSaves) await refreshSettings();
    }
  }

  for (const [input, key] of [
    [enabledInput, "enabled"], [xLayoutInput, "xCompactLayout"],
    [zhihuLayoutInput, "zhihuArticleLayout"]
  ]) input.addEventListener("change", () => updateSettings({ ...settings, [key]: input.checked }));
  for (const [input, key] of [[lightSelect, "presetLight"], [darkSelect, "presetDark"]]) {
    input.addEventListener("change", () => updateSettings({ ...settings, [key]: input.value }));
  }
  for (const button of appearanceButtons) {
    button.addEventListener("click", () => updateSettings({ ...settings, appearance: button.dataset.appearance }));
  }
  siteButton.addEventListener("click", () => {
    if (activeHost && !core.pageRestrictionForUrl(activeTab?.url)) {
      const policy = core.isHostEnabled(activeHost, settings) ? "off" : "on";
      updateSettings(core.setHostPolicy(activeHost, policy, settings), {
        type: "rosewash:set-host-policy", host: activeHost, policy
      });
    }
  });
  pickButton.addEventListener("click", async () => {
    try {
      // The picker takes over the page, so the popup gets out of the way.
      await chrome.tabs.sendMessage(activeTab.id, { type: "rosewash:start-picker" }, { frameId: 0 });
      window.close();
    } catch (error) {
      saveStatus.textContent = `Could not start picker: ${error.message}. Reload the page and try again.`;
    }
  });
  document.querySelector("#options").addEventListener("click", () => chrome.runtime.openOptionsPage());
  refreshButton.addEventListener("click", async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: "rosewash:reapply" });
      if (!response?.ok) throw new Error(response?.error || "Settings were not reapplied");
    } catch (error) {
      saveStatus.textContent = `Reapply failed: ${error.message}`;
    }
  });
  systemAppearance.addEventListener("change", render);
  chrome.storage.onChanged.addListener((_changes, areaName) => {
    if (areaName === "sync") refreshSettings();
  });

  async function init() {
    for (const [select, variant] of [[lightSelect, "light"], [darkSelect, "dark"]]) {
      for (const preset of core.listPresets(variant)) select.add(new Option(preset.label, preset.id));
    }
    const read = ++settingsRead;
    const [tabs, raw] = await Promise.all([
      chrome.tabs.query({ active: true, currentWindow: true }), chrome.storage.sync.get(null)
    ]);
    activeTab = tabs[0] || null;
    activeHost = core.hostFromUrl(activeTab?.url);
    if (read === settingsRead && !pendingSaves) settings = core.plainSettings(raw);
    render();
  }
  init();
})();
