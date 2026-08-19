(function () {
  "use strict";

  const core = globalThis.RosewashCore;
  const engine = core.createEngine({ document, window });
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const ZHIHU_LAYOUT_ATTRIBUTE = "data-rosewash-zhihu-layout";
  const ZHIHU_LAYOUT_EVENT = "rosewash:zhihu-layout-change";
  const ZHIHU_WIDTH_PROPERTY = "--rosewash-zhihu-article";
  const ZHIHU_ARTICLE_ATTRIBUTE = "data-rosewash-zhihu-article";
  const LAYOUT_HINT_KEY = "rosewash:layout-hint";
  let settingsCache = core.plainSettings(core.DEFAULT_SETTINGS);
  let disposed = false;

  function readLayoutHint() {
    try {
      return JSON.parse(window.localStorage.getItem(LAYOUT_HINT_KEY) || "null");
    } catch {
      return null;
    }
  }

  function writeLayoutHint(settings) {
    try {
      window.localStorage.setItem(LAYOUT_HINT_KEY, JSON.stringify({
        zhihuArticleLayout: settings.zhihuArticleLayout === true,
        zhihuArticleWidth: settings.zhihuArticleWidth
      }));
    } catch {
    }
  }

  function hasExtensionContext() {
    try {
      return Boolean(globalThis.chrome && chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  function dispose() {
    disposed = true;
    darkQuery.removeEventListener("change", applyCachedSettings);
    document.removeEventListener("DOMContentLoaded", applyCachedSettings);
    window.removeEventListener("load", applyCachedSettings);
    window.removeEventListener("pageshow", applyCachedSettings);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    if (document.documentElement?.hasAttribute(ZHIHU_LAYOUT_ATTRIBUTE)
      || document.documentElement?.hasAttribute(ZHIHU_ARTICLE_ATTRIBUTE)) {
      document.documentElement.removeAttribute(ZHIHU_LAYOUT_ATTRIBUTE);
      document.documentElement.removeAttribute(ZHIHU_ARTICLE_ATTRIBUTE);
      document.documentElement.style.removeProperty(ZHIHU_WIDTH_PROPERTY);
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
    const allowed = settings.enabled
      && !core.isHostDisabled(host, settings.disabledHosts);
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
    if (disposed) {
      return;
    }

    syncSiteLayout();
    writeLayoutHint(core.normalizeSettings(settingsCache));
    engine.apply(settingsCache);
  }

  // Paint the canvas token before chrome.storage returns so theme.css can
  // force html/body on the first frame. Refined once real settings load.
  function paintProvisionalRoot() {
    if (disposed || !document.documentElement) {
      return;
    }

    const theme = core.resolveSettingsThemeKey(settingsCache, darkQuery.matches);
    core.applyThemeTokens(document.documentElement, theme);
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

    try {
      settingsCache = await readStorageSettings();
      applyCachedSettings();
    } catch {
      dispose();
    }
  }

  function handleStorageChanged(changes, areaName) {
    if (areaName !== "sync") {
      return;
    }

    const watched = [
      "enabled",
      "preset",
      "presetLight",
      "presetDark",
      "appearance",
      "mode",
      "zhihuArticleLayout",
      "zhihuArticleWidth",
      "disabledHosts"
    ];
    if (!watched.some((key) => Object.prototype.hasOwnProperty.call(changes, key))) {
      return;
    }

    // Full re-read avoids partial-merge bugs when keys are removed or when
    // multiple fields update across separate set/remove calls.
    readStorageSettings()
      .then((next) => {
        if (disposed) {
          return;
        }
        settingsCache = next;
        applyCachedSettings();
      })
      .catch(() => {
        dispose();
      });
  }

  function handleMessage(message, _sender, sendResponse) {
    if (!message || message.type !== "rosewash:settings-updated") {
      return false;
    }

    settingsCache = core.plainSettings(message.settings);
    applyCachedSettings();
    sendResponse({ ok: true, stats: engine.stats() });
    return true;
  }

  function handleVisibilityChange() {
    if (!document.hidden) {
      applyCachedSettings();
    }
  }

  function start() {
    if (!hasExtensionContext()) {
      dispose();
      return;
    }

    darkQuery.addEventListener("change", applyCachedSettings);
    document.addEventListener("DOMContentLoaded", applyCachedSettings);
    window.addEventListener("load", applyCachedSettings);
    window.addEventListener("pageshow", applyCachedSettings);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    try {
      chrome.storage.onChanged.addListener(handleStorageChanged);
      chrome.runtime.onMessage.addListener(handleMessage);
      // 1) Attribute + tokens so theme.css covers the canvas this frame.
      paintProvisionalRoot();
      const hint = readLayoutHint();
      if (hint) {
        settingsCache = core.plainSettings({ ...settingsCache, ...hint });
      }
      // 2) Default full cover immediately (document_start DOM is small).
      applyCachedSettings();
      // 3) Storage refines enabled/presets/appearance/blocklist without a blank gap.
      loadSettings();
    } catch {
      dispose();
    }
  }

  start();
})();
