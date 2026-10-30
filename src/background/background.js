"use strict";

// Firefox loads core through background.scripts; Chromium loads it in the worker.
if (typeof importScripts === "function") importScripts("../content/core.js");

const core = globalThis.RosewashCore;
const TOGGLE_SITE_COMMAND = "toggle-current-site";
const TOGGLE_ENABLED_COMMAND = "toggle-enabled";
const ICON_SIZES = [16, 32, 48, 128];
const iconPaths = (state) => Object.fromEntries(
  ICON_SIZES.map((size) => [size, `/icons/icon${state}-${size}.png`])
);
const ICONS = { on: iconPaths(""), off: iconPaths("-off") };
let settingsQueue = Promise.resolve();

function enqueueSettings(operation) {
  const saved = settingsQueue.then(operation);
  settingsQueue = saved.catch((error) => console.error("Could not save Rosewash settings:", error));
  return saved;
}

async function persistSettings(edit) {
  const raw = await chrome.storage.sync.get(null);
  const settings = edit(core.plainSettings(raw));
  const { set, remove } = core.storageChanges(raw, settings);
  // New items land before stale ones go, so readers never miss a rule.
  if (Object.keys(set).length) await chrome.storage.sync.set(set);
  if (remove.length) await chrome.storage.sync.remove(remove);
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

async function toggleEnabled() {
  await persistSettings((settings) => ({ ...settings, enabled: !settings.enabled }));
  notifySaved();
}

async function ignoreElement(tab, selector) {
  const host = core.hostFromUrl(tab.url);
  if (!host || core.pageRestrictionForUrl(tab.url)) throw new TypeError("Unsupported page");
  if (typeof selector !== "string" || !selector.trim()) throw new TypeError("Missing selector");
  const settings = await persistSettings((latest) => core.addIgnoredSelector(host, selector, latest));
  notifySaved(tab.id);
  return settings;
}

// Colored while Rosewash runs on the tab's site, gray when paused, off, or blocked.
function iconStateForTab(tab, settings) {
  const host = core.hostFromUrl(tab.url);
  const active = settings.enabled && Boolean(host) && !core.pageRestrictionForUrl(tab.url)
    && (core.isHostEnabled(host, settings)
      || (settings.customFontsEnabled && core.isHostEnabled(host, settings, "fonts")));
  return active ? "on" : "off";
}

async function updateIcons(tabs) {
  const settings = core.plainSettings(await chrome.storage.sync.get(null));
  await Promise.all(tabs.filter((tab) => tab.id).map((tab) =>
    chrome.action.setIcon({ tabId: tab.id, path: ICONS[iconStateForTab(tab, settings)] })
      .catch(() => undefined) // The tab may close before its icon updates.
  ));
}

function refreshIcons(tabs) {
  (tabs ? Promise.resolve(tabs) : chrome.tabs.query({}))
    .then(updateIcons)
    .catch((error) => console.error("Could not update Rosewash icons:", error));
}

// Firefox-only dynamic frame theme; chrome.theme is absent on Chromium.
// In-memory key: an event page wake re-applies the theme once, which is fine.
let browserThemeKey;

// Fully flat: every surface uses the page canvas; only text colors differ.
function firefoxTheme(palette, variant) {
  return {
    colors: {
      frame: palette.base,
      frame_inactive: palette.base,
      tab_selected: palette.base,
      toolbar: palette.base,
      toolbar_top_separator: palette.base,
      toolbar_bottom_separator: palette.base,
      sidebar: palette.base,
      ntp_background: palette.base,
      tab_text: palette.text,
      toolbar_text: palette.text,
      icons: palette.text,
      toolbar_field_text: palette.text,
      toolbar_field_text_focus: palette.text,
      popup_text: palette.text,
      popup_highlight_text: palette.text,
      sidebar_text: palette.text,
      ntp_text: palette.text,
      tab_background_text: palette.muted,
      toolbar_field: palette.overlay,
      popup_border: palette.overlay,
      popup_highlight: palette.overlay,
      sidebar_border: palette.overlay,
      toolbar_field_focus: palette.surface,
      popup: palette.surface
    },
    // "system" keeps page prefers-color-scheme independent of the frame theme.
    properties: { color_scheme: variant, content_color_scheme: "system" }
  };
}

// Per-site policies never reset the browser-wide frame; only pause and the
// plain untinted presets do.
async function syncBrowserTheme() {
  if (!chrome.theme) return;
  const settings = core.plainSettings(await chrome.storage.sync.get(null));
  let key = "";
  let palette;
  if (settings.enabled) {
    const resolved = core.resolveSettingsThemeKey(
      settings, matchMedia("(prefers-color-scheme: dark)").matches
    );
    const candidate = core.PALETTES[resolved];
    if (candidate && candidate.tint !== false) {
      key = resolved;
      palette = candidate;
    }
  }
  if (key === browserThemeKey) return;
  browserThemeKey = key;
  if (palette) {
    await chrome.theme.update(firefoxTheme(palette, key.endsWith("-dark") ? "dark" : "light"));
  } else {
    await chrome.theme.reset();
  }
}

function refreshBrowserTheme() {
  syncBrowserTheme().catch((error) => console.error("Could not update the browser theme:", error));
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === TOGGLE_SITE_COMMAND) enqueueSettings(() => toggleCurrentSite(tab));
  if (command === TOGGLE_ENABLED_COMMAND) enqueueSettings(toggleEnabled);
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "loading") refreshIcons([tab]);
});
chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName !== "sync") return;
  refreshIcons();
  refreshBrowserTheme();
});
chrome.runtime.onStartup.addListener(() => {
  refreshIcons();
  refreshBrowserTheme();
});
chrome.runtime.onInstalled.addListener(() => {
  refreshIcons();
  refreshBrowserTheme();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // The element picker runs in the page's top frame; the site comes from the tab, not the page.
  if (message?.type === "rosewash:ignore-element") {
    if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0) return false;
    enqueueSettings(() => ignoreElement(sender.tab, message.selector)).then(
      (settings) => sendResponse({ ok: true, settings }),
      (error) => sendResponse({ ok: false, error: error.message })
    );
    return true;
  }
  // Content scripts relay prefers-color-scheme changes an event page misses.
  if (message?.type === "rosewash:color-scheme-changed") {
    if (sender.id === chrome.runtime.id) refreshBrowserTheme();
    return false;
  }
  if (![
    "rosewash:edit-settings", "rosewash:set-host-policy",
    "rosewash:reset-settings", "rosewash:reapply"
  ].includes(message?.type)) return false;
  // Only extension UI pages can request writes; page content scripts only receive updates.
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(""))) return false;

  if (message.type === "rosewash:reapply") {
    // The popup's Refresh targets the tab it was opened on.
    notifySaved(message.tabId);
    sendResponse({ ok: true });
    return false;
  }

  const saved = enqueueSettings(() => persistSettings((latest) => {
    if (message.type === "rosewash:reset-settings") return core.plainSettings(core.DEFAULT_SETTINGS);
    if (message.type === "rosewash:set-host-policy") {
      if (typeof message.host !== "string" || !message.host.trim()) throw new TypeError("Missing site hostname");
      return core.setHostPolicy(message.host, message.policy, latest, message.feature);
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
