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
  const saveButton = document.querySelector("#save");
  const resetButton = document.querySelector("#reset");
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
    try {
      await chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
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

  // Removing a rule only edits the form; Save merges it per site like host lists.
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
    status.textContent = text;
    window.setTimeout(() => {
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
      button.innerHTML = `
        <span class="swatches" aria-hidden="true">
          <span style="background:${colors.base}"></span>
          <span style="background:${colors.surface}"></span>
          <span style="background:${colors.text}"></span>
          <span style="background:${colors.link}"></span>
        </span>
        <span class="name">${preset.label}</span>
      `;

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
    markSelected(lightList, presetId);
    paintSettingsChrome();
    renderImageDimming();
  }

  function selectDark(presetId) {
    selectedDark = presetId;
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
    renderXSingleColumnWidth(normalized.xSingleColumnWidth);
    zhihuLayoutInput.checked = normalized.zhihuArticleLayout;
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

  saveButton.addEventListener("click", async () => {
    const next = formSettings();
    const baseline = formBaseline;
    saveButton.disabled = true;
    resetButton.disabled = true;
    try {
      const response = await chrome.runtime.sendMessage({
        type: "rosewash:edit-settings", baseline, settings: next
      });
      if (!response?.ok) throw new Error(response?.error || "Settings were not saved");
      if (JSON.stringify(formSettings()) === JSON.stringify(next)) render(response.settings);
      else formBaseline = next;
      setStatus("Saved");
    } catch (error) {
      setStatus(`Save failed: ${error.message}`);
    } finally {
      saveButton.disabled = false;
      resetButton.disabled = false;
    }
  });

  resetButton.addEventListener("click", async () => {
    saveButton.disabled = true;
    resetButton.disabled = true;
    try {
      const response = await chrome.runtime.sendMessage({ type: "rosewash:reset-settings" });
      if (!response?.ok) throw new Error(response?.error || "Settings were not reset");
      render(response.settings);
      setStatus("Reset");
    } catch (error) {
      setStatus(`Reset failed: ${error.message}`);
    } finally {
      saveButton.disabled = false;
      resetButton.disabled = false;
    }
  });

  xSingleWidthInput.addEventListener("input", () => {
    renderXSingleColumnWidth(selectedXSingleColumnWidth());
  });

  zhihuWidthInput.addEventListener("input", () => {
    renderZhihuArticleWidth(selectedZhihuArticleWidth());
  });

  brightnessInput.addEventListener("input", () => {
    renderImageBrightness(selectedImageBrightness());
  });
  dimInput.addEventListener("change", renderImageDimming);

  for (const input of document.querySelectorAll("input[name='appearance']")) {
    input.addEventListener("change", () => { paintSettingsChrome(); renderImageDimming(); });
  }
  systemAppearance.addEventListener("change", () => { paintSettingsChrome(); renderImageDimming(); });

  fillPresetList(lightList, "light", selectLight);
  fillPresetList(darkList, "dark", selectDark);
  paintSettingsChrome();
  refreshShortcut();
  load();
})();
