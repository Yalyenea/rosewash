(function (global) {
  "use strict";

  const THEME_ATTRIBUTE = "data-rosewash-theme";
  const TINT_ATTRIBUTE = "data-rosewash-tinted";
  const HAD_STYLE_ATTRIBUTE = "data-rosewash-had-style";
  const ORIGINAL_STYLE_ATTRIBUTE = "data-rosewash-original-style";

  // Curated presets aligned with Codex desktop app code themes (Settings →
  // Appearance). Each preset exposes light and/or dark paper tokens only.
  const PRESETS = Object.freeze({
    "rose-pine": Object.freeze({
      id: "rose-pine",
      label: "Rose Pine",
      light: Object.freeze({ base: "#faf4ed", surface: "#fffaf3", overlay: "#f2e9de", muted: "#9893a5", text: "#575279", link: "#286983" }),
      dark: Object.freeze({ base: "#232136", surface: "#2a273f", overlay: "#393552", muted: "#6e6a86", text: "#e0def4", link: "#9ccfd8" })
    }),
    absolutely: Object.freeze({
      id: "absolutely",
      label: "Absolutely",
      light: Object.freeze({ base: "#f9f9f7", surface: "#f4f4f2", overlay: "#ebebe8", muted: "#939391", text: "#2d2d2b", link: "#cc7d5e" }),
      dark: Object.freeze({ base: "#2d2d2b", surface: "#373735", overlay: "#424240", muted: "#b2b2b0", text: "#f9f9f7", link: "#cc7d5e" })
    }),
    ayu: Object.freeze({
      id: "ayu",
      label: "Ayu",
      dark: Object.freeze({ base: "#0b0e14", surface: "#0d1017", overlay: "#11151c", muted: "#6c7380", text: "#bfbdb6", link: "#e6b450" })
    }),
    catppuccin: Object.freeze({
      id: "catppuccin",
      label: "Catppuccin",
      light: Object.freeze({ base: "#eff1f5", surface: "#e6e9ef", overlay: "#ccd0da", muted: "#9ca0b0", text: "#4c4f69", link: "#1e66f5" }),
      dark: Object.freeze({ base: "#1e1e2e", surface: "#313244", overlay: "#45475a", muted: "#6c7086", text: "#cdd6f4", link: "#89b4fa" })
    }),
    codex: Object.freeze({
      id: "codex",
      label: "Codex",
      light: Object.freeze({ base: "#f7f7f7", surface: "#ffffff", overlay: "#ececec", muted: "#666666", text: "#0d0d0d", link: "#0169cc" }),
      dark: Object.freeze({ base: "#111111", surface: "#1a1a1a", overlay: "#262626", muted: "#8f8f8f", text: "#fcfcfc", link: "#3d8dff" })
    }),
    dracula: Object.freeze({
      id: "dracula",
      label: "Dracula",
      dark: Object.freeze({ base: "#282a36", surface: "#21222c", overlay: "#44475a", muted: "#6272a4", text: "#f8f8f2", link: "#8be9fd" })
    }),
    everforest: Object.freeze({
      id: "everforest",
      label: "Everforest",
      light: Object.freeze({ base: "#fdf6e3", surface: "#f4f0d9", overlay: "#efebd4", muted: "#939f91", text: "#5c6a72", link: "#8da101" }),
      dark: Object.freeze({ base: "#2d353b", surface: "#343f44", overlay: "#3d484d", muted: "#859289", text: "#d3c6aa", link: "#a7c080" })
    }),
    github: Object.freeze({
      id: "github",
      label: "GitHub",
      light: Object.freeze({ base: "#ffffff", surface: "#f6f8fa", overlay: "#eaeef2", muted: "#656d76", text: "#1f2328", link: "#0969da" }),
      dark: Object.freeze({ base: "#0d1117", surface: "#161b22", overlay: "#21262d", muted: "#8b949e", text: "#e6edf3", link: "#2f81f7" })
    }),
    gruvbox: Object.freeze({
      id: "gruvbox",
      label: "Gruvbox",
      light: Object.freeze({ base: "#fbf1c7", surface: "#f2e5bc", overlay: "#ebdbb2", muted: "#928374", text: "#3c3836", link: "#076678" }),
      dark: Object.freeze({ base: "#282828", surface: "#3c3836", overlay: "#504945", muted: "#928374", text: "#ebdbb2", link: "#83a598" })
    }),
    linear: Object.freeze({
      id: "linear",
      label: "Linear",
      light: Object.freeze({ base: "#f7f8fa", surface: "#ffffff", overlay: "#eef0f4", muted: "#8a93a6", text: "#2a3140", link: "#5e6ad2" }),
      dark: Object.freeze({ base: "#0f0f11", surface: "#17181d", overlay: "#1c1e26", muted: "#636b7b", text: "#e6e9ef", link: "#5e6ad2" })
    }),
    lobster: Object.freeze({
      id: "lobster",
      label: "Lobster",
      dark: Object.freeze({ base: "#111827", surface: "#1a1d25", overlay: "#1f2937", muted: "#71717a", text: "#e4e4e7", link: "#ff5c5c" })
    }),
    material: Object.freeze({
      id: "material",
      label: "Material",
      dark: Object.freeze({ base: "#212121", surface: "#2a2a2a", overlay: "#353535", muted: "#545454", text: "#eeffff", link: "#80cbc4" })
    }),
    matrix: Object.freeze({
      id: "matrix",
      label: "Matrix",
      dark: Object.freeze({ base: "#040805", surface: "#0a140c", overlay: "#102016", muted: "#3f8f52", text: "#b8ffca", link: "#1eff5a" })
    }),
    monokai: Object.freeze({
      id: "monokai",
      label: "Monokai",
      dark: Object.freeze({ base: "#272822", surface: "#1e1f1c", overlay: "#3e3d32", muted: "#75715e", text: "#f8f8f2", link: "#66d9ef" })
    }),
    "night-owl": Object.freeze({
      id: "night-owl",
      label: "Night Owl",
      dark: Object.freeze({ base: "#011627", surface: "#0b2942", overlay: "#1d3b53", muted: "#637777", text: "#d6deeb", link: "#82aaff" })
    }),
    nord: Object.freeze({
      id: "nord",
      label: "Nord",
      dark: Object.freeze({ base: "#2e3440", surface: "#3b4252", overlay: "#434c5e", muted: "#4c566a", text: "#eceff4", link: "#88c0d0" })
    }),
    notion: Object.freeze({
      id: "notion",
      label: "Notion",
      light: Object.freeze({ base: "#ffffff", surface: "#f7f6f3", overlay: "#f1efe8", muted: "#787774", text: "#37352f", link: "#2383e2" }),
      dark: Object.freeze({ base: "#191919", surface: "#202020", overlay: "#2c2c2c", muted: "#9b9b9b", text: "#d4d4d4", link: "#529cca" })
    }),
    one: Object.freeze({
      id: "one",
      label: "One",
      light: Object.freeze({ base: "#fafafa", surface: "#f0f0f1", overlay: "#e5e5e6", muted: "#a0a1a7", text: "#383a42", link: "#4078f2" }),
      dark: Object.freeze({ base: "#282c34", surface: "#21252b", overlay: "#3e4452", muted: "#5c6370", text: "#abb2bf", link: "#61afef" })
    }),
    oscurange: Object.freeze({
      id: "oscurange",
      label: "Oscurange",
      dark: Object.freeze({ base: "#0b0b0f", surface: "#141419", overlay: "#1c1c22", muted: "#46474f", text: "#e6e6e6", link: "#ff7a18" })
    }),
    proof: Object.freeze({
      id: "proof",
      label: "Proof",
      light: Object.freeze({ base: "#f5f3ed", surface: "#efede6", overlay: "#e5e2d8", muted: "#8b877c", text: "#2f312d", link: "#3d755d" })
    }),
    raycast: Object.freeze({
      id: "raycast",
      label: "Raycast",
      light: Object.freeze({ base: "#ffffff", surface: "#f4f4f5", overlay: "#e4e4e7", muted: "#71717a", text: "#18181b", link: "#ff6363" }),
      dark: Object.freeze({ base: "#141414", surface: "#1c1c1c", overlay: "#272727", muted: "#a1a1aa", text: "#fafafa", link: "#ff6363" })
    }),
    sentry: Object.freeze({
      id: "sentry",
      label: "Sentry",
      dark: Object.freeze({ base: "#2d2935", surface: "#26222d", overlay: "#3a3545", muted: "#8d849f", text: "#e6dff9", link: "#7055f6" })
    }),
    solarized: Object.freeze({
      id: "solarized",
      label: "Solarized",
      light: Object.freeze({ base: "#fdf6e3", surface: "#eee8d5", overlay: "#e4dcc8", muted: "#93a1a1", text: "#657b83", link: "#268bd2" }),
      dark: Object.freeze({ base: "#002b36", surface: "#073642", overlay: "#0a4450", muted: "#586e75", text: "#839496", link: "#268bd2" })
    }),
    temple: Object.freeze({
      id: "temple",
      label: "Temple",
      dark: Object.freeze({ base: "#02120c", surface: "#0c1f14", overlay: "#1d2d0f", muted: "#394d46", text: "#c7e6da", link: "#e4f222" })
    }),
    "tokyo-night": Object.freeze({
      id: "tokyo-night",
      label: "Tokyo Night",
      dark: Object.freeze({ base: "#1a1b26", surface: "#16161e", overlay: "#24283b", muted: "#565f89", text: "#a9b1d6", link: "#7aa2f7" })
    }),
    vercel: Object.freeze({
      id: "vercel",
      label: "Vercel",
      light: Object.freeze({ base: "#fafafa", surface: "#ffffff", overlay: "#eaeaea", muted: "#666666", text: "#171717", link: "#0070f3" }),
      dark: Object.freeze({ base: "#000000", surface: "#0a0a0a", overlay: "#171717", muted: "#888888", text: "#ededed", link: "#0070f3" })
    }),
    "vscode-plus": Object.freeze({
      id: "vscode-plus",
      label: "VS Code Plus",
      light: Object.freeze({ base: "#ffffff", surface: "#f3f3f3", overlay: "#e7e7e7", muted: "#6a6a6a", text: "#000000", link: "#0000ee" }),
      dark: Object.freeze({ base: "#1e1e1e", surface: "#252526", overlay: "#2d2d2d", muted: "#858585", text: "#d4d4d4", link: "#3794ff" })
    }),
    xcode: Object.freeze({
      id: "xcode",
      label: "Xcode",
      light: Object.freeze({ base: "#ffffff", surface: "#f5f5f7", overlay: "#e8e8ed", muted: "#5d6c79", text: "#1d1d1f", link: "#0e0eff" }),
      dark: Object.freeze({ base: "#1f1f24", surface: "#282830", overlay: "#32323c", muted: "#6c7986", text: "#ffffff", link: "#5482ff" })
    })
  });

  const PRESET_IDS = Object.freeze(Object.keys(PRESETS));

  function listPresets(variant) {
    return Object.values(PRESETS)
      .filter((preset) => !variant || preset[variant])
      .sort((a, b) => {
        if (a.id === "rose-pine") {
          return -1;
        }
        if (b.id === "rose-pine") {
          return 1;
        }
        return a.label.localeCompare(b.label);
      });
  }

  const PALETTES = Object.freeze((() => {
    const map = {};
    for (const preset of Object.values(PRESETS)) {
      if (preset.light) {
        map[`${preset.id}-light`] = preset.light;
      }
      if (preset.dark) {
        map[`${preset.id}-dark`] = preset.dark;
      }
    }
    // Legacy theme keys from the pre-preset settings shape.
    map.dawn = map["rose-pine-light"];
    map.moon = map["rose-pine-dark"];
    return Object.freeze(map);
  })());

  const ZHIHU_ARTICLE_WIDTHS = Object.freeze([720, 840, 960, 1080]);

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    presetLight: "rose-pine",
    presetDark: "rose-pine",
    appearance: "auto",
    zhihuArticleLayout: false,
    zhihuArticleWidth: 960,
    disabledHosts: []
  });

  const VALID_APPEARANCES = new Set(["auto", "light", "dark"]);
  const LEGACY_MODE_TO_APPEARANCE = Object.freeze({
    auto: "auto",
    dawn: "light",
    moon: "dark"
  });
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
      if (![red, green, blue].every(Number.isFinite)) {
        return null;
      }
      return { red, green, blue, alpha: 1 };
    }

    if (hex.length === 6) {
      const red = parseInt(hex.slice(0, 2), 16);
      const green = parseInt(hex.slice(2, 4), 16);
      const blue = parseInt(hex.slice(4, 6), 16);
      if (![red, green, blue].every(Number.isFinite)) {
        return null;
      }
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
  function isDarkThemeKey(theme) {
    return theme === "moon" || String(theme).endsWith("-dark");
  }

  const paletteSurfaceColors = new WeakMap();

  function paletteSurfaceTokenFor(color, palette) {
    if (!isOpaqueColor(color)) {
      return null;
    }

    let entries = paletteSurfaceColors.get(palette);
    if (!entries) {
      entries = ["base", "surface", "overlay"].map((role) => [
        palette[role],
        parseColor(palette[role])
      ]);
      paletteSurfaceColors.set(palette, entries);
    }

    const match = entries.find(([, token]) => token
      && Math.abs(color.red - token.red) < 0.5
      && Math.abs(color.green - token.green) < 0.5
      && Math.abs(color.blue - token.blue) < 0.5
      && Math.abs(color.alpha - token.alpha) < 0.001);
    return match ? match[0] : null;
  }

  function surfaceColorFor(color, palette, { pageElement = false, theme = "rose-pine-light", tagName = "" } = {}) {
    if (pageElement) {
      return palette.base;
    }
    if (String(tagName).toLowerCase() === "pre" && isDarkThemeKey(theme)) {
      return palette.overlay;
    }
    if (!isOpaqueColor(color)) {
      return palette.surface;
    }
    const paletteToken = paletteSurfaceTokenFor(color, palette);
    if (paletteToken) {
      return paletteToken;
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

    let appearance = DEFAULT_SETTINGS.appearance;
    if (VALID_APPEARANCES.has(source.appearance)) {
      appearance = source.appearance;
    } else if (LEGACY_MODE_TO_APPEARANCE[source.mode]) {
      // Migrate pre-preset `mode: auto|dawn|moon` storage blobs.
      appearance = LEGACY_MODE_TO_APPEARANCE[source.mode];
    }

    return {
      enabled: source.enabled !== false,
      presetLight: presetIdForVariant(source.presetLight, source.preset, "light"),
      presetDark: presetIdForVariant(source.presetDark, source.preset, "dark"),
      appearance,
      zhihuArticleLayout: source.zhihuArticleLayout === true,
      zhihuArticleWidth: ZHIHU_ARTICLE_WIDTHS.includes(source.zhihuArticleWidth)
        ? source.zhihuArticleWidth
        : DEFAULT_SETTINGS.zhihuArticleWidth,
      disabledHosts: Array.from(new Set(disabledHosts)).sort()
    };
  }

  function isZhihuHost(host) {
    const normalizedHost = normalizeHost(host);
    return normalizedHost === "zhihu.com"
      || normalizedHost === "www.zhihu.com"
      || normalizedHost === "zhuanlan.zhihu.com";
  }

  function isZhihuArticlePath(pathname) {
    return /^\/p\/\d+/.test(String(pathname || ""));
  }

  function presetIdForVariant(value, legacyPreset, variant) {
    if (PRESETS[value] && PRESETS[value][variant]) {
      return value;
    }
    if (PRESETS[legacyPreset] && PRESETS[legacyPreset][variant]) {
      return legacyPreset;
    }
    return variant === "dark" ? DEFAULT_SETTINGS.presetDark : DEFAULT_SETTINGS.presetLight;
  }

  function resolveAppearance(appearance, prefersDark) {
    if (appearance === "light" || appearance === "dark") {
      return appearance;
    }
    return prefersDark ? "dark" : "light";
  }

  function resolveThemeKey(preset, appearance, prefersDark) {
    const presetId = PRESETS[preset] ? preset : DEFAULT_SETTINGS.presetLight;
    const desired = resolveAppearance(appearance, prefersDark);
    const entry = PRESETS[presetId];
    if (entry[desired]) {
      return `${presetId}-${desired}`;
    }
    if (entry.dark) {
      return `${presetId}-dark`;
    }
    return `${presetId}-light`;
  }

  function resolveSettingsThemeKey(settings, prefersDark) {
    const normalized = normalizeSettings(settings);
    const desired = resolveAppearance(normalized.appearance, prefersDark);
    const presetId = desired === "dark" ? normalized.presetDark : normalized.presetLight;
    return `${presetId}-${desired}`;
  }

  // Legacy helper: maps old mode strings onto rose-pine theme keys.
  function resolveThemeMode(mode, prefersDark) {
    if (mode === "dawn" || mode === "moon") {
      return mode === "dawn" ? "rose-pine-light" : "rose-pine-dark";
    }
    if (LEGACY_MODE_TO_APPEARANCE[mode]) {
      return resolveThemeKey("rose-pine", LEGACY_MODE_TO_APPEARANCE[mode], prefersDark);
    }
    if (typeof mode === "object" && mode) {
      return resolveSettingsThemeKey(mode, prefersDark);
    }
    return resolveThemeKey("rose-pine", "auto", prefersDark);
  }

  function applyThemeTokens(root, theme) {
    const palette = PALETTES[theme];
    if (!root || !palette) {
      return null;
    }

    root.setAttribute(THEME_ATTRIBUTE, theme);
    // !important so stylesheet fallbacks in theme.css cannot keep Rose Pine.
    root.style.setProperty("--rosewash-base", palette.base, "important");
    root.style.setProperty("--rosewash-surface", palette.surface, "important");
    root.style.setProperty("--rosewash-overlay", palette.overlay, "important");
    root.style.setProperty("--rosewash-muted", palette.muted, "important");
    root.style.setProperty("--rosewash-text", palette.text, "important");
    root.style.setProperty("--rosewash-link", palette.link, "important");
    return palette;
  }

  function clearThemeTokens(root) {
    if (!root) {
      return;
    }
    root.removeAttribute(THEME_ATTRIBUTE);
    root.style.removeProperty("--rosewash-base");
    root.style.removeProperty("--rosewash-surface");
    root.style.removeProperty("--rosewash-overlay");
    root.style.removeProperty("--rosewash-muted");
    root.style.removeProperty("--rosewash-text");
    root.style.removeProperty("--rosewash-link");
  }

  function plainSettings(settings) {
    const normalized = normalizeSettings(settings);
    return {
      enabled: normalized.enabled,
      presetLight: normalized.presetLight,
      presetDark: normalized.presetDark,
      appearance: normalized.appearance,
      zhihuArticleLayout: normalized.zhihuArticleLayout,
      zhihuArticleWidth: normalized.zhihuArticleWidth,
      disabledHosts: normalized.disabledHosts.slice()
    };
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
  // Exclude utility-contrast (on-accent labels), not Substack background_contrast_*.
  const SURFACE_VAR_EXCLUDE = /text|icon|label|inverted|border|outline|ring|divider|btn-text|msg-text|on-primary|utility-contrast|shadow-color|submit-btn-text|ink|print_on/;
  const SURFACE_VAR_INCLUDE = /main-surface|composer-surface|sidebar-surface|component-sidebar-bg|bg-primary|bg-secondary|bg-elevated|bg-secondary-surface|surface-primary|surface-secondary|surface-tertiary|page-bg|canvas|background-primary|background-secondary|background_contrast|cover_bg|fp-recirc-block-bg|ground|web_bg|theme_bg|color_theme_bg|color-bg|^--bg$|^--background$|^--background-color$/;
  const TEXT_VAR_EXCLUDE = /inverted|on-primary|btn|button|link|brand|accent|success|warning|error|danger|shadow|utility-contrast/;
  const TEXT_VAR_INCLUDE = /(?:^|-)(ink|title-ink|text-primary|text-secondary|text-color|foreground|body-color|color-text|print_on_web|fg-primary|fg-secondary|cover_print_primary)(?:-|$)/;

  // Always force these when present or when any surface token is active.
  // ChatGPT dark may expose unparseable values (display-p3) or re-declare
  // tokens only under .dark — name-based force still paints the footer.
  const FORCED_SURFACE_VARS = Object.freeze([
    ["--main-surface-primary", "base"],
    ["--main-surface-secondary", "surface"],
    ["--main-surface-background", "base"],
    ["--main-surface-tertiary", "overlay"],
    ["--composer-surface-primary", "surface"],
    ["--bg-primary", "base"],
    ["--bg-secondary", "overlay"],
    ["--bg-secondary-surface", "surface"],
    ["--bg-elevated-primary", "surface"],
    ["--sidebar-surface-primary", "base"],
    ["--sidebar-surface-secondary", "surface"],
    ["--sidebar-surface-tertiary", "overlay"],
    ["--component-sidebar-bg", "base"],
    // Substack publication shells (light pubs keep pure white without these).
    ["--color-bg-primary", "base"],
    ["--color-bg-secondary", "surface"],
    ["--color-bg-elevated-primary", "surface"],
    ["--color-bg-elevated-secondary", "overlay"],
    ["--web_bg_color", "base"],
    ["--color_theme_bg_web", "base"],
    ["--background_contrast_1", "surface"],
    ["--background_contrast_2", "overlay"],
    ["--cover_bg_color", "base"],
    ["--cover_bg_color_secondary", "surface"]
  ]);

  function paletteColorForSurfaceRole(palette, role) {
    if (role === "surface") {
      return palette.surface;
    }
    if (role === "overlay") {
      return palette.overlay;
    }
    return palette.base;
  }

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

    if (/(secondary|elevated|composer|tertiary|overlay|contrast|recirc)/.test(normalized)) {
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
    const overrides = new Map();
    let sawSurfaceToken = false;

    for (const [name, value] of entries) {
      const color = parseColor(value);
      const surfaceRole = classifySurfaceCssVar(name, color);
      if (surfaceRole) {
        sawSurfaceToken = true;
        overrides.set(name, paletteColorForSurfaceRole(palette, surfaceRole));
        continue;
      }
      if (classifyTextCssVar(name, color)) {
        overrides.set(name, palette.text);
        continue;
      }
      // Unparseable but known surface name (e.g. color(display-p3 …)).
      const forced = FORCED_SURFACE_VARS.find(([token]) => token === name);
      if (forced) {
        sawSurfaceToken = true;
        overrides.set(name, paletteColorForSurfaceRole(palette, forced[1]));
      }
    }

    // When any ChatGPT-style surface token is on the page, force the full
    // known set so dark .dark re-declarations cannot leave a native strip.
    if (sawSurfaceToken) {
      for (const [name, role] of FORCED_SURFACE_VARS) {
        if (!overrides.has(name)) {
          overrides.set(name, paletteColorForSurfaceRole(palette, role));
        }
      }
    }

    return Array.from(overrides.entries());
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
    let activePresetLight = null;
    let activePresetDark = null;
    let activeAppearance = null;
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
      // Full-cover uses !important so SPA/CSS-in-JS layers cannot flash
      // their original white between React commits.
      const nextPriority = priority || "important";
      if (
        element.style.getPropertyValue(property) === value
        && element.style.getPropertyPriority(property) === nextPriority
        && element.getAttribute(TINT_ATTRIBUTE) === activeTheme
      ) {
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
    // nodes cover before the next paint when possible.
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
        // ChatGPT (and similar) dark themes set surface tokens with
        // !important on .dark; non-important inline loses that cascade.
        if (
          root.style.getPropertyValue(name) !== value
          || root.style.getPropertyPriority(name) !== "important"
        ) {
          root.style.setProperty(name, value, "important");
        }
      }
    }

    function applyRootTheme(theme) {
      const palette = applyThemeTokens(document.documentElement, theme);
      setStyle(
        document.documentElement,
        "color-scheme",
        isDarkThemeKey(theme) ? "dark" : "light"
      );
      setStyle(document.documentElement, "scrollbar-color", `${palette.muted} ${palette.base}`);
      applyCssVarSurfaces(theme);
      return palette;
    }

    function clear() {
      disconnectObserver();
      restoreTintedElements();
      restoreCssVarOverrides();
      activePresetLight = null;
      activePresetDark = null;
      activeAppearance = null;
      activeTheme = null;
      activePageTone = "mixed";
      clearThemeTokens(document.documentElement);
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
      const theme = resolveSettingsThemeKey(normalized, prefersDark);
      const nextPalette = PALETTES[theme];
      const currentBase = document.documentElement.style.getPropertyValue("--rosewash-base").trim();
      const themeChanged = Boolean(
        activeTheme
        && (
          activeTheme !== theme
          || activePresetLight !== normalized.presetLight
          || activePresetDark !== normalized.presetDark
          || activeAppearance !== normalized.appearance
          || (nextPalette && currentBase && currentBase !== nextPalette.base)
        )
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
      activePresetLight = normalized.presetLight;
      activePresetDark = normalized.presetDark;
      activeAppearance = normalized.appearance;
      activeTheme = theme;
      activePageTone = pageTone;
      applyRootTheme(theme);
      // Always rescan on apply so preset switches repaint even if some nodes
      // were only covered via CSS variables on the first pass.
      scan(document.documentElement, theme);
      observe();
      return {
        enabled: true,
        theme,
        presetLight: normalized.presetLight,
        presetDark: normalized.presetDark,
        appearance: normalized.appearance,
        tinted: tintedElements.size
      };
    }

    function stats() {
      return {
        presetLight: activePresetLight,
        presetDark: activePresetDark,
        appearance: activeAppearance,
        theme: activeTheme,
        pageTone: activePageTone,
        tinted: tintedElements.size
      };
    }

    return { apply, clear, stats, disconnect: disconnectObserver };
  }

  const api = Object.freeze({
    DEFAULT_SETTINGS,
    PRESETS,
    PRESET_IDS,
    PALETTES,
    ZHIHU_ARTICLE_WIDTHS,
    listPresets,
    createEngine,
    classifyPageTone,
    hostFromUrl,
    isDarkNeutralColor,
    isDarkSurfaceColor,
    isDarkThemeKey,
    generatedBackgroundHasDarkSurface,
    isHostDisabled,
    isZhihuHost,
    isZhihuArticlePath,
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
    FORCED_SURFACE_VARS,
    surfaceColorFor,
    luminance,
    normalizeSettings,
    plainSettings,
    parseColor,
    readRootThemeSamples,
    resolveAppearance,
    resolveThemeKey,
    resolveSettingsThemeKey,
    resolveThemeMode,
    applyThemeTokens,
    clearThemeTokens,
    shouldTintTextColor
  });

  global.RosewashCore = api;
})(globalThis);
