(function () {
  "use strict";

  const core = globalThis.RosewashCore;
  const enabledInput = document.querySelector("#enabled");
  const defaultInput = document.querySelector("#default-enabled");
  const customFontsInput = document.querySelector("#custom-fonts-enabled");
  const lightSelect = document.querySelector("#preset-light");
  const darkSelect = document.querySelector("#preset-dark");
  const siteInput = document.querySelector("#site-enabled");
  const siteReset = document.querySelector("#site-reset");
  const siteShortcut = document.querySelector("#site-shortcut");
  const refreshButton = document.querySelector("#refresh");
  const saveStatus = document.querySelector("#save-status");
  const appearanceButtons = Array.from(document.querySelectorAll("[data-appearance]"));
  const systemAppearance = window.matchMedia("(prefers-color-scheme: dark)");
  const xLayoutInput = document.querySelector("#x-compact-layout");
  const zhihuLayoutInput = document.querySelector("#zhihu-article-layout");
  const xWidthSelect = document.querySelector("#x-single-column-width");
  const zhihuWidthSelect = document.querySelector("#zhihu-article-width");
  const dimInput = document.querySelector("#dim-images");
  const brightnessSelect = document.querySelector("#image-brightness");
  const pickButton = document.querySelector("#pick-element");
  const clearIgnoredButton = document.querySelector("#clear-ignored");
  const fontFields = ["English", "Chinese", "Math", "Monospace"].map((name) => ({
    key: `font${name}`,
    input: document.querySelector(`#font-${name.toLowerCase()}`)
  }));
  const fontPicker = globalThis.RosewashFonts.createPicker({
    enabledInput: customFontsInput,
    fields: fontFields,
    status: document.querySelector("#font-list-status")
  });
  let settings = core.plainSettings(core.DEFAULT_SETTINGS);
  let activeTab = null;
  let activeHost = "";
  let statusTimeout;
  let settingsRead = 0;
  let pendingSaves = 0;

  async function refreshShortcut() {
    try {
      const commands = await chrome.commands.getAll();
      const shortcut = commands.find((command) => command.name === "toggle-current-site")?.shortcut;
      siteShortcut.textContent = shortcut || "Set key";
      siteShortcut.title = shortcut
        ? `${shortcut} toggles this site between Always on and Always off.`
        : "Shortcut not set.";
    } catch (error) {
      siteShortcut.textContent = "Unavailable";
      siteShortcut.title = `Could not read shortcut: ${error.message}`;
    }
    siteShortcut.title += " Click to change the shortcut in browser settings.";
  }
  window.addEventListener("focus", refreshShortcut);
  siteShortcut.addEventListener("click", async () => {
    try {
      await chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
    } catch (error) {
      saveStatus.textContent = `Could not open shortcuts: ${error.message}`;
    }
  });

  function paintPopupChrome() {
    const themeKey = core.resolveSettingsThemeKey(settings, systemAppearance.matches);
    const palette = core.PALETTES[themeKey];
    const root = document.documentElement;
    root.dataset.theme = themeKey;
    for (const token of ["base", "surface", "overlay", "text"]) {
      root.style.setProperty(`--${token}`, palette[token]);
    }
    root.style.setProperty("--accent", palette.link);
    root.style.colorScheme = core.isDarkThemeKey(themeKey) ? "dark" : "light";
  }

  function render() {
    const restriction = core.pageRestrictionForUrl(activeTab?.url);
    enabledInput.checked = settings.enabled;
    document.querySelector("#global-status").textContent = settings.enabled ? "Page appearance" : "Paused on all sites";
    defaultInput.checked = settings.defaultEnabled;
    document.querySelector("#host").textContent = activeHost || "unsupported page";
    document.querySelector("#host").title = activeHost;
    document.querySelector("#default-status").textContent = settings.defaultEnabled
      ? "New sites are on · exceptions still apply"
      : "New sites are off · enable them individually";
    lightSelect.value = settings.presetLight;
    darkSelect.value = settings.presetDark;
    for (const [variant, preset] of [["light", settings.presetLight], ["dark", settings.presetDark]]) {
      const palette = core.PALETTES[`${preset}-${variant}`];
      document.querySelector(`#swatch-${variant}`).style.background =
        `linear-gradient(90deg, ${palette.base} 50%, ${palette.link} 50%)`;
    }
    fontPicker.render(settings);
    xLayoutInput.checked = settings.xCompactLayout;
    zhihuLayoutInput.checked = settings.zhihuArticleLayout;
    xWidthSelect.value = String(settings.xSingleColumnWidth);
    zhihuWidthSelect.value = String(settings.zhihuArticleWidth);
    xWidthSelect.disabled = !settings.xCompactLayout;
    zhihuWidthSelect.disabled = !settings.zhihuArticleLayout;
    dimInput.checked = settings.dimImages;
    brightnessSelect.value = String(settings.imageBrightness);
    brightnessSelect.disabled = !settings.dimImages;
    document.querySelector("#dim-status").textContent = !settings.dimImages ? "Dark palettes"
      : core.imageDimmingActive(settings, systemAppearance.matches) ? "Active" : "Waits for a dark palette";
    for (const button of appearanceButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.appearance === settings.appearance));
    }
    const allowed = core.isHostEnabled(activeHost, settings);
    const policy = core.hostPolicyForHost(activeHost, settings);
    const inherited = policy === "default"
      && core.isHostDisabled(activeHost, [...settings.enabledHosts, ...settings.disabledHosts]);
    siteInput.checked = allowed;
    siteInput.disabled = Boolean(restriction) || !activeHost;
    siteInput.title = settings.enabled ? "Toggle Rosewash on this site" : "Site preference; Rosewash is paused globally";
    siteReset.hidden = siteInput.disabled || policy === "default";
    document.querySelector("#site-source").textContent = restriction || !activeHost ? "Unavailable"
      : !settings.enabled ? "Paused" : `${allowed ? "On" : "Off"}${policy === "default" ? inherited ? " · parent rule" : " · default" : ""}`;
    document.querySelector("#site-source").dataset.active = String(!restriction && Boolean(activeHost) && settings.enabled && allowed);
    const siteStatus = document.querySelector("#site-status");
    siteStatus.hidden = !restriction;
    siteStatus.textContent = restriction === "webstore"
      ? "The browser blocks extensions on the Web Store and its developer dashboard."
      : restriction ? "Rosewash cannot run on this page." : "";
    refreshButton.disabled = Boolean(restriction);
    const ignored = core.ignoredSelectorsForHost(activeHost, settings).length;
    pickButton.disabled = siteInput.disabled || !settings.enabled || !allowed;
    document.querySelector("#ignored-count").textContent = ignored
      ? `${ignored} ignored element${ignored === 1 ? "" : "s"}` : "";
    clearIgnoredButton.hidden = !ignored;
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
    [enabledInput, "enabled"], [defaultInput, "defaultEnabled"],
    [customFontsInput, "customFontsEnabled"], [xLayoutInput, "xCompactLayout"],
    [zhihuLayoutInput, "zhihuArticleLayout"], [dimInput, "dimImages"]
  ]) input.addEventListener("change", () => updateSettings({ ...settings, [key]: input.checked }));
  for (const [input, key] of [[lightSelect, "presetLight"], [darkSelect, "presetDark"], ...fontFields.map(({ input, key }) => [input, key])]) {
    input.addEventListener("change", () => updateSettings({ ...settings, [key]: input.value }));
  }
  for (const [input, key] of [
    [xWidthSelect, "xSingleColumnWidth"], [zhihuWidthSelect, "zhihuArticleWidth"], [brightnessSelect, "imageBrightness"]
  ]) {
    input.addEventListener("change", () => updateSettings({ ...settings, [key]: Number(input.value) }));
  }
  for (const button of appearanceButtons) {
    button.addEventListener("click", () => updateSettings({ ...settings, appearance: button.dataset.appearance }));
  }
  siteInput.addEventListener("change", () => {
    if (activeHost && !core.pageRestrictionForUrl(activeTab?.url)) {
      const policy = siteInput.checked ? "on" : "off";
      updateSettings(core.setHostPolicy(activeHost, policy, settings), {
        type: "rosewash:set-host-policy", host: activeHost, policy
      });
    }
  });
  siteReset.addEventListener("click", () => {
    if (activeHost && !core.pageRestrictionForUrl(activeTab?.url)) {
      updateSettings(core.setHostPolicy(activeHost, "default", settings), {
        type: "rosewash:set-host-policy", host: activeHost, policy: "default"
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
  clearIgnoredButton.addEventListener("click", () => updateSettings(core.clearIgnoredSelectors(activeHost, settings)));
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
    for (const [select, widths] of [[xWidthSelect, core.X_SINGLE_COLUMN_WIDTHS], [zhihuWidthSelect, core.ZHIHU_ARTICLE_WIDTHS]]) {
      for (const width of widths) select.add(new Option(`${width} px`, String(width)));
    }
    for (const level of core.IMAGE_BRIGHTNESS_LEVELS) brightnessSelect.add(new Option(`${level}%`, String(level)));
    const read = ++settingsRead;
    const [tabs, raw] = await Promise.all([
      chrome.tabs.query({ active: true, currentWindow: true }), chrome.storage.sync.get(null)
    ]);
    activeTab = tabs[0] || null;
    activeHost = core.hostFromUrl(activeTab?.url);
    if (read === settingsRead && !pendingSaves) settings = core.plainSettings(raw);
    render();
    await fontPicker.load();
  }
  refreshShortcut();
  init();
})();
