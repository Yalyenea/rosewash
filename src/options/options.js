(function () {
  "use strict";

  const core = globalThis.RosewashCore;
  if (!core) {
    document.body.innerHTML = "<p>Rosewash core failed to load.</p>";
    return;
  }

  const DEFAULT_SETTINGS = core.plainSettings(core.DEFAULT_SETTINGS);

  const enabledInput = document.querySelector("#enabled");
  const presetSelect = document.querySelector("#preset");
  const hostTextarea = document.querySelector("#disabled-hosts");
  const saveButton = document.querySelector("#save");
  const resetButton = document.querySelector("#reset");
  const status = document.querySelector("#status");

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

  function fillPresetOptions() {
    const presets = Object.values(core.PRESETS).slice().sort((a, b) => {
      if (a.id === "rose-pine") {
        return -1;
      }
      if (b.id === "rose-pine") {
        return 1;
      }
      return a.label.localeCompare(b.label);
    });

    for (const preset of presets) {
      const option = document.createElement("option");
      option.value = preset.id;
      const variants = [];
      if (preset.light) {
        variants.push("light");
      }
      if (preset.dark) {
        variants.push("dark");
      }
      option.textContent = `${preset.label} (${variants.join(" / ")})`;
      presetSelect.appendChild(option);
    }
  }

  function render(settings) {
    const normalized = core.plainSettings(settings);
    enabledInput.checked = normalized.enabled;
    document.querySelector(`input[name='appearance'][value='${normalized.appearance}']`).checked = true;
    presetSelect.value = normalized.preset;
    hostTextarea.value = normalized.disabledHosts.join("\n");
  }

  async function load() {
    const raw = await chrome.storage.sync.get(null);
    render({ ...DEFAULT_SETTINGS, ...raw });
  }

  saveButton.addEventListener("click", async () => {
    const next = core.plainSettings({
      enabled: enabledInput.checked,
      preset: presetSelect.value,
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

  fillPresetOptions();
  load();
})();
