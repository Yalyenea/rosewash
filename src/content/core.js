(function (global) {
  "use strict";

  const THEME_ATTRIBUTE = "data-rosewash-theme";
  const TINT_ATTRIBUTE = "data-rosewash-tinted";

  const PALETTES = Object.freeze({
    dawn: Object.freeze({
      base: "#faf4ed",
      surface: "#fffaf3",
      overlay: "#f2e9de",
      muted: "#9893a5",
      text: "#575279",
      link: "#286983"
    }),
    moon: Object.freeze({
      base: "#232136",
      surface: "#2a273f",
      overlay: "#393552",
      muted: "#6e6a86",
      text: "#e0def4",
      link: "#9ccfd8"
    })
  });

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    mode: "auto",
    disabledHosts: []
  });

  const VALID_MODES = new Set(["auto", "dawn", "moon"]);
  const RESTORED_PROPERTIES = [
    "background-color",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "color",
    "color-scheme",
    "scrollbar-color"
  ];

  const SKIP_SELECTOR = [
    "img",
    "picture",
    "video",
    "canvas",
    "svg",
    "iframe",
    "embed",
    "object",
    "code",
    "kbd",
    "samp",
    "textarea",
    "select",
    "input",
    "[contenteditable='true']",
    "[data-rosewash-ignore]",
    ".CodeMirror",
    ".cm-editor",
    ".monaco-editor",
    ".hljs",
    ".katex",
    ".MathJax"
  ].join(",");

  function clamp255(value) {
    return Math.max(0, Math.min(255, Number(value)));
  }

  function parseHexColor(value) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      const red = parseInt(hex[0] + hex[0], 16);
      const green = parseInt(hex[1] + hex[1], 16);
      const blue = parseInt(hex[2] + hex[2], 16);
      return { red, green, blue, alpha: 1 };
    }

    if (hex.length === 6) {
      const red = parseInt(hex.slice(0, 2), 16);
      const green = parseInt(hex.slice(2, 4), 16);
      const blue = parseInt(hex.slice(4, 6), 16);
      return { red, green, blue, alpha: 1 };
    }

    return null;
  }

  function parseColor(value) {
    if (!value || typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim().toLowerCase();
    if (trimmed === "transparent") {
      return { red: 0, green: 0, blue: 0, alpha: 0 };
    }

    if (trimmed.startsWith("#")) {
      return parseHexColor(trimmed);
    }

    if (!trimmed.startsWith("rgb")) {
      return null;
    }

    const parts = trimmed.match(/[\d.]+%?/g);
    if (!parts || parts.length < 3) {
      return null;
    }

    const channels = parts.slice(0, 3).map((part) => {
      if (part.endsWith("%")) {
        return clamp255((parseFloat(part) / 100) * 255);
      }
      return clamp255(parseFloat(part));
    });

    let alpha = 1;
    if (parts[3] !== undefined) {
      alpha = parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    }

    return {
      red: channels[0],
      green: channels[1],
      blue: channels[2],
      alpha: Math.max(0, Math.min(1, alpha))
    };
  }

  function luminance(color) {
    return (0.2126 * color.red) + (0.7152 * color.green) + (0.0722 * color.blue);
  }

  function channelSpread(color) {
    return Math.max(color.red, color.green, color.blue) - Math.min(color.red, color.green, color.blue);
  }

  function isNearWhiteColor(color) {
    return Boolean(color)
      && color.alpha > 0.05
      && luminance(color) >= 244
      && channelSpread(color) <= 22;
  }

  function isDarkNeutralColor(color) {
    return Boolean(color)
      && color.alpha > 0.05
      && luminance(color) <= 118
      && channelSpread(color) <= 92;
  }

  function normalizeHost(host) {
    return String(host || "")
      .trim()
      .toLowerCase()
      .replace(/^\.+/, "");
  }

  function hostFromUrl(value) {
    try {
      return normalizeHost(new URL(value).hostname);
    } catch {
      return "";
    }
  }

  function isHostDisabled(host, disabledHosts) {
    const normalizedHost = normalizeHost(host);
    if (!normalizedHost) {
      return false;
    }

    return disabledHosts.some((entry) => {
      const disabledHost = normalizeHost(entry);
      return disabledHost
        && (normalizedHost === disabledHost || normalizedHost.endsWith(`.${disabledHost}`));
    });
  }

  function normalizeSettings(settings) {
    const source = settings && typeof settings === "object" ? settings : {};
    const disabledHosts = Array.isArray(source.disabledHosts)
      ? source.disabledHosts.map(normalizeHost).filter(Boolean)
      : [];
    const mode = VALID_MODES.has(source.mode) ? source.mode : DEFAULT_SETTINGS.mode;

    return {
      enabled: source.enabled !== false,
      mode,
      disabledHosts: Array.from(new Set(disabledHosts)).sort()
    };
  }

  function resolveThemeMode(mode, prefersDark) {
    if (mode === "dawn" || mode === "moon") {
      return mode;
    }

    return prefersDark ? "moon" : "dawn";
  }

  function shouldTintTextColor(theme, color, surfaceTinted) {
    if (!isDarkNeutralColor(color)) {
      return false;
    }

    return theme === "moon" || surfaceTinted;
  }

  function isElementNode(node) {
    return node && node.nodeType === 1;
  }

  function isPageElement(element, document) {
    return element === document.documentElement || element === document.body;
  }

  function shouldSkipElement(element) {
    if (!isElementNode(element)) {
      return true;
    }

    return Boolean(element.closest(SKIP_SELECTOR));
  }

  function createEngine({ document, window }) {
    const originalStyles = new WeakMap();
    const tintedElements = new Set();
    let observer = null;
    let pendingRoots = new Set();
    let pendingTimer = null;
    let activeTheme = null;

    function remember(element) {
      if (originalStyles.has(element)) {
        return;
      }

      const styles = {};
      for (const property of RESTORED_PROPERTIES) {
        styles[property] = {
          value: element.style.getPropertyValue(property),
          priority: element.style.getPropertyPriority(property)
        };
      }
      originalStyles.set(element, styles);
    }

    function setStyle(element, property, value) {
      remember(element);
      tintedElements.add(element);
      element.style.setProperty(property, value);
      element.setAttribute(TINT_ATTRIBUTE, activeTheme);
    }

    function restoreElement(element) {
      const styles = originalStyles.get(element);
      if (!styles) {
        return;
      }

      for (const property of RESTORED_PROPERTIES) {
        const item = styles[property];
        if (item.value) {
          element.style.setProperty(property, item.value, item.priority);
        } else {
          element.style.removeProperty(property);
        }
      }

      element.removeAttribute(TINT_ATTRIBUTE);
    }

    function restoreTintedElements() {
      for (const element of tintedElements) {
        restoreElement(element);
      }
      tintedElements.clear();
    }

    function tintBorders(element, computedStyle, palette) {
      const borderPairs = [
        ["border-top-color", computedStyle.borderTopColor],
        ["border-right-color", computedStyle.borderRightColor],
        ["border-bottom-color", computedStyle.borderBottomColor],
        ["border-left-color", computedStyle.borderLeftColor]
      ];

      for (const [property, value] of borderPairs) {
        if (isNearWhiteColor(parseColor(value))) {
          setStyle(element, property, palette.overlay);
        }
      }
    }

    function tintText(element, computedStyle, palette, surfaceTinted) {
      if (shouldTintTextColor(activeTheme, parseColor(computedStyle.color), surfaceTinted)) {
        setStyle(element, "color", palette.text);
      }
    }

    function processElement(element, theme) {
      if (shouldSkipElement(element)) {
        return;
      }

      const palette = PALETTES[theme];
      const computedStyle = window.getComputedStyle(element);
      const background = parseColor(computedStyle.backgroundColor);
      const hasBackgroundImage = computedStyle.backgroundImage && computedStyle.backgroundImage !== "none";
      const pageElement = isPageElement(element, document);

      const surfaceTinted = !hasBackgroundImage && isNearWhiteColor(background);
      if (surfaceTinted) {
        const surface = element.tagName.toLowerCase() === "pre" && theme === "moon"
          ? palette.overlay
          : palette.surface;
        setStyle(element, "background-color", pageElement ? palette.base : surface);
      }

      tintText(element, computedStyle, palette, surfaceTinted);
      tintBorders(element, computedStyle, palette);
    }

    function scan(root, theme) {
      const start = isElementNode(root) ? root : document.documentElement;
      processElement(start, theme);

      for (const element of start.querySelectorAll("*")) {
        processElement(element, theme);
      }
    }

    function flushPending() {
      pendingTimer = null;
      const roots = pendingRoots;
      pendingRoots = new Set();

      for (const root of roots) {
        scan(root, activeTheme);
      }
    }

    function scheduleScan(root) {
      pendingRoots.add(root);
      if (pendingTimer !== null) {
        return;
      }

      pendingTimer = window.setTimeout(flushPending, 250);
    }

    function observe() {
      if (observer || !document.documentElement) {
        return;
      }

      observer = new window.MutationObserver((records) => {
        if (!activeTheme) {
          return;
        }

        for (const record of records) {
          for (const node of record.addedNodes) {
            if (isElementNode(node)) {
              scheduleScan(node);
            }
          }
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    function disconnectObserver() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (pendingTimer !== null) {
        window.clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      pendingRoots = new Set();
    }

    function clear() {
      disconnectObserver();
      restoreTintedElements();
      activeTheme = null;
      document.documentElement.removeAttribute(THEME_ATTRIBUTE);
    }

    function apply(settings) {
      const normalized = normalizeSettings(settings);
      const host = hostFromUrl(document.location.href);
      if (!normalized.enabled || isHostDisabled(host, normalized.disabledHosts)) {
        clear();
        return { enabled: false, theme: null, tinted: 0 };
      }

      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const theme = resolveThemeMode(normalized.mode, prefersDark);
      if (activeTheme && activeTheme !== theme) {
        restoreTintedElements();
      }

      activeTheme = theme;
      document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
      setStyle(document.documentElement, "color-scheme", theme === "moon" ? "dark" : "light");
      setStyle(document.documentElement, "scrollbar-color", `${PALETTES[theme].muted} ${PALETTES[theme].base}`);
      scan(document.documentElement, theme);
      observe();
      return { enabled: true, theme, tinted: tintedElements.size };
    }

    function stats() {
      return { theme: activeTheme, tinted: tintedElements.size };
    }

    return { apply, clear, stats, disconnect: disconnectObserver };
  }

  const api = Object.freeze({
    DEFAULT_SETTINGS,
    PALETTES,
    createEngine,
    hostFromUrl,
    isDarkNeutralColor,
    isHostDisabled,
    isNearWhiteColor,
    luminance,
    normalizeSettings,
    parseColor,
    resolveThemeMode,
    shouldTintTextColor
  });

  global.RosewashCore = api;
})(globalThis);
