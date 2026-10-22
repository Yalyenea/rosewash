(function () {
  "use strict";

  const core = globalThis.RosewashCore;
  const engine = core.createEngine({ document, window });
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const X_COMPACT_ATTRIBUTE = "data-rosewash-x-compact";
  const X_COMPACT_EVENT = "rosewash:x-compact-change";
  const X_EXPAND_REPLIES_ATTRIBUTE = "data-rosewash-x-expand-replies";
  const X_SINGLE_WIDTH_PROPERTY = "--rosewash-x-single";
  const ZHIHU_LAYOUT_ATTRIBUTE = "data-rosewash-zhihu-layout";
  const ZHIHU_LAYOUT_EVENT = "rosewash:zhihu-layout-change";
  const ZHIHU_WIDTH_PROPERTY = "--rosewash-zhihu-article";
  const ZHIHU_PAGE_ATTRIBUTES = [
    "data-rosewash-zhihu-article",
    "data-rosewash-zhihu-home",
    "data-rosewash-zhihu-question"
  ];
  let settingsCache = core.plainSettings(core.DEFAULT_SETTINGS);
  let settingsLoaded = false;
  let disposed = false;
  let settingsRead = 0;

  function hasExtensionContext() {
    try {
      return Boolean(globalThis.chrome && chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  // Firefox event pages sleep, so the page relays scheme changes to wake them.
  function notifyColorSchemeChange() {
    try {
      chrome.runtime.sendMessage({ type: "rosewash:color-scheme-changed" })
        .catch(() => undefined); // A reloading extension has no listener.
    } catch {
      // The extension context is already gone.
    }
  }

  function dispose() {
    disposed = true;
    darkQuery.removeEventListener("change", applyCachedSettings);
    darkQuery.removeEventListener("change", notifyColorSchemeChange);
    document.removeEventListener("DOMContentLoaded", handlePageLoaded);
    window.removeEventListener("load", handlePageLoaded);
    window.removeEventListener("pageshow", applyCachedSettings);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    if (document.documentElement?.hasAttribute(X_COMPACT_ATTRIBUTE)
      || document.documentElement?.hasAttribute(X_EXPAND_REPLIES_ATTRIBUTE)) {
      document.documentElement.removeAttribute(X_COMPACT_ATTRIBUTE);
      document.documentElement.removeAttribute(X_EXPAND_REPLIES_ATTRIBUTE);
      document.documentElement.style.removeProperty(X_SINGLE_WIDTH_PROPERTY);
      document.dispatchEvent(new CustomEvent(X_COMPACT_EVENT));
    }
    const zhihuRoot = document.documentElement;
    if (zhihuRoot?.hasAttribute(ZHIHU_LAYOUT_ATTRIBUTE)
      || ZHIHU_PAGE_ATTRIBUTES.some((attribute) => zhihuRoot?.hasAttribute(attribute))) {
      zhihuRoot.removeAttribute(ZHIHU_LAYOUT_ATTRIBUTE);
      for (const attribute of ZHIHU_PAGE_ATTRIBUTES) {
        zhihuRoot.removeAttribute(attribute);
      }
      zhihuRoot.style.removeProperty(ZHIHU_WIDTH_PROPERTY);
      document.dispatchEvent(new CustomEvent(ZHIHU_LAYOUT_EVENT));
    }
    engine.disconnect();
  }

  function syncSiteLayout() {
    if (!document.documentElement) {
      return;
    }

    const settings = core.normalizeSettings(settingsCache);
    const host = window.location.hostname.toLowerCase();
    // Site layouts belong to the top-level page, never to embedded frames.
    const allowed = window.top === window
      && settings.enabled
      && core.isHostEnabled(host, settings);
    const xActive = allowed && host === "x.com" && settings.xCompactLayout;
    if (xActive) {
      document.documentElement.style.setProperty(
        X_SINGLE_WIDTH_PROPERTY,
        `${settings.xSingleColumnWidth}px`
      );
    } else {
      document.documentElement.style.removeProperty(X_SINGLE_WIDTH_PROPERTY);
    }
    if (document.documentElement.hasAttribute(X_COMPACT_ATTRIBUTE) !== xActive) {
      document.documentElement.toggleAttribute(X_COMPACT_ATTRIBUTE, xActive);
      document.dispatchEvent(new CustomEvent(X_COMPACT_EVENT));
    }
    const expandReplies = allowed && host === "x.com" && settings.xAutoExpandReplies;
    if (document.documentElement.hasAttribute(X_EXPAND_REPLIES_ATTRIBUTE) !== expandReplies) {
      document.documentElement.toggleAttribute(X_EXPAND_REPLIES_ATTRIBUTE, expandReplies);
      document.dispatchEvent(new CustomEvent(X_COMPACT_EVENT));
    }

    const zhihuActive = allowed && core.isZhihuHost(host) && settings.zhihuArticleLayout;
    if (zhihuActive) {
      document.documentElement.style.setProperty(
        ZHIHU_WIDTH_PROPERTY,
        `${settings.zhihuArticleWidth}px`
      );
    } else {
      document.documentElement.style.removeProperty(ZHIHU_WIDTH_PROPERTY);
    }
    if (document.documentElement.hasAttribute(ZHIHU_LAYOUT_ATTRIBUTE) !== zhihuActive) {
      document.documentElement.toggleAttribute(ZHIHU_LAYOUT_ATTRIBUTE, zhihuActive);
      document.dispatchEvent(new CustomEvent(ZHIHU_LAYOUT_EVENT));
    }
  }

  function applyCachedSettings() {
    if (disposed || !settingsLoaded) {
      return;
    }

    syncSiteLayout();
    engine.apply(settingsCache);
  }

  async function readStorageSettings() {
    // Read raw keys then merge defaults so we do not invent values that hide
    // a legacy `mode` field before normalizeSettings can migrate it.
    const raw = await chrome.storage.sync.get(null);
    return core.plainSettings(raw);
  }

  async function loadSettings() {
    if (!hasExtensionContext()) {
      dispose();
      return;
    }

    const read = ++settingsRead;
    try {
      const next = await readStorageSettings();
      if (disposed || read !== settingsRead) return;
      settingsCache = next;
      settingsLoaded = true;
      applyCachedSettings();
    } catch {
      if (!disposed && read === settingsRead) dispose();
    }
  }

  function handleStorageChanged(changes, areaName) {
    if (areaName !== "sync") {
      return;
    }

    const watched = [
      "enabled",
      "defaultEnabled",
      "customFontsEnabled",
      "fontEnglish",
      "fontChinese",
      "fontMath",
      "fontMonospace",
      "preset",
      "presetLight",
      "presetDark",
      "appearance",
      "mode",
      "xCompactLayout",
      "xAutoExpandReplies",
      "xSingleColumnWidth",
      "zhihuArticleLayout",
      "zhihuArticleWidth",
      "dimImages",
      "imageBrightness",
      "disabledHosts",
      "enabledHosts",
      "ignoredElements"
    ];
    if (!watched.some((key) => Object.prototype.hasOwnProperty.call(changes, key))) {
      return;
    }

    // Full re-read avoids partial-merge bugs when keys are removed or when
    // multiple fields update across separate set/remove calls.
    loadSettings();
  }

  function handleMessage(message, _sender, sendResponse) {
    if (!message || message.type !== "rosewash:settings-updated") {
      return false;
    }

    // Notifications carry no snapshot: a delayed sender must not restore old settings.
    loadSettings().then(() => sendResponse({ ok: !disposed, stats: engine.stats() }));
    return true;
  }

  function handleVisibilityChange() {
    if (!document.hidden) {
      applyCachedSettings();
    }
  }

  function handlePageLoaded() {
    applyCachedSettings();
    if (!disposed) engine.refresh();
  }

  function start() {
    if (!hasExtensionContext()) {
      dispose();
      return;
    }

    darkQuery.addEventListener("change", applyCachedSettings);
    document.addEventListener("DOMContentLoaded", handlePageLoaded);
    window.addEventListener("load", handlePageLoaded);
    window.addEventListener("pageshow", applyCachedSettings);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (core.browserKind() === "firefox" && window.top === window) {
      darkQuery.addEventListener("change", notifyColorSchemeChange);
    }

    try {
      chrome.storage.onChanged.addListener(handleStorageChanged);
      chrome.runtime.onMessage.addListener(handleMessage);
      // Read the site policy before painting, so default-off sites stay untouched.
      loadSettings();
    } catch {
      dispose();
    }
  }

  start();
})();
