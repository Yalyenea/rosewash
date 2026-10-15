"use strict";

importScripts("../content/core.js");

const core = globalThis.RosewashCore;
const TOGGLE_SITE_COMMAND = "toggle-current-site";
let toggleQueue = Promise.resolve();

async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function toggleCurrentSite(tab) {
  tab = tab || await activeTab();
  if (!tab || core.pageRestrictionForUrl(tab.url)) {
    return;
  }

  const host = core.hostFromUrl(tab.url);
  if (!host) {
    return;
  }

  const raw = await chrome.storage.sync.get(null);
  const settings = core.plainSettings(raw);
  const next = core.toggleHostEnabled(host, settings);
  await chrome.storage.sync.set(next);
  // Apply to the command's page directly, without waiting for its storage re-read.
  // Other tabs continue to receive the persisted change through storage.onChanged.
  await chrome.tabs.sendMessage(tab.id, { type: "rosewash:settings-updated", settings: next })
    .catch(() => undefined); // Protected or not-yet-loaded tabs have no receiver.
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === TOGGLE_SITE_COMMAND) {
    toggleQueue = toggleQueue.then(() => toggleCurrentSite(tab))
      .catch((error) => console.error("Could not toggle Rosewash on this site:", error));
  }
});
