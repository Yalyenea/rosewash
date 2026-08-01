(function () {
  "use strict";

  const core = globalThis.RosewashCore;
  if (!core) {
    document.body.innerHTML = "<p>Rosewash core failed to load.</p>";
    return;
  }

  const DEFAULT_SETTINGS = core.plainSettings(core.DEFAULT_SETTINGS);

  const enabledInput = document.querySelector("#enabled");
  const presetList = document.querySelector("#preset-list");
  const hostTextarea = document.querySelector("#disabled-hosts");
  const saveButton = document.querySelector("#save");
  const resetButton = document.querySelector("#reset");
  const status = document.querySelector("#status");

  let selectedPreset = DEFAULT_SETTINGS.preset;

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

  function sortedPresets() {
    return Object.values(core.PRESETS).slice().sort((a, b) => {
      if (a.id === "rose-pine") {
        return -1;
      }
      if (b.id === "rose-pine") {
        return 1;
      }
      return a.label.localeCompare(b.label);
    });
  }

  function swatchColors(preset) {
    const sample = preset.light || preset.dark;
    return {
      base: sample.base,
      surface: sample.surface,
      text: sample.text,
      link: sample.link
    };
  }

  function fillPresetList() {
    presetList.replaceChildren();

    for (const preset of sortedPresets()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preset-card";
      button.dataset.preset = preset.id;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", "false");

      const variants = [];
      if (preset.light) {
        variants.push("Light");
      }
      if (preset.dark) {
        variants.push("Dark");
      }

      const colors = swatchColors(preset);
      button.innerHTML = `
        <span class="swatches" aria-hidden="true">
          <span style="background:${colors.base}"></span>
          <span style="background:${colors.surface}"></span>
          <span style="background:${colors.text}"></span>
          <span style="background:${colors.link}"></span>
        </span>
        <span class="meta">
          <span class="name">${preset.label}</span>
          <span class="variants">${variants.join(" · ")}</span>
        </span>
      `;

      button.addEventListener("click", () => {
        selectPreset(preset.id);
      });

      presetList.appendChild(button);
    }
  }

  function selectPreset(presetId) {
    selectedPreset = presetId;
    for (const button of presetList.querySelectorAll(".preset-card")) {
      const on = button.dataset.preset === presetId;
      button.setAttribute("aria-selected", String(on));
      button.classList.toggle("is-selected", on);
    }
  }

  function render(settings) {
    const normalized = core.plainSettings(settings);
    enabledInput.checked = normalized.enabled;
    document.querySelector(`input[name='appearance'][value='${normalized.appearance}']`).checked = true;
    hostTextarea.value = normalized.disabledHosts.join("\n");
    selectPreset(normalized.preset);
  }

  async function load() {
    const raw = await chrome.storage.sync.get(null);
    render({ ...DEFAULT_SETTINGS, ...raw });
  }

  saveButton.addEventListener("click", async () => {
    const next = core.plainSettings({
      enabled: enabledInput.checked,
      preset: selectedPreset,
      appearance: selectedAppearance(),
      disabledHosts: hostsFromTextarea()
    });
    await chrome.storage.sync.set(next);
    await chrome.storage.sync.remove("mode");
    setStatus(`Saved · ${next.preset}`);
  });

  resetButton.addEventListener("click", async () => {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
    await chrome.storage.sync.remove("mode");
    render(DEFAULT_SETTINGS);
    setStatus("Reset");
  });

  fillPresetList();
  load();
})();
