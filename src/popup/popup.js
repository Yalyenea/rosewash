(function () {
  "use strict";

  const core = globalThis.RosewashCore;
  const enabledInput = document.querySelector("#enabled");
  const defaultInput = document.querySelector("#default-enabled");
  const customFontsInput = document.querySelector("#custom-fonts-enabled");
  const lightSelect = document.querySelector("#preset-light");
  const darkSelect = document.querySelector("#preset-dark");
  const siteSelect = document.querySelector("#site-policy");
  const siteShortcut = document.querySelector("#site-shortcut");
  const refreshButton = document.querySelector("#refresh");
  const saveStatus = document.querySelector("#save-status");
  const appearanceButtons = Array.from(document.querySelectorAll("[data-appearance]"));
  const systemAppearance = window.matchMedia("(prefers-color-scheme: dark)");
  const xLayoutInput = document.querySelector("#x-compact-layout");
  const zhihuLayoutInput = document.querySelector("#zhihu-article-layout");
  const xWidthSelect = document.querySelector("#x-single-column-width");
  const zhihuWidthSelect = document.querySelector("#zhihu-article-width");
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

  async function refreshShortcut() {
    try {
      const commands = await chrome.commands.getAll();
      const shortcut = commands.find((command) => command.name === "toggle-current-site")?.shortcut;
      siteShortcut.textContent = shortcut || "Set key";
      siteSelect.title = shortcut
        ? `${shortcut} toggles this site between Always on and Always off.`
        : "Shortcut not set. Assign one in Settings → Change shortcut.";
    } catch (error) {
      siteShortcut.textContent = "Unavailable";
      siteSelect.title = `Could not read shortcut: ${error.message}`;
    }
    siteShortcut.title = `${siteSelect.title} Click to change the shortcut in browser settings.`;
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

  async function syncContentScripts() {
    const tabs = await chrome.tabs.query({});
    await Promise.all(tabs.filter((tab) => tab.id).map((tab) =>
      chrome.tabs.sendMessage(tab.id, { type: "rosewash:settings-updated", settings })
        .catch(() => undefined)
    ));
  }

  function render() {
    const restriction = core.pageRestrictionForUrl(activeTab?.url);
    enabledInput.checked = settings.enabled;
    defaultInput.checked = settings.defaultEnabled;
    document.querySelector("#host").textContent = activeHost || "unsupported page";
    document.querySelector("#default-status").textContent = settings.defaultEnabled
      ? "New sites are on · exceptions still apply"
      : "New sites are off · enable them individually";
    lightSelect.value = settings.presetLight;
    darkSelect.value = settings.presetDark;
    fontPicker.render(settings);
    xLayoutInput.checked = settings.xCompactLayout;
    zhihuLayoutInput.checked = settings.zhihuArticleLayout;
    xWidthSelect.value = String(settings.xSingleColumnWidth);
    zhihuWidthSelect.value = String(settings.zhihuArticleWidth);
    xWidthSelect.disabled = !settings.xCompactLayout;
    zhihuWidthSelect.disabled = !settings.zhihuArticleLayout;
    for (const button of appearanceButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.appearance === settings.appearance));
    }
    const allowed = core.isHostEnabled(activeHost, settings);
    const policy = core.hostPolicyForHost(activeHost, settings);
    const inherited = policy === "default"
      && core.isHostDisabled(activeHost, [...settings.enabledHosts, ...settings.disabledHosts]);
    siteSelect.value = policy;
    siteSelect.disabled = Boolean(restriction) || !activeHost;
    document.querySelector("#site-source").textContent = restriction || !activeHost ? "Unavailable"
      : !settings.enabled ? "Paused" : `${allowed ? "On" : "Off"}${inherited ? " · parent rule" : ""}`;
    const siteStatus = document.querySelector("#site-status");
    siteStatus.hidden = !restriction;
    siteStatus.textContent = restriction === "webstore"
      ? "The browser blocks extensions on the Web Store and its developer dashboard."
      : restriction ? "Rosewash cannot run on this page." : "";
    refreshButton.disabled = Boolean(restriction);
    paintPopupChrome();
  }

  async function updateSettings(next) {
    settings = core.plainSettings(next);
    render();
    window.clearTimeout(statusTimeout);
    saveStatus.textContent = "Saving…";
    try {
      await chrome.storage.sync.set(settings);
      await chrome.storage.sync.remove(["mode", "preset"]);
      await syncContentScripts();
      saveStatus.textContent = "Saved";
      statusTimeout = window.setTimeout(() => { saveStatus.textContent = ""; }, 1600);
    } catch (error) {
      saveStatus.textContent = `Save failed: ${error.message}`;
    }
  }

  for (const [input, key] of [
    [enabledInput, "enabled"], [defaultInput, "defaultEnabled"],
    [customFontsInput, "customFontsEnabled"], [xLayoutInput, "xCompactLayout"],
    [zhihuLayoutInput, "zhihuArticleLayout"]
  ]) input.addEventListener("change", () => updateSettings({ ...settings, [key]: input.checked }));
  for (const [input, key] of [[lightSelect, "presetLight"], [darkSelect, "presetDark"], ...fontFields.map(({ input, key }) => [input, key])]) {
    input.addEventListener("change", () => updateSettings({ ...settings, [key]: input.value }));
  }
  for (const [input, key] of [[xWidthSelect, "xSingleColumnWidth"], [zhihuWidthSelect, "zhihuArticleWidth"]]) {
    input.addEventListener("change", () => updateSettings({ ...settings, [key]: Number(input.value) }));
  }
  for (const button of appearanceButtons) {
    button.addEventListener("click", () => updateSettings({ ...settings, appearance: button.dataset.appearance }));
  }
  siteSelect.addEventListener("change", () => {
    if (activeHost && !core.pageRestrictionForUrl(activeTab?.url)) {
      updateSettings(core.setHostPolicy(activeHost, siteSelect.value, settings));
    }
  });
  document.querySelector("#options").addEventListener("click", () => chrome.runtime.openOptionsPage());
  refreshButton.addEventListener("click", syncContentScripts);
  systemAppearance.addEventListener("change", paintPopupChrome);

  async function init() {
    for (const [select, variant] of [[lightSelect, "light"], [darkSelect, "dark"]]) {
      for (const preset of core.listPresets(variant)) select.add(new Option(preset.label, preset.id));
    }
    for (const [select, widths] of [[xWidthSelect, core.X_SINGLE_COLUMN_WIDTHS], [zhihuWidthSelect, core.ZHIHU_ARTICLE_WIDTHS]]) {
      for (const width of widths) select.add(new Option(`${width} px`, String(width)));
    }
    const [tabs, raw] = await Promise.all([
      chrome.tabs.query({ active: true, currentWindow: true }), chrome.storage.sync.get(null)
    ]);
    activeTab = tabs[0] || null;
    activeHost = core.hostFromUrl(activeTab?.url);
    settings = core.plainSettings(raw);
    render();
    await fontPicker.load();
  }
  refreshShortcut();
  init();
})();
