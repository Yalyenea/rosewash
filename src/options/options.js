(function () {
  "use strict";

  const core = globalThis.RosewashCore;
  if (!core) {
    document.body.innerHTML = "<p>Rosewash core failed to load.</p>";
    return;
  }

  const DEFAULT_SETTINGS = core.plainSettings(core.DEFAULT_SETTINGS);

  const enabledInput = document.querySelector("#enabled");
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
    return document.querySelector("input[name='appearance']:checked").value;
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
    document.querySelector(`input[name='appearance'][value='${normalized.appearance}']`).checked = true;
    hostTextarea.value = normalized.disabledHosts.join("\n");
    selectLight(normalized.presetLight);
    selectDark(normalized.presetDark);
  }

  async function load() {
    const raw = await chrome.storage.sync.get(null);
    render(raw);
  }

  saveButton.addEventListener("click", async () => {
    const next = core.plainSettings({
      enabled: enabledInput.checked,
      presetLight: selectedLight,
      presetDark: selectedDark,
      appearance: selectedAppearance(),
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

  fillPresetList(lightList, "light", selectLight);
  fillPresetList(darkList, "dark", selectDark);
  load();
})();
