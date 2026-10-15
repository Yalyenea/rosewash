"use strict";

importScripts("../content/core.js");

const core = globalThis.RosewashCore;
const TOGGLE_SITE_COMMAND = "toggle-current-site";
let settingsQueue = Promise.resolve();

function enqueueSettings(operation) {
  const saved = settingsQueue.then(operation);
  settingsQueue = saved.catch((error) => console.error("Could not save Rosewash settings:", error));
  return saved;
}

async function persistSettings(edit) {
  const raw = await chrome.storage.sync.get(null);
  const settings = edit(core.plainSettings(raw));
  await chrome.storage.sync.set(settings);
  await chrome.storage.sync.remove(["mode", "preset"]);
  return settings;
}

async function notifyTabs(tabId) {
  const tabs = tabId === undefined ? await chrome.tabs.query({}) : [{ id: tabId }];
  await Promise.all(tabs.filter((tab) => tab.id).map((tab) =>
    chrome.tabs.sendMessage(tab.id, { type: "rosewash:settings-updated" })
      .catch(() => undefined) // Protected or not-yet-loaded tabs have no receiver.
  ));
}

function notifySaved(tabId) {
  // Page responses never hold up the next write or the UI's saved acknowledgement.
  notifyTabs(tabId).catch((error) => console.error("Could not reapply Rosewash settings:", error));
}

async function toggleCurrentSite(tab) {
  if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || core.pageRestrictionForUrl(tab.url)) return;
  const host = core.hostFromUrl(tab.url);
  if (!host) return;
  await persistSettings((settings) => core.toggleHostEnabled(host, settings));
  notifySaved(tab.id);
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === TOGGLE_SITE_COMMAND) enqueueSettings(() => toggleCurrentSite(tab));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (![
    "rosewash:edit-settings", "rosewash:set-host-policy",
    "rosewash:reset-settings", "rosewash:reapply"
  ].includes(message?.type)) return false;
  // Only extension UI pages can request writes; page content scripts only receive updates.
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(""))) return false;

  if (message.type === "rosewash:reapply") {
    notifySaved();
    sendResponse({ ok: true });
    return false;
  }

  const saved = enqueueSettings(() => persistSettings((latest) => {
    if (message.type === "rosewash:reset-settings") return core.plainSettings(core.DEFAULT_SETTINGS);
    if (message.type === "rosewash:set-host-policy") {
      if (typeof message.host !== "string" || !message.host.trim()) throw new TypeError("Missing site hostname");
      return core.setHostPolicy(message.host, message.policy, latest);
    }
    if (!message.baseline || !message.settings) throw new TypeError("Missing settings edit");
    return core.mergeSettingsEdits(latest, message.baseline, message.settings);
  }));
  saved.then((settings) => {
    notifySaved();
    sendResponse({ ok: true, settings });
  }, (error) => sendResponse({ ok: false, error: error.message }));
  // The background owns this operation even if the popup closes before the reply.
  return true;
});
