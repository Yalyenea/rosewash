(function () {
  "use strict";

  const DEFAULT_SETTINGS = {
    enabled: true,
    mode: "auto",
    disabledHosts: []
  };

  const enabledInput = document.querySelector("#enabled");
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

  function selectedMode() {
    return document.querySelector("input[name='mode']:checked").value;
  }

  function setStatus(text) {
    status.textContent = text;
    window.setTimeout(() => {
      status.textContent = "";
    }, 1400);
  }

  function render(settings) {
    enabledInput.checked = settings.enabled;
    document.querySelector(`input[name='mode'][value='${settings.mode}']`).checked = true;
    hostTextarea.value = settings.disabledHosts.join("\n");
  }

  async function load() {
    render(await chrome.storage.sync.get(DEFAULT_SETTINGS));
  }

  saveButton.addEventListener("click", async () => {
    await chrome.storage.sync.set({
      enabled: enabledInput.checked,
      mode: selectedMode(),
      disabledHosts: hostsFromTextarea()
    });
    setStatus("Saved");
  });

  resetButton.addEventListener("click", async () => {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
    render(DEFAULT_SETTINGS);
    setStatus("Reset");
  });

  load();
})();

