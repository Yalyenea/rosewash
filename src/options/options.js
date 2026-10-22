(function () {
  "use strict";

  const core = globalThis.RosewashCore;
  if (!core) {
    document.body.innerHTML = "<p>Rosewash core failed to load.</p>";
    return;
  }

  const DEFAULT_SETTINGS = core.plainSettings(core.DEFAULT_SETTINGS);

  const enabledInput = document.querySelector("#enabled");
  const defaultInput = document.querySelector("#default-enabled");
  const customFontsInput = document.querySelector("#custom-fonts-enabled");
  const fontFields = [
    ["english", "fontEnglish", "RosewashEnglish"],
    ["chinese", "fontChinese", "RosewashChinese"],
    ["math", "fontMath", "RosewashMath"],
    ["monospace", "fontMonospace", "RosewashMonospace"]
  ].map(([id, key, family]) => ({
    key, family,
    input: document.querySelector(`#font-${id}`),
    preview: document.querySelector(`#font-preview-${id}`),
    status: document.querySelector(`#font-status-${id}`)
  }));
  const fontListStatus = document.querySelector("#font-list-status");
  const systemAppearance = window.matchMedia("(prefers-color-scheme: dark)");
  const xCompactInput = document.querySelector("#x-compact-layout");
  const xAutoExpandInput = document.querySelector("#x-auto-expand-replies");
  const xSingleWidthInput = document.querySelector("#x-single-column-width");
  const xSingleWidthValue = document.querySelector("#x-single-column-width-value");
  const zhihuLayoutInput = document.querySelector("#zhihu-article-layout");
  const zhihuWidthInput = document.querySelector("#zhihu-article-width");
  const zhihuWidthValue = document.querySelector("#zhihu-article-width-value");
  const lightList = document.querySelector("#preset-light-list");
  const darkList = document.querySelector("#preset-dark-list");
  const hostTextarea = document.querySelector("#disabled-hosts");
  const enabledHostsTextarea = document.querySelector("#enabled-hosts");
  const fontPicker = globalThis.RosewashFonts.createPicker({
    enabledInput: customFontsInput, fields: fontFields, status: fontListStatus
  });
  const status = document.querySelector("#status");
  const shortcutBindings = [
    ["toggle-current-site", document.querySelector("#shortcut-site")],
    ["toggle-enabled", document.querySelector("#shortcut-global")]
  ];
  const dimInput = document.querySelector("#dim-images");
  const brightnessInput = document.querySelector("#image-brightness");
  const brightnessValue = document.querySelector("#image-brightness-value");
  const ignoredList = document.querySelector("#ignored-list");
  let ignoredElements = {};

  async function refreshShortcut() {
    try {
      const commands = await chrome.commands.getAll();
      for (const [name, binding] of shortcutBindings) {
        const shortcut = commands.find((command) => command.name === name)?.shortcut;
        binding.textContent = shortcut || "Not set";
        binding.title = shortcut ? "Current browser shortcut" : "Assign a shortcut in the browser's extension settings.";
      }
    } catch (error) {
      for (const [, binding] of shortcutBindings) {
        binding.textContent = "Unavailable";
        binding.title = `Could not read shortcut: ${error.message}`;
      }
    }
  }

  document.querySelector("#edit-shortcut").addEventListener("click", async () => {
    // Firefox blocks extensions from opening privileged about: pages.
    if (core.browserKind() === "firefox") {
      document.querySelector("#shortcut-help").textContent =
        "Open about:addons, then the gear menu → Manage Extension Shortcuts.";
      return;
    }
    try {
      const scheme = core.browserKind() === "edge" ? "edge" : "chrome";
      await chrome.tabs.create({ url: `${scheme}://extensions/shortcuts` });
    } catch (error) {
      setStatus(`Could not open shortcuts: ${error.message}`);
    }
  });
  window.addEventListener("focus", refreshShortcut);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshShortcut();
  });

  let selectedLight = DEFAULT_SETTINGS.presetLight;
  let selectedDark = DEFAULT_SETTINGS.presetDark;
  let formBaseline = DEFAULT_SETTINGS;
  let loaded = false;
  let saveTimer = 0;
  let statusTimer = 0;
  let saveRevision = 0;

  const panels = Array.from(document.querySelectorAll(".tab-panel"));
  const tabs = Array.from(document.querySelectorAll("[data-panel]"));
  for (const tab of tabs) tab.addEventListener("click", () => {
    for (const panel of panels) panel.hidden = panel.id !== tab.dataset.panel;
    for (const button of tabs) {
      if (button === tab) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
  });

  function normalizeHost(host) {
    return String(host || "").trim().toLowerCase().replace(/^\.+/, "");
  }

  function hostsFromTextarea(textarea) {
    return Array.from(new Set(
      textarea.value
        .split(/\r?\n/)
        .map(normalizeHost)
        .filter(Boolean)
    )).sort();
  }

  function selectedAppearance() {
    return document.querySelector("input[name='appearance']:checked")?.value || DEFAULT_SETTINGS.appearance;
  }

  function paintSettingsChrome() {
    const themeKey = core.resolveSettingsThemeKey({
      appearance: selectedAppearance(),
      presetLight: selectedLight,
      presetDark: selectedDark
    }, systemAppearance.matches);
    const palette = core.PALETTES[themeKey];
    const root = document.documentElement;
    root.dataset.theme = themeKey;
    for (const token of ["base", "surface", "overlay", "text"]) {
      root.style.setProperty(`--${token}`, palette[token]);
    }
    root.style.setProperty("--accent", palette.link);
    root.style.setProperty("--love", core.isDarkThemeKey(themeKey) ? "#eb6f92" : "#b4637a");
    root.style.colorScheme = core.isDarkThemeKey(themeKey) ? "dark" : "light";
  }

  function selectedXSingleColumnWidth() {
    return core.X_SINGLE_COLUMN_WIDTHS[Number(xSingleWidthInput.value)];
  }

  function renderXSingleColumnWidth(width) {
    const index = core.X_SINGLE_COLUMN_WIDTHS.indexOf(width);
    xSingleWidthInput.value = String(index);
    xSingleWidthValue.value = `${width} px`;
  }

  function selectedZhihuArticleWidth() {
    return core.ZHIHU_ARTICLE_WIDTHS[Number(zhihuWidthInput.value)];
  }

  function renderZhihuArticleWidth(width) {
    const index = core.ZHIHU_ARTICLE_WIDTHS.indexOf(width);
    zhihuWidthInput.value = String(index);
    zhihuWidthValue.value = `${width} px`;
  }

  function selectedImageBrightness() {
    return core.IMAGE_BRIGHTNESS_LEVELS[Number(brightnessInput.value)];
  }

  function renderImageBrightness(level) {
    brightnessInput.value = String(core.IMAGE_BRIGHTNESS_LEVELS.indexOf(level));
    brightnessValue.value = `${level}%`;
  }

  function renderImageDimming() {
    brightnessInput.disabled = !dimInput.checked;
    const form = {
      dimImages: dimInput.checked, appearance: selectedAppearance(), presetLight: selectedLight, presetDark: selectedDark
    };
    document.querySelector("#dim-status").textContent = !dimInput.checked
      ? "Lower image and video brightness with dark palettes"
      : core.imageDimmingActive(form, systemAppearance.matches) ? "Active with the current palette"
        : "Takes effect with a dark palette";
  }

  // Rule removals use the same per-site merge as automatic host-list saves.
  function renderIgnoredElements() {
    const sites = Object.entries(ignoredElements);
    if (!sites.length) {
      const empty = document.createElement("p");
      empty.textContent = "No ignored elements.";
      ignoredList.replaceChildren(empty);
      return;
    }
    ignoredList.replaceChildren(...sites.map(([host, selectors]) => {
      const site = document.createElement("div");
      site.className = "ignored-site";
      const heading = document.createElement("h3");
      heading.textContent = host;
      heading.title = host;
      const rules = document.createElement("div");
      for (const selector of selectors) {
        const row = document.createElement("div");
        row.className = "ignored-rule";
        const code = document.createElement("code");
        code.textContent = selector;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => {
          const rest = ignoredElements[host].filter((item) => item !== selector);
          ignoredElements = { ...ignoredElements, [host]: rest };
          if (!rest.length) delete ignoredElements[host];
          renderIgnoredElements();
          saveSettings();
        });
        row.appendChild(code);
        row.appendChild(remove);
        rules.appendChild(row);
      }
      site.appendChild(heading);
      site.appendChild(rules);
      return site;
    }));
  }

  function setStatus(text) {
    window.clearTimeout(statusTimer);
    status.textContent = text;
    statusTimer = window.setTimeout(() => {
      status.textContent = "";
    }, 1600);
  }

  function swatchColors(tokens) {
    return {
      base: tokens.base,
      surface: tokens.surface,
      text: tokens.text,
      link: tokens.link
    };
  }

  function fillPresetList(list, variant, onSelect) {
    list.replaceChildren();

    for (const preset of core.listPresets(variant)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preset-card";
      button.dataset.preset = preset.id;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", "false");

      const colors = swatchColors(preset[variant]);
      // Assign text and styles directly so store review needs no HTML sanitization exception.
      const swatches = document.createElement("span");
      swatches.className = "swatches";
      swatches.setAttribute("aria-hidden", "true");
      for (const color of Object.values(colors)) {
        const swatch = document.createElement("span");
        swatch.style.background = color;
        swatches.appendChild(swatch);
      }
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = preset.label;
      button.appendChild(swatches);
      button.appendChild(name);

      button.addEventListener("click", () => {
        onSelect(preset.id);
      });

      list.appendChild(button);
    }
  }

  function markSelected(list, presetId) {
    for (const button of list.querySelectorAll(".preset-card")) {
      const on = button.dataset.preset === presetId;
      button.setAttribute("aria-selected", String(on));
      button.classList.toggle("is-selected", on);
    }
  }

  function selectLight(presetId) {
    selectedLight = presetId;
    document.querySelector(".palette-group[data-variant='light'] .selected-name").textContent = core.PRESETS[presetId].label;
    markSelected(lightList, presetId);
    paintSettingsChrome();
    renderImageDimming();
  }

  function selectDark(presetId) {
    selectedDark = presetId;
    document.querySelector(".palette-group[data-variant='dark'] .selected-name").textContent = core.PRESETS[presetId].label;
    markSelected(darkList, presetId);
    paintSettingsChrome();
    renderImageDimming();
  }

  function render(settings) {
    const normalized = core.plainSettings(settings);
    formBaseline = normalized;
    enabledInput.checked = normalized.enabled;
    defaultInput.checked = normalized.defaultEnabled;
    fontPicker.render(normalized);
    xCompactInput.checked = normalized.xCompactLayout;
    xAutoExpandInput.checked = normalized.xAutoExpandReplies;
    xSingleWidthInput.disabled = !normalized.xCompactLayout;
    renderXSingleColumnWidth(normalized.xSingleColumnWidth);
    zhihuLayoutInput.checked = normalized.zhihuArticleLayout;
    zhihuWidthInput.disabled = !normalized.zhihuArticleLayout;
    renderZhihuArticleWidth(normalized.zhihuArticleWidth);
    dimInput.checked = normalized.dimImages;
    renderImageBrightness(normalized.imageBrightness);
    renderImageDimming();
    ignoredElements = normalized.ignoredElements;
    renderIgnoredElements();
    document.querySelector(`input[name='appearance'][value='${normalized.appearance}']`).checked = true;
    hostTextarea.value = normalized.disabledHosts.join("\n");
    enabledHostsTextarea.value = normalized.enabledHosts.join("\n");
    selectLight(normalized.presetLight);
    selectDark(normalized.presetDark);
  }

  async function load() {
    const raw = await chrome.storage.sync.get(null);
    render(raw);
    loaded = true;
    await fontPicker.load();
  }

  function formSettings() {
    return core.plainSettings({
      enabled: enabledInput.checked,
      defaultEnabled: defaultInput.checked,
      customFontsEnabled: customFontsInput.checked,
      ...fontPicker.values(),
      presetLight: selectedLight,
      presetDark: selectedDark,
      appearance: selectedAppearance(),
      xCompactLayout: xCompactInput.checked,
      xAutoExpandReplies: xAutoExpandInput.checked,
      xSingleColumnWidth: selectedXSingleColumnWidth(),
      zhihuArticleLayout: zhihuLayoutInput.checked,
      zhihuArticleWidth: selectedZhihuArticleWidth(),
      dimImages: dimInput.checked,
      imageBrightness: selectedImageBrightness(),
      disabledHosts: hostsFromTextarea(hostTextarea),
      enabledHosts: hostsFromTextarea(enabledHostsTextarea),
      ignoredElements
    });
  }

  async function saveSettings() {
    window.clearTimeout(saveTimer);
    saveTimer = 0;
    if (!loaded) return;
    const next = formSettings();
    if (JSON.stringify(next) === JSON.stringify(formBaseline)) return;
    const baseline = formBaseline;
    formBaseline = next;
    const revision = ++saveRevision;
    window.clearTimeout(statusTimer);
    status.textContent = "Saving…";
    try {
      // The background owns the write immediately, even if this page closes.
      // Advance the form baseline before yielding so rapid reversals are saved.
      const response = await chrome.runtime.sendMessage({
        type: "rosewash:edit-settings", baseline, settings: next
      });
      if (!response?.ok) throw new Error(response?.error || "Settings were not saved");
      if (revision === saveRevision) setStatus("Saved");
    } catch (error) {
      if (revision === saveRevision) formBaseline = baseline;
      window.clearTimeout(statusTimer);
      status.textContent = `Save failed: ${error.message}`;
    }
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveSettings, 350);
  }

  // Text and sliders settle briefly; blur, tab switches, and page exit flush
  // pending input so users do not have to wait before leaving the page.
  for (const input of [hostTextarea, enabledHostsTextarea]) {
    input.addEventListener("input", scheduleSave);
    input.addEventListener("change", saveSettings);
  }
  for (const { input } of fontFields) input.addEventListener("input", scheduleSave);
  for (const input of [xSingleWidthInput, zhihuWidthInput, brightnessInput]) {
    input.addEventListener("change", saveSettings);
  }
  for (const input of [enabledInput, defaultInput, customFontsInput, xCompactInput, xAutoExpandInput, zhihuLayoutInput, dimInput, ...fontFields.map(field => field.input)]) {
    input.addEventListener("change", saveSettings);
  }
  function flushSave() {
    if (saveTimer) saveSettings();
  }
  window.addEventListener("pagehide", flushSave);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flushSave();
  });
  for (const tab of tabs) tab.addEventListener("click", flushSave);
  xCompactInput.addEventListener("change", () => { xSingleWidthInput.disabled = !xCompactInput.checked; });
  zhihuLayoutInput.addEventListener("change", () => { zhihuWidthInput.disabled = !zhihuLayoutInput.checked; });

  xSingleWidthInput.addEventListener("input", () => {
    renderXSingleColumnWidth(selectedXSingleColumnWidth());
    scheduleSave();
  });

  zhihuWidthInput.addEventListener("input", () => {
    renderZhihuArticleWidth(selectedZhihuArticleWidth());
    scheduleSave();
  });

  brightnessInput.addEventListener("input", () => {
    renderImageBrightness(selectedImageBrightness());
    scheduleSave();
  });
  dimInput.addEventListener("change", renderImageDimming);

  for (const input of document.querySelectorAll("input[name='appearance']")) {
    input.addEventListener("change", () => { paintSettingsChrome(); renderImageDimming(); return saveSettings(); });
  }
  systemAppearance.addEventListener("change", () => { paintSettingsChrome(); renderImageDimming(); });

  fillPresetList(lightList, "light", (id) => { selectLight(id); return saveSettings(); });
  fillPresetList(darkList, "dark", (id) => { selectDark(id); return saveSettings(); });
  paintSettingsChrome();
  refreshShortcut();
  load();
})();
