(function () {
  "use strict";

  const core = globalThis.RosewashCore;
  const pdfOpen = globalThis.RosewashPdfOpen;
  if (!core || !pdfOpen) {
    document.body.innerHTML = "<p>Rosewash core failed to load.</p>";
    return;
  }

  const DEFAULT_SETTINGS = core.plainSettings(core.DEFAULT_SETTINGS);

  const enabledInput = document.querySelector("#enabled");
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
  const pdfTemplateRow = document.querySelector("#pdf-template-row");
  const pdfCustomTemplateInput = document.querySelector("#pdf-custom-template");

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
    return document.querySelector("input[name='appearance']:checked").value;
  }

  function selectedPdfOpener() {
    return document.querySelector("input[name='pdf-opener']:checked").value;
  }

  function renderPdfSettings(raw) {
    const settings = pdfOpen.normalizeOpenerSettings(raw);
    document.querySelector(`input[name='pdf-opener'][value='${settings.pdfOpener}']`).checked = true;
    pdfCustomTemplateInput.value = settings.pdfCustomOpenerTemplate;
    pdfTemplateRow.hidden = settings.pdfOpener !== "custom";
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
  }

  function selectDark(presetId) {
    selectedDark = presetId;
    markSelected(darkList, presetId);
  }

  function render(settings) {
    const normalized = core.plainSettings(settings);
    enabledInput.checked = normalized.enabled;
    xCompactInput.checked = normalized.xCompactLayout;
    renderXSingleColumnWidth(normalized.xSingleColumnWidth);
    zhihuLayoutInput.checked = normalized.zhihuArticleLayout;
    renderZhihuArticleWidth(normalized.zhihuArticleWidth);
    document.querySelector(`input[name='appearance'][value='${normalized.appearance}']`).checked = true;
    hostTextarea.value = normalized.disabledHosts.join("\n");
    selectLight(normalized.presetLight);
    selectDark(normalized.presetDark);
    renderPdfSettings(settings);
  }

  async function load() {
    const raw = await chrome.storage.sync.get(null);
    render(raw);
  }

  saveButton.addEventListener("click", async () => {
    const pdfOpener = selectedPdfOpener();
    const pdfCustomOpenerTemplate = pdfCustomTemplateInput.value.trim();
    if (pdfOpener === "custom" && !pdfOpen.validateOpenerTemplate(pdfCustomOpenerTemplate)) {
      setStatus("Use a custom URL Scheme with {fileURL} or {filePath}");
      return;
    }
    const next = core.plainSettings({
      enabled: enabledInput.checked,
      presetLight: selectedLight,
      presetDark: selectedDark,
      appearance: selectedAppearance(),
      xCompactLayout: xCompactInput.checked,
      xSingleColumnWidth: selectedXSingleColumnWidth(),
      zhihuArticleLayout: zhihuLayoutInput.checked,
      zhihuArticleWidth: selectedZhihuArticleWidth(),
      disabledHosts: hostsFromTextarea()
    });
    await chrome.storage.sync.set({ ...next, pdfOpener, pdfCustomOpenerTemplate });
    await chrome.storage.sync.remove(["mode", "preset"]);
    setStatus("Saved");
  });

  resetButton.addEventListener("click", async () => {
    const pdfDefaults = {
      pdfOpener: pdfOpen.DEFAULT_OPENER,
      pdfCustomOpenerTemplate: ""
    };
    await chrome.storage.sync.set({ ...DEFAULT_SETTINGS, ...pdfDefaults });
    await chrome.storage.sync.remove(["mode", "preset"]);
    render(DEFAULT_SETTINGS);
    renderPdfSettings(pdfDefaults);
    setStatus("Reset");
  });

  xSingleWidthInput.addEventListener("input", () => {
    renderXSingleColumnWidth(selectedXSingleColumnWidth());
  });

  zhihuWidthInput.addEventListener("input", () => {
    renderZhihuArticleWidth(selectedZhihuArticleWidth());
  });

  for (const input of document.querySelectorAll("input[name='pdf-opener']")) {
    input.addEventListener("change", () => {
      pdfTemplateRow.hidden = selectedPdfOpener() !== "custom";
    });
  }

  fillPresetList(lightList, "light", selectLight);
  fillPresetList(darkList, "dark", selectDark);
  load();
})();
