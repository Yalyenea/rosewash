(function () {
  "use strict";

  const core = globalThis.RosewashCore;
  if (!core) {
    document.body.innerHTML = "<p>Rosewash core failed to load.</p>";
    return;
  }

  const DEFAULT_SETTINGS = core.plainSettings(core.DEFAULT_SETTINGS);

  const enabledInput = document.querySelector("#enabled");
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
  const loadFontsButton = document.querySelector("#load-system-fonts");
  const fontListStatus = document.querySelector("#font-list-status");
  const systemAppearance = window.matchMedia("(prefers-color-scheme: dark)");
  let systemFonts = null;
  const xCompactInput = document.querySelector("#x-compact-layout");
  const xSingleWidthInput = document.querySelector("#x-single-column-width");
  const xSingleWidthValue = document.querySelector("#x-single-column-width-value");
  const zhihuLayoutInput = document.querySelector("#zhihu-article-layout");
  const zhihuWidthInput = document.querySelector("#zhihu-article-width");
  const zhihuWidthValue = document.querySelector("#zhihu-article-width-value");
  const lightList = document.querySelector("#preset-light-list");
  const darkList = document.querySelector("#preset-dark-list");
  const hostTextarea = document.querySelector("#disabled-hosts");
  const saveButton = document.querySelector("#save");
  const resetButton = document.querySelector("#reset");
  const status = document.querySelector("#status");

  let selectedLight = DEFAULT_SETTINGS.presetLight;
  let selectedDark = DEFAULT_SETTINGS.presetDark;

  function normalizeHost(host) {
    return String(host || "").trim().toLowerCase().replace(/^\.+/, "");
  }

  function hostsFromTextarea() {
    return Array.from(new Set(
      hostTextarea.value
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
  }

  function selectDark(presetId) {
    selectedDark = presetId;
    markSelected(darkList, presetId);
    paintSettingsChrome();
  }

  let previewFaces = [];

  function selectedFonts() {
    return Object.fromEntries(fontFields.map(({ key, input }) => [key, input.value]));
  }

  function fillFontList(input, value) {
    input.replaceChildren(new Option("Page default", ""));
    for (const font of systemFonts || []) {
      input.add(new Option(font.fullName, font.postscriptName));
    }
    if (value && !Array.from(input.options).some((option) => option.value === value)) {
      input.add(new Option(`${value}${systemFonts ? " — unavailable on this device" : " — saved"}`, value));
    }
    input.value = value;
  }

  async function loadSystemFonts() {
    loadFontsButton.disabled = true;
    fontListStatus.textContent = "Loading…";
    try {
      const fonts = await window.queryLocalFonts();
      systemFonts = Array.from(new Map(fonts.map((font) => [font.postscriptName, font])).values())
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
      for (const { input } of fontFields) fillFontList(input, input.value);
      fontListStatus.textContent = systemFonts.length
        ? `${systemFonts.length} fonts`
        : "No fonts shared. Check browser permission.";
      renderFontPreview();
    } catch (error) {
      fontListStatus.textContent = error.name === "NotAllowedError"
        ? "Font access denied. Check browser permission."
        : `Could not load system fonts: ${error.message}`;
    } finally {
      loadFontsButton.disabled = false;
    }
  }

  function renderFontPreview() {
    for (const face of previewFaces) document.fonts.delete(face);
    previewFaces = core.createFontFaces({
      customFontsEnabled: customFontsInput.checked,
      ...selectedFonts()
    }, window);
    const currentFaces = previewFaces;
    for (const { input, preview, family, status } of fontFields) {
      input.disabled = !customFontsInput.checked;
      preview.style.fontFamily = "";
      const face = previewFaces.find((item) => item.family === family);
      status.textContent = face ? "Loading…" : "";
      if (!face) continue;
      document.fonts.add(face);
      face.load().then(() => {
        if (previewFaces !== currentFaces) return;
        preview.style.fontFamily = family;
        status.textContent = "";
      }).catch(() => {
        if (previewFaces !== currentFaces) return;
        status.textContent = "Font unavailable";
      });
    }
  }

  function render(settings) {
    const normalized = core.plainSettings(settings);
    enabledInput.checked = normalized.enabled;
    customFontsInput.checked = normalized.customFontsEnabled;
    for (const { key, input } of fontFields) fillFontList(input, normalized[key]);
    renderFontPreview();
    xCompactInput.checked = normalized.xCompactLayout;
    renderXSingleColumnWidth(normalized.xSingleColumnWidth);
    zhihuLayoutInput.checked = normalized.zhihuArticleLayout;
    renderZhihuArticleWidth(normalized.zhihuArticleWidth);
    document.querySelector(`input[name='appearance'][value='${normalized.appearance}']`).checked = true;
    hostTextarea.value = normalized.disabledHosts.join("\n");
    selectLight(normalized.presetLight);
    selectDark(normalized.presetDark);
  }

  async function load() {
    const raw = await chrome.storage.sync.get(null);
    render(raw);
    if (typeof window.queryLocalFonts !== "function") {
      loadFontsButton.disabled = true;
      fontListStatus.textContent = "System fonts unsupported in this browser.";
      return;
    }
    try {
      const permission = await navigator.permissions.query({ name: "local-fonts" });
      if (permission.state === "granted") await loadSystemFonts();
    } catch (error) {
      fontListStatus.textContent = `Could not check font access: ${error.message}. Use Load system fonts to request access.`;
    }
  }

  saveButton.addEventListener("click", async () => {
    const next = core.plainSettings({
      enabled: enabledInput.checked,
      customFontsEnabled: customFontsInput.checked,
      ...selectedFonts(),
      presetLight: selectedLight,
      presetDark: selectedDark,
      appearance: selectedAppearance(),
      xCompactLayout: xCompactInput.checked,
      xSingleColumnWidth: selectedXSingleColumnWidth(),
      zhihuArticleLayout: zhihuLayoutInput.checked,
      zhihuArticleWidth: selectedZhihuArticleWidth(),
      disabledHosts: hostsFromTextarea()
    });
    await chrome.storage.sync.set(next);
    await chrome.storage.sync.remove(["mode", "preset"]);
    setStatus("Saved");
  });

  resetButton.addEventListener("click", async () => {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
    await chrome.storage.sync.remove(["mode", "preset"]);
    render(DEFAULT_SETTINGS);
    setStatus("Reset");
  });

  xSingleWidthInput.addEventListener("input", () => {
    renderXSingleColumnWidth(selectedXSingleColumnWidth());
  });

  zhihuWidthInput.addEventListener("input", () => {
    renderZhihuArticleWidth(selectedZhihuArticleWidth());
  });

  customFontsInput.addEventListener("change", renderFontPreview);
  for (const { input } of fontFields) input.addEventListener("change", renderFontPreview);
  loadFontsButton.addEventListener("click", loadSystemFonts);
  for (const input of document.querySelectorAll("input[name='appearance']")) {
    input.addEventListener("change", paintSettingsChrome);
  }
  systemAppearance.addEventListener("change", paintSettingsChrome);

  fillPresetList(lightList, "light", selectLight);
  fillPresetList(darkList, "dark", selectDark);
  paintSettingsChrome();
  load();
})();
