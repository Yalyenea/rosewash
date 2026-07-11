(function (global) {
  "use strict";

  const THEME_ATTRIBUTE = "data-rosewash-theme";
  const TINT_ATTRIBUTE = "data-rosewash-tinted";
  const HAD_STYLE_ATTRIBUTE = "data-rosewash-had-style";
  const ORIGINAL_STYLE_ATTRIBUTE = "data-rosewash-original-style";

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
    "background-image",
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

  function parseColorAlpha(value) {
    if (!value) {
      return 1;
    }

    const number = parseFloat(value);
    if (!Number.isFinite(number)) {
      return 1;
    }

    return Math.max(0, Math.min(1, value.endsWith("%") ? number / 100 : number));
  }

  function colorFromLightness(lightness, chroma) {
    const base = clamp255(lightness * 255);
    const spread = clamp255(chroma);
    return {
      red: clamp255(base + (spread * 0.55)),
      green: clamp255(base - (spread * 0.25)),
      blue: clamp255(base - (spread * 0.3)),
      alpha: 1
    };
  }

  function parseCssColor4(value) {
    const match = value.match(/^(oklab|oklch|lab|lch)\((.*)\)$/);
    if (!match) {
      return null;
    }

    const fn = match[1];
    const [body, alphaBody] = match[2].split("/");
    const parts = body.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?%?/g);
    if (!parts || parts.length < 3) {
      return null;
    }

    const rawLightness = parseFloat(parts[0]);
    if (!Number.isFinite(rawLightness)) {
      return null;
    }

    const lightness = parts[0].endsWith("%")
      ? rawLightness / 100
      : (fn.startsWith("ok") ? rawLightness : rawLightness / 100);
    let chroma = 0;

    if (fn === "lab" || fn === "oklab") {
      const a = parseFloat(parts[1]);
      const b = parseFloat(parts[2]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        return null;
      }
      chroma = Math.sqrt((a * a) + (b * b));
    } else {
      chroma = parseFloat(parts[1]);
      if (!Number.isFinite(chroma)) {
        return null;
      }
    }

    const normalizedChroma = fn.startsWith("ok") ? chroma * 600 : chroma * 2;
    return {
      ...colorFromLightness(Math.max(0, Math.min(1, lightness)), normalizedChroma),
      alpha: parseColorAlpha((alphaBody || "").trim())
    };
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

    const cssColor4 = parseCssColor4(trimmed);
    if (cssColor4) {
      return cssColor4;
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
      alpha = parseColorAlpha(parts[3]);
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

  function isTransparentColor(color) {
    return !color || color.alpha <= 0.05;
  }

  function isNearWhiteColor(color) {
    return Boolean(color)
      && color.alpha > 0.05
      && luminance(color) >= 244
      && channelSpread(color) <= 22;
  }

  // Default document canvas is white when html/body leave background unset.
  // Sites like jmlr.org rely on that and never set an explicit near-white fill.
  function isSurfaceTintBackground(color, { pageElement = false, pageTone = "mixed" } = {}) {
    if (isNearWhiteColor(color)) {
      return true;
    }

    return pageElement && pageTone !== "dark-only" && isTransparentColor(color);
  }

  function isDarkNeutralColor(color) {
    return Boolean(color)
      && color.alpha > 0.05
      && luminance(color) <= 118
      && channelSpread(color) <= 92;
  }

  function isDarkSurfaceColor(color) {
    return Boolean(color)
      && color.alpha > 0.05
      && luminance(color) <= 92
      && channelSpread(color) <= 86;
  }

  function isLightNeutralColor(color) {
    return Boolean(color)
      && color.alpha > 0.05
      && luminance(color) >= 150
      && channelSpread(color) <= 100;
  }

  function classifyPageTone(samples) {
    let darkSurfaces = 0;
    let lightSurfaces = 0;
    let lightText = 0;
    let darkSignals = 0;

    for (const sample of samples) {
      const background = parseColor(sample.backgroundColor);
      const color = parseColor(sample.color);
      if (isDarkSurfaceColor(background)) {
        darkSurfaces += 1;
      }
      if (isNearWhiteColor(background)) {
        lightSurfaces += 1;
      }
      if (isLightNeutralColor(color)) {
        lightText += 1;
      }
      if (sample.darkSignal === true) {
        darkSignals += 1;
      }
    }

    if (darkSurfaces >= 1 && darkSignals >= 1 && lightSurfaces === 0) {
      return "dark-only";
    }

    if (darkSurfaces >= 2 && lightText >= 1 && lightSurfaces === 0) {
      return "dark-only";
    }

    if (lightSurfaces > 0) {
      return "light-page";
    }

    return "mixed";
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

  const PAGE_CHROME_CLASSES = new Set([
    "AppHeader",
    "LeanAppHeaderBar",
    "MobileAppHeader"
  ]);

  function hasPageChromeClass(className) {
    return String(className || "")
      .split(/\s+/)
      .some((token) => PAGE_CHROME_CLASSES.has(token));
  }

  function isPageChromeCandidate({ tagName, role, className, insideContent, insideChrome }) {
    if (insideContent) {
      return false;
    }

    const normalizedTag = String(tagName || "").toLowerCase();
    const normalizedRole = String(role || "").toLowerCase();
    return normalizedTag === "header"
      || normalizedRole === "banner"
      || hasPageChromeClass(className)
      || (normalizedTag === "nav" && !insideChrome);
  }

  function isGeneratedBackgroundImage(value) {
    return typeof value === "string" && /\b(?:linear|radial|conic|repeating-linear|repeating-radial|repeating-conic)-gradient\(/.test(value);
  }

  function generatedBackgroundHasDarkSurface(value) {
    if (!isGeneratedBackgroundImage(value)) {
      return false;
    }

    const colors = value.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) || [];
    return colors.some((color) => isDarkSurfaceColor(parseColor(color)));
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
    let tintedPageChrome = new WeakSet();
    let observer = null;
    let pendingRoots = new Set();
    let pendingTimer = null;
    let activeMode = null;
    let activeTheme = null;
    let activePageTone = "mixed";

    function remember(element) {
      if (originalStyles.has(element)) {
        return;
      }

      if (!element.hasAttribute(ORIGINAL_STYLE_ATTRIBUTE)) {
        const originalStyle = element.getAttribute("style");
        element.setAttribute(HAD_STYLE_ATTRIBUTE, originalStyle === null ? "false" : "true");
        element.setAttribute(ORIGINAL_STYLE_ATTRIBUTE, originalStyle || "");
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

    function setStyle(element, property, value, priority = "") {
      remember(element);
      tintedElements.add(element);
      element.style.setProperty(property, value, priority);
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
      element.removeAttribute(HAD_STYLE_ATTRIBUTE);
      element.removeAttribute(ORIGINAL_STYLE_ATTRIBUTE);
    }

    function restoreTintedElements() {
      for (const element of tintedElements) {
        restoreElement(element);
      }
      tintedElements.clear();
      tintedPageChrome = new WeakSet();
    }

    function restoreStaleTintedElements() {
      const selector = `[${TINT_ATTRIBUTE}][${HAD_STYLE_ATTRIBUTE}][${ORIGINAL_STYLE_ATTRIBUTE}]`;
      const staleElements = [
        ...(document.documentElement.matches(selector) ? [document.documentElement] : []),
        ...document.querySelectorAll(selector)
      ];
      for (const element of staleElements) {
        if (element.getAttribute(HAD_STYLE_ATTRIBUTE) === "true") {
          element.setAttribute("style", element.getAttribute(ORIGINAL_STYLE_ATTRIBUTE) || "");
        } else {
          element.removeAttribute("style");
        }
        element.removeAttribute(TINT_ATTRIBUTE);
        element.removeAttribute(HAD_STYLE_ATTRIBUTE);
        element.removeAttribute(ORIGINAL_STYLE_ATTRIBUTE);
      }
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

    function lightenDarkBorders(element, computedStyle, palette) {
      const borderPairs = [
        ["border-top-color", computedStyle.borderTopColor],
        ["border-right-color", computedStyle.borderRightColor],
        ["border-bottom-color", computedStyle.borderBottomColor],
        ["border-left-color", computedStyle.borderLeftColor]
      ];

      for (const [property, value] of borderPairs) {
        const color = parseColor(value);
        if (isDarkSurfaceColor(color) || isLightNeutralColor(color)) {
          setStyle(element, property, palette.overlay);
        }
      }
    }

    function tintText(element, computedStyle, palette, surfaceTinted) {
      if (shouldTintTextColor(activeTheme, parseColor(computedStyle.color), surfaceTinted)) {
        setStyle(element, "color", palette.text);
      }
    }

    function elementClassName(element) {
      return typeof element.className === "string"
        ? element.className
        : element.getAttribute("class") || "";
    }

    function isPageChromeElement(element) {
      return isPageChromeCandidate({
        tagName: element.tagName,
        role: element.getAttribute("role"),
        className: elementClassName(element),
        insideContent: Boolean(element.closest("main, article")),
        insideChrome: Boolean(element.parentElement?.closest(
          "header, [role='banner'], .AppHeader, .LeanAppHeaderBar, .MobileAppHeader"
        ))
      });
    }

    function isInsideTintedPageChrome(element) {
      for (let current = element; current; current = current.parentElement) {
        if (tintedPageChrome.has(current)) {
          return true;
        }
      }
      return false;
    }

    function lightenDarkText(element, computedStyle, palette) {
      if (isLightNeutralColor(parseColor(computedStyle.color))) {
        setStyle(element, "color", palette.text);
      }
    }

    function detectPageTone() {
      const candidates = [
        document.documentElement,
        document.body,
        document.querySelector("#root"),
        ...(document.body ? Array.from(document.body.children) : []),
        ...document.querySelectorAll("#root > *"),
        ...document.querySelectorAll("main, article, section, header, footer, nav, aside")
      ].filter(Boolean);

      const uniqueCandidates = Array.from(new Set(candidates)).slice(0, 48);

      return classifyPageTone(uniqueCandidates.map((element) => {
        const computedStyle = window.getComputedStyle(element);
        return {
          backgroundColor: computedStyle.backgroundColor,
          color: computedStyle.color,
          darkSignal: element.classList.contains("dark")
            || computedStyle.colorScheme.split(/\s+/).includes("dark")
        };
      }));
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

      if (theme === "dawn" && activePageTone === "dark-only") {
        const generatedBackground = isGeneratedBackgroundImage(computedStyle.backgroundImage);
        const darkSurfaceTinted = isDarkSurfaceColor(background)
          || generatedBackgroundHasDarkSurface(computedStyle.backgroundImage);
        if (darkSurfaceTinted) {
          if (generatedBackground) {
            setStyle(element, "background-image", "none");
          }
          setStyle(element, "background-color", pageElement ? palette.base : palette.surface);
        }

        lightenDarkText(element, computedStyle, palette);
        lightenDarkBorders(element, computedStyle, palette);
        return;
      }

      const generatedBackground = isGeneratedBackgroundImage(computedStyle.backgroundImage);
      const chromeCandidate = isPageChromeElement(element);
      const knownChromeClass = hasPageChromeClass(elementClassName(element));
      // Semantic headers / known site shells still paint when the root is
      // transparent (background lives on a child or CSS-in-JS layer).
      const pageChromeTinted = chromeCandidate
        && (knownChromeClass || background?.alpha > 0.05 || generatedBackground)
        && (knownChromeClass || !hasBackgroundImage || generatedBackground);
      if (pageChromeTinted) {
        if (generatedBackground || knownChromeClass || hasBackgroundImage) {
          setStyle(element, "background-image", "none", "important");
        }
        setStyle(element, "background-color", palette.base, "important");
        tintedPageChrome.add(element);
      }

      const insidePageChrome = isInsideTintedPageChrome(element);
      if (insidePageChrome) {
        setStyle(element, "color", palette.text, "important");
      }

      const surfaceTinted = !hasBackgroundImage
        && isSurfaceTintBackground(background, { pageElement, pageTone: activePageTone });
      if (surfaceTinted && !pageChromeTinted && !insidePageChrome) {
        const surface = element.tagName.toLowerCase() === "pre" && theme === "moon"
          ? palette.overlay
          : palette.surface;
        setStyle(element, "background-color", pageElement ? palette.base : surface);
      }

      if (!insidePageChrome) {
        tintText(element, computedStyle, palette, surfaceTinted);
      }
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

    function applyRootTheme(theme) {
      document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
      setStyle(document.documentElement, "color-scheme", theme === "moon" ? "dark" : "light");
      setStyle(document.documentElement, "scrollbar-color", `${PALETTES[theme].muted} ${PALETTES[theme].base}`);
    }

    function clear() {
      disconnectObserver();
      restoreTintedElements();
      activeMode = null;
      activeTheme = null;
      activePageTone = "mixed";
      document.documentElement.removeAttribute(THEME_ATTRIBUTE);
    }

    function apply(settings) {
      if (!activeTheme) {
        restoreStaleTintedElements();
      }

      const normalized = normalizeSettings(settings);
      const host = hostFromUrl(document.location.href);
      if (!normalized.enabled || isHostDisabled(host, normalized.disabledHosts)) {
        clear();
        return { enabled: false, theme: null, tinted: 0 };
      }

      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const theme = resolveThemeMode(normalized.mode, prefersDark);
      const themeChanged = activeTheme && (activeTheme !== theme || activeMode !== normalized.mode);
      const pageToneStale = activeTheme && !themeChanged && activePageTone === "mixed";
      if (themeChanged || pageToneStale) {
        restoreTintedElements();
      }

      const pageTone = activeTheme && !themeChanged && !pageToneStale
        ? activePageTone
        : detectPageTone();
      activeMode = normalized.mode;
      activeTheme = theme;
      activePageTone = pageTone;
      applyRootTheme(theme);
      scan(document.documentElement, theme);
      observe();
      return { enabled: true, theme, tinted: tintedElements.size };
    }

    function stats() {
      return { mode: activeMode, theme: activeTheme, pageTone: activePageTone, tinted: tintedElements.size };
    }

    return { apply, clear, stats, disconnect: disconnectObserver };
  }

  const api = Object.freeze({
    DEFAULT_SETTINGS,
    PALETTES,
    createEngine,
    classifyPageTone,
    hostFromUrl,
    isDarkNeutralColor,
    isDarkSurfaceColor,
    generatedBackgroundHasDarkSurface,
    isHostDisabled,
    isLightNeutralColor,
    isGeneratedBackgroundImage,
    isNearWhiteColor,
    isPageChromeCandidate,
    isSurfaceTintBackground,
    isTransparentColor,
    luminance,
    normalizeSettings,
    parseColor,
    resolveThemeMode,
    shouldTintTextColor
  });

  global.RosewashCore = api;
})(globalThis);
