"use strict";

importScripts("../content/core.js");

const core = globalThis.RosewashCore;
const TOGGLE_SITE_COMMAND = "toggle-current-site";

async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function toggleCurrentSite() {
  const tab = await activeTab();
  if (!tab || !tab.url) {
    return;
  }

  const host = core.hostFromUrl(tab.url);
  if (!host) {
    return;
  }

  const settings = core.normalizeSettings(await chrome.storage.sync.get(core.DEFAULT_SETTINGS));
  const disabledHosts = core.toggleHostDisabled(host, settings.disabledHosts);
  await chrome.storage.sync.set({ ...settings, disabledHosts });
}

chrome.commands.onCommand.addListener((command) => {
  if (command === TOGGLE_SITE_COMMAND) {
    toggleCurrentSite();
  }
});
