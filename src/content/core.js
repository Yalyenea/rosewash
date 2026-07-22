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

    if (hex.length === 8) {
      const red = parseInt(hex.slice(0, 2), 16);
      const green = parseInt(hex.slice(2, 4), 16);
      const blue = parseInt(hex.slice(4, 6), 16);
      const alpha = parseInt(hex.slice(6, 8), 16) / 255;
      if (![red, green, blue, alpha].every(Number.isFinite)) {
        return null;
      }
      return { red, green, blue, alpha };
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
      && luminance(color) >= 235
      && channelSpread(color) <= 22;
  }

  function isOpaqueColor(color) {
    return Boolean(color) && color.alpha > 0.05;
  }

  // Full cover: any painted surface, plus the default transparent document
  // canvas on html/body (legacy pages that never set a background).
  function isCoverSurfaceBackground(color, { pageElement = false } = {}) {
    if (isOpaqueColor(color)) {
      return true;
    }
    return pageElement && isTransparentColor(color);
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

  // Preserve a little hierarchy: page root → base, elevated mids → overlay,
  // everything else → surface. Media/code stay protected by SKIP_SELECTOR.
  function surfaceColorFor(color, palette, { pageElement = false, theme = "dawn", tagName = "" } = {}) {
    if (pageElement) {
      return palette.base;
    }
    if (String(tagName).toLowerCase() === "pre" && theme === "moon") {
      return palette.overlay;
    }
    if (!isOpaqueColor(color)) {
      return palette.surface;
    }
    const level = luminance(color);
    if (level >= 90 && level < 200) {
      return palette.overlay;
    }
    return palette.surface;
  }

  function isCoverBorderColor(color) {
    return isOpaqueColor(color) && channelSpread(color) <= 100;
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

    if (lightSurfaces > 0) {
      return "light-page";
    }

    // Branded dark sites (e.g. Substack publication themes) often expose a
    // single dark root plus light text, or an explicit dark theme flag, without
    // prefers-color-scheme wiring or a second dark layout sample.
    if (darkSurfaces >= 1 && darkSignals >= 1) {
      return "dark-only";
    }

    if (darkSurfaces >= 1 && lightText >= 1) {
      return "dark-only";
    }

    return "mixed";
  }

  const TONE_SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "LINK",
    "META",
    "NOSCRIPT",
    "TEMPLATE",
    "BR",
    "HR",
    "SOURCE",
    "TRACK"
  ]);

  function isToneSampleElement(element) {
    return isElementNode(element) && !TONE_SKIP_TAGS.has(element.tagName);
  }

  function readRootThemeSamples(window, document) {
    const samples = [];
    const rootStyle = window.getComputedStyle(document.documentElement);
    if (!rootStyle || typeof rootStyle.getPropertyValue !== "function") {
      return samples;
    }

    const darkFlag = String(rootStyle.getPropertyValue("--theme_bg_is_dark") || "")
      .trim()
      .toLowerCase();
    if (darkFlag === "1" || darkFlag === "true") {
      samples.push({
        backgroundColor: "rgba(0, 0, 0, 0)",
        color: "rgb(0, 0, 0)",
        darkSignal: true
      });
    }

    for (const property of [
      "--web_bg_color",
      "--color_theme_bg_web",
      "--background",
      "--bg",
      "--color-bg",
      "--background-color"
    ]) {
      const value = String(rootStyle.getPropertyValue(property) || "").trim();
      if (!value) {
        continue;
      }
      samples.push({
        backgroundColor: value,
        color: "rgb(0, 0, 0)",
        darkSignal: false
      });
    }

    return samples;
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

  function toggleHostDisabled(host, disabledHosts) {
    const normalizedHost = normalizeHost(host);
    const current = Array.isArray(disabledHosts)
      ? disabledHosts.map(normalizeHost).filter(Boolean)
      : [];

    if (!normalizedHost) {
      return Array.from(new Set(current)).sort();
    }

    const next = current.filter((entry) => !isHostDisabled(normalizedHost, [entry]));
    if (next.length === current.length) {
      next.push(normalizedHost);
    }

    return Array.from(new Set(next)).sort();
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

  // Full cover remaps any non-transparent text into the active palette.
  function shouldTintTextColor(_theme, color, _surfaceTinted) {
    return isOpaqueColor(color);
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

  // Design-system tokens often paint ::before/::after. Inline element styles
  // cannot reach pseudo-elements, so root custom properties must move too.
  const SURFACE_VAR_EXCLUDE = /text|icon|label|inverted|border|outline|ring|divider|btn-text|msg-text|on-primary|contrast|shadow-color|submit-btn-text|ink|print_on/;
  const SURFACE_VAR_INCLUDE = /main-surface|composer-surface|sidebar-surface|component-sidebar-bg|bg-primary|bg-secondary|bg-elevated|bg-secondary-surface|surface-primary|surface-secondary|surface-tertiary|page-bg|canvas|background-primary|background-secondary|ground|web_bg|theme_bg|color_theme_bg|color-bg|^--bg$|^--background$|^--background-color$/;
  const TEXT_VAR_EXCLUDE = /inverted|on-primary|btn|button|link|brand|accent|success|warning|error|danger|shadow/;
  const TEXT_VAR_INCLUDE = /(?:^|-)(ink|title-ink|text-primary|text-secondary|text-color|foreground|body-color|color-text|print_on_web)(?:-|$)/;

  function classifySurfaceCssVar(name, color) {
    if (!name || !name.startsWith("--")) {
      return null;
    }
    if (!isOpaqueColor(color) || color.alpha < 0.9) {
      return null;
    }

    const normalized = name.toLowerCase();
    if (SURFACE_VAR_EXCLUDE.test(normalized)) {
      return null;
    }
    if (!SURFACE_VAR_INCLUDE.test(normalized)) {
      return null;
    }

    if (/(secondary|elevated|composer|tertiary|overlay)/.test(normalized)) {
      return "surface";
    }
    return "base";
  }

  function classifyTextCssVar(name, color) {
    if (!name || !name.startsWith("--")) {
      return null;
    }
    if (!isOpaqueColor(color) || color.alpha < 0.5) {
      return null;
    }

    const normalized = name.toLowerCase();
    if (TEXT_VAR_EXCLUDE.test(normalized)) {
      return null;
    }
    if (!TEXT_VAR_INCLUDE.test(normalized)) {
      return null;
    }
    return "text";
  }

  function listRootCssCustomProperties(window, document) {
    const root = document.documentElement;
    if (!root || !window.getComputedStyle) {
      return [];
    }

    const styles = window.getComputedStyle(root);
    const entries = [];
    for (let index = 0; index < styles.length; index += 1) {
      const name = styles[index];
      if (!name || !name.startsWith("--")) {
        continue;
      }
      const value = String(styles.getPropertyValue(name) || "").trim();
      if (value) {
        entries.push([name, value]);
      }
    }
    return entries;
  }

  function resolveSurfaceCssVarOverrides(entries, palette) {
    const overrides = [];
    for (const [name, value] of entries) {
      const color = parseColor(value);
      const surfaceRole = classifySurfaceCssVar(name, color);
      if (surfaceRole) {
        overrides.push([name, surfaceRole === "surface" ? palette.surface : palette.base]);
        continue;
      }
      if (classifyTextCssVar(name, color)) {
        overrides.push([name, palette.text]);
      }
    }
    return overrides;
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
    // name -> previous inline value (null if unset)
    let cssVarOverrides = new Map();
    let observer = null;
    let pendingRoots = new Set();
    let pendingFrame = null;
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
      // Full-cover uses !important so SPA/CSS-in-JS layers (x.com) cannot
      // flash their original white between React commits.
      const nextPriority = priority || "important";
      if (
        element.style.getPropertyValue(property) === value
        && element.style.getPropertyPriority(property) === nextPriority
      ) {
        element.setAttribute(TINT_ATTRIBUTE, activeTheme);
        return;
      }
      element.style.setProperty(property, value, nextPriority);
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
        if (isCoverBorderColor(parseColor(value))) {
          setStyle(element, property, palette.overlay);
        }
      }
    }

    function tintText(element, computedStyle, palette) {
      const color = parseColor(computedStyle.color);
      if (!shouldTintTextColor(activeTheme, color, true)) {
        return;
      }
      if (element.tagName === "A") {
        setStyle(element, "color", palette.link);
        return;
      }
      setStyle(element, "color", palette.text);
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

    function detectPageTone() {
      const bodyChildren = document.body
        ? Array.from(document.body.children).filter(isToneSampleElement)
        : [];
      const candidates = [
        document.documentElement,
        document.body,
        document.querySelector("#root"),
        document.querySelector("#entry"),
        document.querySelector("#main"),
        document.querySelector(".main"),
        document.querySelector("[class*='use-theme-bg']"),
        ...bodyChildren,
        ...document.querySelectorAll("#root > *, #entry > *, #main, .main"),
        ...document.querySelectorAll("main, article, section, header, footer, nav, aside")
      ].filter(isToneSampleElement);

      const uniqueCandidates = Array.from(new Set(candidates)).slice(0, 48);
      const elementSamples = uniqueCandidates.map((element) => {
        const computedStyle = window.getComputedStyle(element);
        return {
          backgroundColor: computedStyle.backgroundColor,
          color: computedStyle.color,
          darkSignal: element.classList.contains("dark")
            || computedStyle.colorScheme.split(/\s+/).includes("dark")
        };
      });

      return classifyPageTone([
        ...readRootThemeSamples(window, document),
        ...elementSamples
      ]);
    }

    function processElement(element, theme) {
      if (shouldSkipElement(element)) {
        return;
      }

      const palette = PALETTES[theme];
      const computedStyle = window.getComputedStyle(element);
      const background = parseColor(computedStyle.backgroundColor);
      const hasBackgroundImage = computedStyle.backgroundImage && computedStyle.backgroundImage !== "none";
      const generatedBackground = isGeneratedBackgroundImage(computedStyle.backgroundImage);
      const pageElement = isPageElement(element, document);

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

      // Full cover: every opaque painted box becomes Rose Pine. Gradient-only
      // fills are flattened; url()/media backgrounds stay untouched.
      const coverSurface = !pageChromeTinted
        && (!hasBackgroundImage || generatedBackground)
        && (isCoverSurfaceBackground(background, { pageElement }) || generatedBackground);
      if (coverSurface) {
        if (generatedBackground) {
          setStyle(element, "background-image", "none");
        }
        setStyle(
          element,
          "background-color",
          surfaceColorFor(background, palette, {
            pageElement,
            theme,
            tagName: element.tagName
          })
        );
      }

      if (!insidePageChrome) {
        tintText(element, computedStyle, palette);
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
      pendingFrame = null;
      if (!activeTheme) {
        pendingRoots = new Set();
        return;
      }

      const roots = pendingRoots;
      pendingRoots = new Set();
      for (const root of roots) {
        if (isElementNode(root) && root.isConnected !== false) {
          scan(root, activeTheme);
        }
      }
    }

    // Coalesce SPA mutations to the next frame — not 250ms — so new white
    // nodes (e.g. x.com post views) cover before the next paint when possible.
    function scheduleScan(root) {
      pendingRoots.add(root);
      if (pendingFrame !== null) {
        return;
      }

      if (typeof window.requestAnimationFrame === "function") {
        pendingFrame = window.requestAnimationFrame(flushPending);
      } else {
        pendingFrame = window.setTimeout(flushPending, 0);
      }
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
      if (pendingFrame !== null) {
        if (typeof window.cancelAnimationFrame === "function") {
          window.cancelAnimationFrame(pendingFrame);
        }
        window.clearTimeout(pendingFrame);
        pendingFrame = null;
      }
      pendingRoots = new Set();
    }

    function restoreCssVarOverrides() {
      const root = document.documentElement;
      for (const [name, previous] of cssVarOverrides) {
        if (previous === null || previous === "") {
          root.style.removeProperty(name);
        } else {
          root.style.setProperty(name, previous);
        }
      }
      cssVarOverrides = new Map();
    }

    // Diff against current overrides so re-apply does not tear tokens off
    // (which flashed the underlying site colors between load handlers).
    function applyCssVarSurfaces(theme) {
      const palette = PALETTES[theme];
      const root = document.documentElement;
      const nextEntries = resolveSurfaceCssVarOverrides(
        listRootCssCustomProperties(window, document),
        palette
      );
      const next = new Map(nextEntries);

      for (const [name, previous] of cssVarOverrides) {
        if (next.has(name)) {
          continue;
        }
        if (previous === null || previous === "") {
          root.style.removeProperty(name);
        } else {
          root.style.setProperty(name, previous);
        }
        cssVarOverrides.delete(name);
      }

      for (const [name, value] of next) {
        if (!cssVarOverrides.has(name)) {
          const previous = root.style.getPropertyValue(name);
          cssVarOverrides.set(name, previous || null);
        }
        if (root.style.getPropertyValue(name) !== value) {
          root.style.setProperty(name, value);
        }
      }
    }

    function applyRootTheme(theme) {
      document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
      setStyle(document.documentElement, "color-scheme", theme === "moon" ? "dark" : "light");
      setStyle(document.documentElement, "scrollbar-color", `${PALETTES[theme].muted} ${PALETTES[theme].base}`);
      applyCssVarSurfaces(theme);
    }

    function clear() {
      disconnectObserver();
      restoreTintedElements();
      restoreCssVarOverrides();
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
      const themeChanged = Boolean(
        activeTheme && (activeTheme !== theme || activeMode !== normalized.mode)
      );
      // Full-cover no longer depends on pageTone for surface decisions. Only
      // restore when the resolved palette actually changes — never on mixed
      // re-detect (that path flashed the whole page white on every load).
      if (themeChanged) {
        restoreTintedElements();
        restoreCssVarOverrides();
      }

      const pageTone = !activeTheme || themeChanged || activePageTone === "mixed"
        ? detectPageTone()
        : activePageTone;
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
    toggleHostDisabled,
    isLightNeutralColor,
    isGeneratedBackgroundImage,
    isNearWhiteColor,
    isOpaqueColor,
    isPageChromeCandidate,
    isCoverSurfaceBackground,
    isCoverBorderColor,
    isToneSampleElement,
    isTransparentColor,
    classifySurfaceCssVar,
    classifyTextCssVar,
    listRootCssCustomProperties,
    resolveSurfaceCssVarOverrides,
    surfaceColorFor,
    luminance,
    normalizeSettings,
    parseColor,
    readRootThemeSamples,
    resolveThemeMode,
    shouldTintTextColor
  });

  global.RosewashCore = api;
})(globalThis);
