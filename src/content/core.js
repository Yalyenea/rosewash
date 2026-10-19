(function (global) {
  "use strict";

  const THEME_ATTRIBUTE = "data-rosewash-theme";
  const TINT_ATTRIBUTE = "data-rosewash-tinted";
  const DIM_ATTRIBUTE = "data-rosewash-dim";
  const STYLE_OVERRIDES_ATTRIBUTE = "data-rosewash-style-overrides";
  const HAD_STYLE_ATTRIBUTE = "data-rosewash-had-style";
  const ORIGINAL_STYLE_ATTRIBUTE = "data-rosewash-original-style";

  // Curated presets aligned with Codex desktop app code themes (Settings →
  // Appearance). Each preset exposes light and/or dark paper tokens only.
  const PRESETS = Object.freeze({
    // Plain palette tokens preview the extension UI; pages keep their colors.
    light: Object.freeze({
      id: "light",
      label: "Light",
      light: Object.freeze({ tint: false, base: "#ffffff", surface: "#f7f7f7", overlay: "#eeeeee", muted: "#777777", text: "#171717", link: "#0066cc" })
    }),
    dark: Object.freeze({
      id: "dark",
      label: "Dark",
      dark: Object.freeze({ tint: false, base: "#171717", surface: "#222222", overlay: "#303030", muted: "#999999", text: "#eeeeee", link: "#66aaff" })
    }),
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
        const aPlain = a.light?.tint === false || a.dark?.tint === false;
        const bPlain = b.light?.tint === false || b.dark?.tint === false;
        if (aPlain !== bPlain) {
          return aPlain ? -1 : 1;
        }
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

  const X_SINGLE_COLUMN_WIDTHS = Object.freeze([520, 600, 680, 760]);
  const ZHIHU_ARTICLE_WIDTHS = Object.freeze([720, 840, 960, 1080]);
  const IMAGE_BRIGHTNESS_LEVELS = Object.freeze([70, 80, 90]);
  const MAX_IGNORED_SELECTOR_LENGTH = 300;

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    defaultEnabled: true,
    customFontsEnabled: false,
    fontEnglish: "",
    fontChinese: "",
    fontMath: "",
    fontMonospace: "",
    presetLight: "rose-pine",
    presetDark: "rose-pine",
    appearance: "auto",
    xCompactLayout: false,
    xSingleColumnWidth: 600,
    zhihuArticleLayout: false,
    zhihuArticleWidth: 960,
    dimImages: false,
    imageBrightness: 80,
    disabledHosts: [],
    enabledHosts: [],
    ignoredElements: Object.freeze({})
  });

  const VALID_APPEARANCES = new Set(["auto", "light", "dark"]);
  const LEGACY_MODE_TO_APPEARANCE = Object.freeze({
    auto: "auto",
    dawn: "light",
    moon: "dark"
  });
  // Scan slices: elements read per batch and time spent per frame.
  const SCAN_BATCH_SIZE = 1000;
  const SCAN_BUDGET_MS = 8;
  const OBSERVER_OPTIONS = Object.freeze({
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ["class"]
  });
  // Declarations that can change colors, borders, or fonts read by the engine.
  const STYLE_RULE_PROPERTY = /^(?:--|all$|color$|background|border|font|-webkit-text-fill-color$|-webkit-background-clip$)/;

  const SKIP_SELECTOR = [
    "img",
    "picture",
    "video",
    "canvas",
    "math",
    "mjx-container",
    "svg",
    "iframe",
    "embed",
    "object",
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
  const FONT_SKIP_SELECTOR = "[data-rosewash-ignore], [role='img'], svg, .katex, .MathJax, mjx-container, .CodeMirror, .cm-editor, .monaco-editor, [contenteditable]";

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
    // color-mix(in srgb, ...) and relative RGB colors serialize as color(srgb ...).
    const srgb = value.match(/^color\(srgb\s+([^()]+)\)$/);
    if (srgb) {
      const [body, alphaBody, extra] = srgb[1].split("/");
      const parts = body.trim().split(/\s+/);
      const component = /^(?:none|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?%?)$/;
      const alphaValue = alphaBody?.trim();
      if (extra !== undefined || parts.length !== 3
        || !parts.every((part) => component.test(part))
        || (alphaValue !== undefined && !component.test(alphaValue))) {
        return null;
      }
      const channels = parts.map((part) => part === "none" ? 0
        : clamp255((parseFloat(part) / (part.endsWith("%") ? 100 : 1)) * 255));
      return {
        red: channels[0],
        green: channels[1],
        blue: channels[2],
        alpha: alphaValue === "none" ? 0 : parseColorAlpha(alphaValue)
      };
    }

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
  // everything else → surface. Nearby fills that still read as one paper are
  // collapsed later, against the painted ancestor. Media/code stay protected
  // by SKIP_SELECTOR.
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

  // Same sheet of paper: channel moves of about 12 still look like one fill
  // (white vs off-white). A real card or chip steps further than that.
  const PAPER_CHANNEL_DELTA = 12;

  function colorsSharePaper(a, b) {
    if (!isOpaqueColor(a) || !isOpaqueColor(b)) {
      return false;
    }
    if (Math.abs(a.alpha - b.alpha) > 0.15) {
      return false;
    }
    const maxDelta = Math.max(
      Math.abs(a.red - b.red),
      Math.abs(a.green - b.green),
      Math.abs(a.blue - b.blue)
    );
    return maxDelta <= PAPER_CHANNEL_DELTA
      && Math.abs(luminance(a) - luminance(b)) <= PAPER_CHANNEL_DELTA;
  }

  // Width is only trustworthy when the style actually strokes. Writing a
  // border color into the style attribute is enough for some sites (WordPress
  // global styles) to force border-style: solid and reveal a latent width.
  function isPaintedBorder(width, style) {
    const size = Number.parseFloat(width);
    if (!Number.isFinite(size) || size <= 0) {
      return false;
    }
    const normalized = String(style || "").toLowerCase();
    return normalized !== "" && normalized !== "none" && normalized !== "hidden";
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

  // Embedded frames follow the tab's top-level site rule.
  function policyHostForLocation(location) {
    const origins = location.ancestorOrigins;
    return hostFromUrl(origins?.length ? origins[origins.length - 1] : location.href);
  }

  function browserKind() {
    if (globalThis.chrome?.runtime?.getURL("").startsWith("moz-extension://")) return "firefox";
    return /Edg\//.test(globalThis.navigator?.userAgent || "") ? "edge" : "chrome";
  }

  function pageRestrictionForUrl(value, browser = browserKind()) {
    try {
      const url = new URL(value);
      if (!["http:", "https:", "file:"].includes(url.protocol)) {
        return "unsupported";
      }
      // Store and account restrictions differ by browser.
      const host = url.hostname.replace(/\.$/, "");
      if (browser === "firefox") {
        return isHostDisabled(host, [
          "accounts-static.cdn.mozilla.net", "accounts.firefox.com",
          "addons.cdn.mozilla.net", "addons.mozilla.org", "api.accounts.firefox.com",
          "content.cdn.mozilla.net", "discovery.addons.mozilla.org", "install.mozilla.org",
          "oauth.accounts.firefox.com", "profile.accounts.firefox.com",
          "support.mozilla.org", "sync.services.mozilla.com"
        ]) ? "restricted" : "";
      }
      if (browser === "edge" && host === "microsoftedge.microsoft.com"
        && /^\/addons(?:\/|$)/.test(url.pathname)) return "webstore";
      if (isHostDisabled(host, ["chrome.google.com", "chromewebstore.google.com"])) {
        return "webstore";
      }
      return "";
    } catch {
      return "unsupported";
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

  function isHostEnabled(host, settings) {
    const normalized = normalizeSettings(settings);
    const specificity = (hosts) => hosts.reduce((length, entry) =>
      isHostDisabled(host, [entry]) ? Math.max(length, entry.length) : length, 0);
    const allowed = specificity(normalized.enabledHosts);
    const blocked = specificity(normalized.disabledHosts);
    return allowed || blocked ? allowed > blocked : normalized.defaultEnabled;
  }

  function hostPolicyForHost(host, settings) {
    const normalizedHost = normalizeHost(host);
    const normalized = normalizeSettings(settings);
    if (normalized.disabledHosts.includes(normalizedHost)) return "off";
    if (normalized.enabledHosts.includes(normalizedHost)) return "on";
    return "default";
  }

  function setHostPolicy(host, policy, settings) {
    if (!["default", "on", "off"].includes(policy)) {
      throw new RangeError(`Unknown site policy: ${policy}`);
    }
    const normalizedHost = normalizeHost(host);
    const next = plainSettings(settings);
    if (!normalizedHost) return next;
    next.enabledHosts = next.enabledHosts.filter((entry) => entry !== normalizedHost);
    next.disabledHosts = next.disabledHosts.filter((entry) => entry !== normalizedHost);
    if (policy !== "default") {
      const hosts = policy === "on" ? next.enabledHosts : next.disabledHosts;
      hosts.push(normalizedHost);
      hosts.sort();
    }
    return next;
  }

  function toggleHostEnabled(host, settings) {
    return setHostPolicy(host, isHostEnabled(host, settings) ? "off" : "on", settings);
  }

  function normalizeFontName(value) {
    return typeof value === "string" ? value.replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 100) : "";
  }

  function fontDefinitions(settings) {
    if (!settings.customFontsEnabled) return [];
    return [
      ["RosewashEnglish", settings.fontEnglish, "U+0000-024F,U+1E00-1EFF,U+2000-206F"],
      ["RosewashChinese", settings.fontChinese, "U+2E80-2FFF,U+3000-303F,U+3100-312F,U+31A0-31BF,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FE10-FE1F,U+FE30-FE4F,U+FF00-FFEF,U+20000-323AF"],
      ["RosewashMath", settings.fontMath, "U+0000-10FFFF"],
      ["RosewashMonospace", settings.fontMonospace, "U+0000-10FFFF"]
    ].filter(([, name]) => name);
  }

  function cssFontSource(name) {
    // fontSettings lists families; local() requires a full face or PostScript name.
    const names = [name, `${name} Regular`, `${name.replace(/\s/g, "")}-Regular`];
    return Array.from(new Set(names)).map((value) =>
      'local("' + value.replace(/["\\]/g, (character) => "\\" + character) + '")'
    ).join(", ");
  }

  function createFontFaces(settings, window) {
    return fontDefinitions(normalizeSettings(settings)).map(([family, name, unicodeRange]) =>
      new window.FontFace(family, cssFontSource(name), { unicodeRange })
    );
  }

  function normalizeSettings(settings) {
    const source = settings && typeof settings === "object" ? settings : {};
    const disabledHosts = Array.isArray(source.disabledHosts)
      ? source.disabledHosts.map(normalizeHost).filter(Boolean)
      : [];
    const enabledHosts = Array.isArray(source.enabledHosts)
      ? source.enabledHosts.map(normalizeHost).filter(Boolean)
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
      defaultEnabled: source.defaultEnabled !== false,
      customFontsEnabled: source.customFontsEnabled === true,
      fontEnglish: normalizeFontName(source.fontEnglish),
      fontChinese: normalizeFontName(source.fontChinese),
      fontMath: normalizeFontName(source.fontMath),
      fontMonospace: normalizeFontName(source.fontMonospace),
      presetLight: presetIdForVariant(source.presetLight, source.preset, "light"),
      presetDark: presetIdForVariant(source.presetDark, source.preset, "dark"),
      appearance,
      xCompactLayout: source.xCompactLayout === true,
      xSingleColumnWidth: X_SINGLE_COLUMN_WIDTHS.includes(source.xSingleColumnWidth)
        ? source.xSingleColumnWidth
        : DEFAULT_SETTINGS.xSingleColumnWidth,
      zhihuArticleLayout: source.zhihuArticleLayout === true,
      zhihuArticleWidth: ZHIHU_ARTICLE_WIDTHS.includes(source.zhihuArticleWidth)
        ? source.zhihuArticleWidth
        : DEFAULT_SETTINGS.zhihuArticleWidth,
      dimImages: source.dimImages === true,
      imageBrightness: IMAGE_BRIGHTNESS_LEVELS.includes(source.imageBrightness)
        ? source.imageBrightness
        : DEFAULT_SETTINGS.imageBrightness,
      disabledHosts: Array.from(new Set(disabledHosts)).sort(),
      enabledHosts: Array.from(new Set(enabledHosts)).sort(),
      ignoredElements: normalizeIgnoredElements(source.ignoredElements)
    };
  }

  function normalizeSelector(value) {
    const selector = String(value || "").trim();
    return selector.length <= MAX_IGNORED_SELECTOR_LENGTH ? selector : "";
  }

  // { host: [selector] } with sorted hosts and selectors; empty hosts dropped.
  function normalizeIgnoredElements(value) {
    const result = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return result;
    for (const [rawHost, selectors] of Object.entries(value)) {
      const host = normalizeHost(rawHost);
      if (!host || !Array.isArray(selectors)) continue;
      const list = selectors.map(normalizeSelector).filter(Boolean);
      result[host] = Array.from(new Set([...(result[host] || []), ...list])).sort();
      if (!result[host].length) delete result[host];
    }
    return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
  }

  function ignoredSelectorsForHost(host, settings) {
    return normalizeSettings(settings).ignoredElements[normalizeHost(host)] || [];
  }

  function addIgnoredSelector(host, selector, settings) {
    const next = plainSettings(settings);
    const key = normalizeHost(host);
    next.ignoredElements[key] = [...(next.ignoredElements[key] || []), selector];
    return plainSettings(next);
  }

  function clearIgnoredSelectors(host, settings) {
    const next = plainSettings(settings);
    delete next.ignoredElements[normalizeHost(host)];
    return next;
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
    if (palette.tint === false) {
      clearThemeTokens(root);
      return palette;
    }

    if (root.getAttribute(THEME_ATTRIBUTE) !== theme) root.setAttribute(THEME_ATTRIBUTE, theme);
    // !important so stylesheet fallbacks in theme.css cannot keep Rose Pine.
    for (const token of ["base", "surface", "overlay", "muted", "text", "link"]) {
      const name = `--rosewash-${token}`;
      if (root.style.getPropertyValue(name) !== palette[token]
        || root.style.getPropertyPriority(name) !== "important") {
        root.style.setProperty(name, palette[token], "important");
      }
    }
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
      defaultEnabled: normalized.defaultEnabled,
      customFontsEnabled: normalized.customFontsEnabled,
      fontEnglish: normalized.fontEnglish,
      fontChinese: normalized.fontChinese,
      fontMath: normalized.fontMath,
      fontMonospace: normalized.fontMonospace,
      presetLight: normalized.presetLight,
      presetDark: normalized.presetDark,
      appearance: normalized.appearance,
      xCompactLayout: normalized.xCompactLayout,
      xSingleColumnWidth: normalized.xSingleColumnWidth,
      zhihuArticleLayout: normalized.zhihuArticleLayout,
      zhihuArticleWidth: normalized.zhihuArticleWidth,
      dimImages: normalized.dimImages,
      imageBrightness: normalized.imageBrightness,
      disabledHosts: normalized.disabledHosts.slice(),
      enabledHosts: normalized.enabledHosts.slice(),
      ignoredElements: Object.fromEntries(
        Object.entries(normalized.ignoredElements).map(([host, selectors]) => [host, selectors.slice()])
      )
    };
  }

  function mergeSettingsEdits(latest, baseline, edited) {
    const result = plainSettings(latest);
    const before = plainSettings(baseline);
    const next = plainSettings(edited);
    const addedHosts = new Set();
    for (const [key, value] of Object.entries(next)) {
      if (JSON.stringify(value) === JSON.stringify(before[key])) continue;
      if (key === "enabledHosts" || key === "disabledHosts") {
        const added = value.filter((host) => !before[key].includes(host));
        for (const host of added) addedHosts.add(host);
        result[key] = mergeListEdit(result[key], before[key], value);
      } else if (key === "ignoredElements") {
        // Merge per site so a picker save elsewhere survives this edit.
        for (const host of new Set([...Object.keys(before[key]), ...Object.keys(value)])) {
          const merged = mergeListEdit(result[key][host] || [], before[key][host] || [], value[host] || []);
          if (merged.length) result[key][host] = merged;
          else delete result[key][host];
        }
        result[key] = normalizeIgnoredElements(result[key]);
      } else {
        result[key] = value;
      }
    }
    for (const host of addedHosts) {
      // An explicit addition replaces the opposite rule; disabled wins a tie.
      const opposite = next.disabledHosts.includes(host) ? "enabledHosts" : "disabledHosts";
      result[opposite] = result[opposite].filter((rule) => rule !== host);
    }
    return result;
  }

  function mergeListEdit(latest, before, edited) {
    const removed = new Set(before.filter((item) => !edited.includes(item)));
    const added = edited.filter((item) => !before.includes(item));
    return Array.from(new Set([...latest.filter((item) => !removed.has(item)), ...added])).sort();
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
    return typeof value === "string"
      && !/\burl\(/i.test(value)
      && /\b(?:linear|radial|conic|repeating-linear|repeating-radial|repeating-conic)-gradient\(/.test(value);
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

  const SELECTOR_TOKEN = /^[A-Za-z][\w-]*$/;
  // Hashed build classes (css-1jxf684, r-bcqeeo) and state classes change
  // between visits, so they never anchor a saved selector.
  const UNSTABLE_CLASS = /\d{3,}|^[a-z]{1,4}-[a-z0-9]{5,}$|^(?:is|has)-|^(?:active|open|hover|focus|selected|current)$/i;

  function stableClasses(element) {
    return String(element.getAttribute("class") || "").split(/\s+/)
      .filter((token) => SELECTOR_TOKEN.test(token) && !UNSTABLE_CLASS.test(token))
      .slice(0, 2);
  }

  // Shortest ancestor path that matches only this element in its tree.
  // countMatches(selector) reports matches in the element's document or shadow root.
  function selectorForElement(element, countMatches) {
    const parts = [];
    for (let current = element; current && current.tagName !== "HTML"; current = current.parentElement) {
      if (current.id && SELECTOR_TOKEN.test(current.id) && !/\d{3,}/.test(current.id)) {
        parts.unshift(`#${current.id}`);
        if (countMatches(parts.join(" > ")) === 1) return parts.join(" > ");
        continue;
      }
      let part = [current.tagName.toLowerCase(), ...stableClasses(current).map((name) => `.${name}`)].join("");
      const siblings = current.parentElement
        ? Array.from(current.parentElement.children).filter((node) => node.tagName === current.tagName)
        : [];
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      parts.unshift(part);
      if (countMatches(parts.join(" > ")) === 1) return parts.join(" > ");
    }
    return parts.join(" > ");
  }

  // Dimming needs a tinted dark palette; plain Dark leaves pages as they are.
  function themeDimsImages(theme) {
    const palette = PALETTES[theme];
    return Boolean(palette) && palette.tint !== false && isDarkThemeKey(theme);
  }

  function imageDimmingActive(settings, prefersDark) {
    const normalized = normalizeSettings(settings);
    return normalized.dimImages && themeDimsImages(resolveSettingsThemeKey(normalized, prefersDark));
  }

  function applyImageDimming(root, settings, theme) {
    if (settings.dimImages && themeDimsImages(theme)) {
      root.setAttribute(DIM_ATTRIBUTE, "");
      root.style.setProperty("--rosewash-image-brightness", String(settings.imageBrightness / 100));
    } else {
      clearImageDimming(root);
    }
  }

  function clearImageDimming(root) {
    root.removeAttribute(DIM_ATTRIBUTE);
    root.style.removeProperty("--rosewash-image-brightness");
  }

  function createEngine({ document, window }) {
    const originalStyles = new WeakMap();
    const dirtyElements = new Set();
    let activeFonts = [];
    let fontKey = "[]";
    let tintedPageChrome = new WeakSet();
    // Original and applied declarations, with the same ownership rules as tints.
    let cssVarOverrides = new Map();
    let observer = null;
    let pendingRoots = new Map();
    let pendingFrame = null;
    let pendingSheets = new Set();
    // Open shadow roots found while scanning; observed with the document.
    let shadowRoots = new Set();
    // Elements awaiting a scan slice, each with whether to restore it first.
    let scanQueue = [];
    let scanIndex = 0;
    // Site rules from the element picker: matched elements and their contents stay untouched.
    let ignoredSelector = "";
    let activePresetLight = null;
    let activePresetDark = null;
    let activeAppearance = null;
    let activeTheme = null;
    let activePageTone = "mixed";
    // original color + assigned palette fill, so nested paper can follow a parent
    let surfaceRecords = new WeakMap();

    function matchesOverride(element, property, item) {
      return element.style.getPropertyValue(property) === item.appliedValue
        && element.style.getPropertyPriority(property) === item.appliedPriority;
    }

    function setStyle(element, property, value, priority = "") {
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
      const styles = originalStyles.get(element) || {};
      // Record only properties we write. React can add media backgrounds or
      // update an existing declaration after the first tint.
      if (!styles[property] || !matchesOverride(element, property, styles[property])) {
        styles[property] = {
          value: element.style.getPropertyValue(property),
          priority: element.style.getPropertyPriority(property)
        };
      }
      element.style.setProperty(property, value, nextPriority);
      styles[property].appliedValue = element.style.getPropertyValue(property);
      styles[property].appliedPriority = element.style.getPropertyPriority(property);
      originalStyles.set(element, styles);
      dirtyElements.add(element);
    }

    // Mirror each element's records once per pass instead of once per property.
    function flushStyleRecords() {
      for (const element of dirtyElements) {
        element.setAttribute(STYLE_OVERRIDES_ATTRIBUTE, JSON.stringify(originalStyles.get(element)));
        element.setAttribute(TINT_ATTRIBUTE, activeTheme);
      }
      dirtyElements.clear();
    }

    function connectedTintedElements() {
      const selector = `[${TINT_ATTRIBUTE}]`;
      const root = document.documentElement;
      const descendants = root ? [...document.querySelectorAll(selector)] : [];
      if (root?.hasAttribute(TINT_ATTRIBUTE) && !descendants.includes(root)) {
        descendants.unshift(root);
      }
      for (const shadow of connectedShadowRoots()) descendants.push(...shadow.querySelectorAll(selector));
      return descendants;
    }

    function connectedShadowRoots() {
      for (const shadow of shadowRoots) {
        if (shadow.host.isConnected === false) shadowRoots.delete(shadow);
      }
      return shadowRoots;
    }

    function rememberShadowRoot(shadow) {
      if (shadowRoots.has(shadow)) return;
      shadowRoots.add(shadow);
      if (observer) observeShadowRoot(shadow);
    }

    // Find open shadow roots below a root, including nested ones.
    function discoverShadowRoots(root) {
      for (const element of root.querySelectorAll("*")) {
        if (!element.shadowRoot) continue;
        rememberShadowRoot(element.shadowRoot);
        discoverShadowRoots(element.shadowRoot);
      }
    }

    // Cross shadow boundaries so shadow content follows its host's paper.
    function composedParent(element) {
      return element.parentElement || element.parentNode?.host || null;
    }

    function restoreStyleOverrides(element, styles) {
      for (const [property, item] of Object.entries(styles)) {
        // A later page write owns the declaration now; leave it in place.
        if (matchesOverride(element, property, item)) {
          if (item.value) {
            element.style.setProperty(property, item.value, item.priority);
          } else {
            element.style.removeProperty(property);
          }
        }
      }
    }

    function restoreElement(element) {
      const styles = originalStyles.get(element);
      if (styles) restoreStyleOverrides(element, styles);
      originalStyles.delete(element);
      dirtyElements.delete(element);
      element.removeAttribute(TINT_ATTRIBUTE);
      element.removeAttribute(STYLE_OVERRIDES_ATTRIBUTE);
      element.removeAttribute(HAD_STYLE_ATTRIBUTE);
      element.removeAttribute(ORIGINAL_STYLE_ATTRIBUTE);
    }

    function restoreTintedElements() {
      for (const element of connectedTintedElements()) {
        restoreElement(element);
      }
      tintedPageChrome = new WeakSet();
    }

    function restoreStaleTintedElements() {
      const selector = `[${TINT_ATTRIBUTE}]`;
      discoverShadowRoots(document);
      const staleElements = [
        ...(document.documentElement.matches(selector) ? [document.documentElement] : []),
        ...document.querySelectorAll(selector),
        ...[...shadowRoots].flatMap((shadow) => [...shadow.querySelectorAll(selector)])
      ];
      for (const element of staleElements) {
        if (element.hasAttribute(STYLE_OVERRIDES_ATTRIBUTE)) {
          restoreStyleOverrides(element, JSON.parse(element.getAttribute(STYLE_OVERRIDES_ATTRIBUTE)));
        } else if (element.getAttribute(HAD_STYLE_ATTRIBUTE) === "true") {
          // Clean up snapshots left by versions that stored the whole style.
          element.setAttribute("style", element.getAttribute(ORIGINAL_STYLE_ATTRIBUTE) || "");
        } else if (element.getAttribute(HAD_STYLE_ATTRIBUTE) === "false") {
          element.removeAttribute("style");
        }
        element.removeAttribute(TINT_ATTRIBUTE);
        element.removeAttribute(STYLE_OVERRIDES_ATTRIBUTE);
        element.removeAttribute(HAD_STYLE_ATTRIBUTE);
        element.removeAttribute(ORIGINAL_STYLE_ATTRIBUTE);
      }
    }

    function tintBorders(element, snapshot, palette) {
      const fill = parseColor(snapshot.backgroundColor);
      const borderSides = [
        ["border-top-color", snapshot.borderTopColor, snapshot.borderTopWidth, snapshot.borderTopStyle],
        ["border-right-color", snapshot.borderRightColor, snapshot.borderRightWidth, snapshot.borderRightStyle],
        ["border-bottom-color", snapshot.borderBottomColor, snapshot.borderBottomWidth, snapshot.borderBottomStyle],
        ["border-left-color", snapshot.borderLeftColor, snapshot.borderLeftWidth, snapshot.borderLeftStyle]
      ];

      for (const [property, value, width, style] of borderSides) {
        if (!isPaintedBorder(width, style)) {
          continue;
        }
        const color = parseColor(value);
        if (!isCoverBorderColor(color)) {
          continue;
        }
        // A stroke that matches the fill was an invisible seam.
        if (isOpaqueColor(fill) && colorsSharePaper(color, fill)) {
          continue;
        }
        setStyle(element, property, palette.muted);
      }
    }

    function rememberSurface(element, original, fill) {
      surfaceRecords.set(element, { original, fill });
    }

    function matchingPaperFill(element, color) {
      if (!isOpaqueColor(color)) {
        return null;
      }
      for (let parent = composedParent(element); parent; parent = composedParent(parent)) {
        const record = surfaceRecords.get(parent);
        if (!record || !isOpaqueColor(record.original)) {
          continue;
        }
        if (colorsSharePaper(color, record.original)) {
          return record.fill;
        }
      }
      return null;
    }

    function resolveSurfaceFill(element, background, palette, options) {
      if (options.pageElement) {
        return palette.base;
      }
      if (isOpaqueColor(background) && paletteSurfaceTokenFor(background, palette)) {
        return surfaceColorFor(background, palette, options);
      }
      const shared = matchingPaperFill(element, background);
      if (shared) {
        return shared;
      }
      return surfaceColorFor(background, palette, options);
    }

    function tintText(element, snapshot, palette) {
      const color = parseColor(snapshot.color);
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
      for (let current = element; current; current = composedParent(current)) {
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

    function readTintSnapshot(element, scanFont) {
      const computedStyle = window.getComputedStyle(element);
      return {
        element,
        backgroundColor: computedStyle.backgroundColor,
        backgroundImage: computedStyle.backgroundImage,
        backgroundClip: computedStyle.backgroundClip,
        webkitBackgroundClip: computedStyle.webkitBackgroundClip,
        color: computedStyle.color,
        fontFamily: scanFont ? computedStyle.fontFamily : "",
        borderTopColor: computedStyle.borderTopColor,
        borderRightColor: computedStyle.borderRightColor,
        borderBottomColor: computedStyle.borderBottomColor,
        borderLeftColor: computedStyle.borderLeftColor,
        borderTopWidth: computedStyle.borderTopWidth,
        borderRightWidth: computedStyle.borderRightWidth,
        borderBottomWidth: computedStyle.borderBottomWidth,
        borderLeftWidth: computedStyle.borderLeftWidth,
        borderTopStyle: computedStyle.borderTopStyle,
        borderRightStyle: computedStyle.borderRightStyle,
        borderBottomStyle: computedStyle.borderBottomStyle,
        borderLeftStyle: computedStyle.borderLeftStyle
      };
    }

    function processSnapshot(snapshot, theme) {
      const element = snapshot.element;
      if (activeFonts.length && snapshot.fontFamily) {
        const original = snapshot.fontFamily.replace(/"?Rosewash(?:English|Chinese|Math|Monospace)"?,\s*/g, "");
        const protectedFont = /icon|awesome|material\s*(symbols|icons)|glyph|dingbat/i.test(original);
        let families = [];
        if (!protectedFont) {
          if (element.closest("math")) {
            families = ["RosewashMath"];
          } else if (element.closest("pre, code, kbd, samp") || /(?:^|,\s*)(?:ui-)?monospace(?:\s*,|$)/i.test(original)) {
            families = ["RosewashMonospace"];
          } else if (!shouldSkipElement(element)) {
            families = ["RosewashEnglish", "RosewashChinese"];
          }
        }
        const prefix = activeFonts.filter((face) => families.includes(face.family))
          .map((face) => '"' + face.family + '", ').join("");
        // Ancestors already supply these faces to inheriting descendants.
        // Rewriting them pins inherited fonts and invalidates styles needlessly.
        if (prefix && !snapshot.fontFamily.replace(/["'\s]/g, "")
          .startsWith(prefix.replace(/["'\s]/g, ""))) {
          setStyle(element, "font-family", prefix + original);
        }
      }
      const palette = PALETTES[theme];
      if (palette.tint === false || shouldSkipElement(element)) return;
      const background = parseColor(snapshot.backgroundColor);
      const hasBackgroundImage = snapshot.backgroundImage && snapshot.backgroundImage !== "none";
      const generatedBackground = isGeneratedBackgroundImage(snapshot.backgroundImage);
      const gradientText = generatedBackground
        && (snapshot.backgroundClip === "text" || snapshot.webkitBackgroundClip === "text");
      if (gradientText) {
        setStyle(element, "background-image", "none");
        setStyle(element, "color", element.tagName === "A" ? palette.link : palette.text);
        setStyle(element, "-webkit-text-fill-color", "currentColor");
      }
      const pageElement = isPageElement(element, document);

      const chromeCandidate = isPageChromeElement(element);
      const knownChromeClass = hasPageChromeClass(elementClassName(element));
      // Semantic headers / known site shells still paint when the root is
      // transparent (background lives on a child or CSS-in-JS layer).
      const pageChromeTinted = !gradientText && chromeCandidate
        && (knownChromeClass || background?.alpha > 0.05 || generatedBackground)
        && (knownChromeClass || !hasBackgroundImage || generatedBackground);
      if (pageChromeTinted) {
        if (generatedBackground || knownChromeClass || hasBackgroundImage) {
          setStyle(element, "background-image", "none", "important");
        }
        setStyle(element, "background-color", palette.base, "important");
        tintedPageChrome.add(element);
        rememberSurface(element, background, palette.base);
      }

      const insidePageChrome = isInsideTintedPageChrome(element);
      if (insidePageChrome) {
        setStyle(element, "color", palette.text, "important");
      }

      // Full cover: every opaque painted box becomes Rose Pine. Gradient-only
      // fills are flattened; url()/media backgrounds stay untouched.
      const coverSurface = !gradientText && !pageChromeTinted
        && (!hasBackgroundImage || generatedBackground)
        && (isCoverSurfaceBackground(background, { pageElement }) || generatedBackground);
      if (coverSurface) {
        if (generatedBackground) {
          setStyle(element, "background-image", "none");
        }
        const fill = resolveSurfaceFill(element, background, palette, {
          pageElement,
          theme,
          tagName: element.tagName
        });
        setStyle(element, "background-color", fill);
        rememberSurface(element, background, fill);
      }

      if (!insidePageChrome) {
        tintText(element, snapshot, palette);
      }
      tintBorders(element, snapshot, palette);
    }

    function isSiteIgnored(element) {
      if (!ignoredSelector) return false;
      for (let current = element; current; current = composedParent(current)) {
        if (current.matches(ignoredSelector)) return true;
      }
      return false;
    }

    function queryableSelectors(selectors) {
      return selectors.filter((selector) => {
        try {
          document.documentElement.matches(selector);
          return true;
        } catch {
          return false;
        }
      });
    }

    function forgetElement(element) {
      if (element.hasAttribute(TINT_ATTRIBUTE)) restoreElement(element);
      surfaceRecords.delete(element);
      tintedPageChrome.delete(element);
    }

    // Queue a subtree in document order so ancestors are painted before
    // descendants. Restoring descendants is deferred to their own slice, so
    // elements keep their previous tint instead of flashing page colors.
    function enqueueSubtree(root, restoreDescendants) {
      enqueueElement(root, false);
      enqueueShadowContent(root, restoreDescendants);
      enqueueDescendants(root, restoreDescendants);
    }

    function scanOptions(element) {
      if (isSiteIgnored(element)) return { tint: false, font: false };
      const skipElement = shouldSkipElement(element);
      return {
        tint: PALETTES[activeTheme].tint !== false && !skipElement,
        font: activeFonts.length > 0 && !element.closest(FONT_SKIP_SELECTOR)
          && (!skipElement || (element.closest("math")
            && activeFonts.some((face) => face.family === "RosewashMath")))
      };
    }

    function enqueueElement(element, restore) {
      const scan = scanOptions(element);
      // Protected formula nodes must not split useful work into hundreds of
      // tiny read/write batches. Keep old overrides queued until restored.
      if (scan.tint || scan.font || (restore && element.hasAttribute(TINT_ATTRIBUTE))) {
        scanQueue.push([element, restore]);
      }
      return scan;
    }

    function enqueueDescendants(root, restore) {
      const skipped = new WeakSet();
      const mathFont = activeFonts.some((face) => face.family === "RosewashMath");
      const skipDescendants = (element, scan) => !scan.tint && !scan.font
        && (!mathFont || element.closest(FONT_SKIP_SELECTOR) || element.closest("math"));
      if (isElementNode(root) && skipDescendants(root, scanOptions(root))) skipped.add(root);
      for (const element of root.querySelectorAll("*")) {
        // A protected formula's children share its decision. Avoid walking
        // their ancestors again for every nested span and MathML symbol.
        if (skipped.has(element.parentElement)) {
          skipped.add(element);
          if (restore && element.hasAttribute(TINT_ATTRIBUTE)) scanQueue.push([element, true]);
        } else {
          const scan = enqueueElement(element, restore);
          if (skipDescendants(element, scan)) skipped.add(element);
        }
        enqueueShadowContent(element, restore);
      }
    }

    function enqueueShadowContent(host, restore) {
      if (!host.shadowRoot) return;
      rememberShadowRoot(host.shadowRoot);
      enqueueDescendants(host.shadowRoot, restore);
    }

    function resetScanQueue() {
      scanQueue = [];
      scanIndex = 0;
    }

    // Large pages are tinted across frames instead of one long task.
    function drainScanQueue() {
      const started = window.performance.now();
      while (scanIndex < scanQueue.length) {
        const batch = scanQueue.slice(scanIndex, scanIndex + SCAN_BATCH_SIZE);
        scanIndex += batch.length;
        const elements = batch.filter(([element]) => element.isConnected !== false);
        for (const [element, restoreFirst] of elements) {
          if (restoreFirst) forgetElement(element);
        }
        // Read the whole batch before writing, so styles recalculate once.
        const snapshots = [];
        for (const [element] of elements) {
          // Recheck because a page can change classes between scan slices.
          const scan = scanOptions(element);
          if (scan.tint || scan.font) {
            snapshots.push(readTintSnapshot(element, scan.font));
          }
        }
        for (const snapshot of snapshots) processSnapshot(snapshot, activeTheme);
        if (window.performance.now() - started >= SCAN_BUDGET_MS) break;
      }
      flushStyleRecords();
      if (scanIndex < scanQueue.length) {
        requestFlush();
      } else {
        resetScanQueue();
      }
    }

    function flushPending() {
      pendingFrame = null;
      const sheets = pendingSheets;
      pendingSheets = new Set();
      if (!activeTheme) {
        pendingRoots = new Map();
        return;
      }

      for (const sheet of sheets) markStyleSheetTargets(sheet);
      const roots = pendingRoots;
      pendingRoots = new Map();
      for (const [root, refresh] of roots) {
        if (!refresh) continue;
        for (let parent = composedParent(root); parent; parent = composedParent(parent)) {
          if (roots.has(parent)) roots.set(parent, true);
        }
      }
      for (const [root, refresh] of roots) {
        let covered = false;
        for (let parent = composedParent(root); parent; parent = composedParent(parent)) {
          if (roots.has(parent)) { covered = true; break; }
        }
        if (covered) continue;
        if (isElementNode(root) && root.isConnected !== false) {
          if (refresh) forgetElement(root);
          if (refresh && root === document.documentElement) {
            resetScanQueue();
            restoreCssVarOverrides();
            applyRootTheme(activeTheme);
          }
          enqueueSubtree(root, refresh);
        }
      }
      drainScanQueue();
    }

    // Coalesce SPA mutations to the next frame — not 250ms — so new white
    // nodes cover before the next paint when possible.
    function scheduleScan(root, refresh = false) {
      pendingRoots.set(root, refresh || pendingRoots.get(root) === true);
      requestFlush();
    }

    function scheduleStyleSheet(sheet) {
      if (!sheet) return;
      pendingSheets.add(sheet);
      requestFlush();
    }

    function requestFlush() {
      if (pendingFrame !== null) {
        return;
      }

      if (typeof window.requestAnimationFrame === "function") {
        pendingFrame = window.requestAnimationFrame(flushPending);
      } else {
        pendingFrame = window.setTimeout(flushPending, 0);
      }
    }

    // A new sheet only refreshes existing elements its color rules select.
    // Unreadable sheets and unqueryable selectors refresh the whole page.
    function markStyleSheetTargets(sheet) {
      try {
        const scope = sheet.ownerNode.getRootNode();
        collectStyleRuleTargets(scope, sheet.cssRules, (element) => pendingRoots.set(element, true));
      } catch {
        pendingRoots.set(document.documentElement, true);
      }
    }

    function collectStyleRuleTargets(scope, rules, mark) {
      for (const rule of rules) {
        if (rule.cssRules?.length) collectStyleRuleTargets(scope, rule.cssRules, mark);
        if (!rule.selectorText || ![...rule.style].some((name) => STYLE_RULE_PROPERTY.test(name))) continue;
        for (const element of scope.querySelectorAll(rule.selectorText)) mark(element);
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
          if (record.type === "attributes") {
            scheduleScan(record.target, true);
            continue;
          }
          const target = isElementNode(record.target) ? record.target : record.target.parentElement;
          const style = target?.closest("style");
          if (style) {
            scheduleStyleSheet(style.sheet);
            continue;
          }
          for (const node of record.addedNodes || []) {
            if (isElementNode(node)) {
              const styles = node.tagName === "STYLE" ? [node] : node.querySelectorAll("style");
              for (const element of styles) scheduleStyleSheet(element.sheet);
              scheduleScan(node);
            }
          }
        }
      });
      observer.observe(document.documentElement, OBSERVER_OPTIONS);
      document.addEventListener("load", handleStylesheetLoad, true);
      for (const shadow of connectedShadowRoots()) observeShadowRoot(shadow);
    }

    // Mutations and stylesheet loads do not cross shadow boundaries.
    function observeShadowRoot(shadow) {
      observer.observe(shadow, OBSERVER_OPTIONS);
      shadow.addEventListener("load", handleStylesheetLoad, true);
    }

    function refresh() {
      if (activeTheme && (PALETTES[activeTheme].tint !== false || activeFonts.length)) {
        scheduleScan(document.documentElement, true);
      }
    }

    function handleStylesheetLoad(event) {
      if (event.target.tagName === "LINK" && event.target.relList.contains("stylesheet")) {
        scheduleStyleSheet(event.target.sheet);
      }
    }

    function disconnectObserver() {
      if (observer) {
        observer.disconnect();
        observer = null;
        document.removeEventListener("load", handleStylesheetLoad, true);
        for (const shadow of shadowRoots) shadow.removeEventListener("load", handleStylesheetLoad, true);
      }
      if (pendingFrame !== null) {
        if (typeof window.cancelAnimationFrame === "function") {
          window.cancelAnimationFrame(pendingFrame);
        }
        window.clearTimeout(pendingFrame);
        pendingFrame = null;
      }
      pendingRoots = new Map();
      pendingSheets = new Set();
      resetScanQueue();
    }

    function restoreCssVarOverrides() {
      const root = document.documentElement;
      restoreStyleOverrides(root, Object.fromEntries(cssVarOverrides));
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

      for (const [name, item] of cssVarOverrides) {
        if (next.has(name)) {
          continue;
        }
        restoreStyleOverrides(root, { [name]: item });
        cssVarOverrides.delete(name);
      }

      for (const [name, value] of next) {
        let item = cssVarOverrides.get(name);
        if (!item || !matchesOverride(root, name, item)) {
          item = {
            value: root.style.getPropertyValue(name),
            priority: root.style.getPropertyPriority(name)
          };
          cssVarOverrides.set(name, item);
        }
        // ChatGPT (and similar) dark themes set surface tokens with
        // !important on .dark; non-important inline loses that cascade.
        if (
          root.style.getPropertyValue(name) !== value
          || root.style.getPropertyPriority(name) !== "important"
        ) {
          root.style.setProperty(name, value, "important");
        }
        item.appliedValue = root.style.getPropertyValue(name);
        item.appliedPriority = root.style.getPropertyPriority(name);
      }
    }

    function applyRootTheme(theme) {
      const palette = applyThemeTokens(document.documentElement, theme);
      if (palette.tint === false) return palette;
      setStyle(
        document.documentElement,
        "color-scheme",
        isDarkThemeKey(theme) ? "dark" : "light"
      );
      setStyle(document.documentElement, "scrollbar-color", `${palette.muted} ${palette.base}`);
      flushStyleRecords();
      applyCssVarSurfaces(theme);
      return palette;
    }

    function replaceFonts(definitions) {
      for (const face of activeFonts) document.fonts.delete(face);
      activeFonts = definitions.map(([family, name, unicodeRange]) => {
        const face = new window.FontFace(family, cssFontSource(name), { unicodeRange });
        document.fonts.add(face);
        return face;
      });
      fontKey = JSON.stringify(definitions);
    }

    function clear() {
      replaceFonts([]);
      disconnectObserver();
      restoreTintedElements();
      restoreCssVarOverrides();
      surfaceRecords = new WeakMap();
      ignoredSelector = "";
      clearImageDimming(document.documentElement);
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
      const host = policyHostForLocation(document.location);
      if (!normalized.enabled || !isHostEnabled(host, normalized)) {
        clear();
        return { enabled: false, theme: null, tinted: 0 };
      }

      const definitions = fontDefinitions(normalized);
      const fontsChanged = JSON.stringify(definitions) !== fontKey;
      const nextIgnoredSelector = queryableSelectors(ignoredSelectorsForHost(host, normalized)).join(", ");
      // New fonts or picker rules restore and rescan like a palette change.
      const rulesChanged = fontsChanged || (Boolean(activeTheme) && nextIgnoredSelector !== ignoredSelector);
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const theme = resolveSettingsThemeKey(normalized, prefersDark);
      const nextPalette = PALETTES[theme];
      const tintEnabled = nextPalette.tint !== false;
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
      const scans = tintEnabled || definitions.length > 0;
      if (themeChanged || rulesChanged) {
        disconnectObserver();
        // A rescan restores each element in its own slice.
        if (scans) forgetElement(document.documentElement);
        else restoreTintedElements();
        restoreCssVarOverrides();
      }

      if (fontsChanged) replaceFonts(definitions);
      ignoredSelector = nextIgnoredSelector;
      const redundant = Boolean(activeTheme) && !themeChanged && !rulesChanged;
      if (!redundant) {
        activePageTone = tintEnabled ? detectPageTone() : "mixed";
      }
      activePresetLight = normalized.presetLight;
      activePresetDark = normalized.presetDark;
      activeAppearance = normalized.appearance;
      activeTheme = theme;
      applyRootTheme(theme);
      applyImageDimming(document.documentElement, normalized, theme);
      if (scans) {
        if (!redundant) {
          enqueueSubtree(document.documentElement, themeChanged || rulesChanged);
          drainScanQueue();
        }
        observe();
      } else {
        disconnectObserver();
      }
      return {
        enabled: true,
        theme,
        presetLight: normalized.presetLight,
        presetDark: normalized.presetDark,
        appearance: normalized.appearance,
        tinted: connectedTintedElements().length
      };
    }

    function stats() {
      return {
        presetLight: activePresetLight,
        presetDark: activePresetDark,
        appearance: activeAppearance,
        theme: activeTheme,
        pageTone: activePageTone,
        tinted: connectedTintedElements().length
      };
    }

    return { apply, refresh, clear, stats, disconnect: disconnectObserver };
  }

  const api = Object.freeze({
    DEFAULT_SETTINGS,
    PRESETS,
    PRESET_IDS,
    PALETTES,
    X_SINGLE_COLUMN_WIDTHS,
    ZHIHU_ARTICLE_WIDTHS,
    IMAGE_BRIGHTNESS_LEVELS,
    listPresets,
    createEngine,
    selectorForElement,
    imageDimmingActive,
    ignoredSelectorsForHost,
    addIgnoredSelector,
    clearIgnoredSelectors,
    createFontFaces,
    classifyPageTone,
    hostFromUrl,
    policyHostForLocation,
    browserKind,
    pageRestrictionForUrl,
    isDarkNeutralColor,
    isDarkSurfaceColor,
    isDarkThemeKey,
    generatedBackgroundHasDarkSurface,
    isHostDisabled,
    isHostEnabled,
    hostPolicyForHost,
    isZhihuHost,
    isZhihuArticlePath,
    toggleHostDisabled,
    toggleHostEnabled,
    setHostPolicy,
    isLightNeutralColor,
    isGeneratedBackgroundImage,
    isNearWhiteColor,
    isOpaqueColor,
    isPageChromeCandidate,
    isCoverSurfaceBackground,
    isCoverBorderColor,
    colorsSharePaper,
    isPaintedBorder,
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
    mergeSettingsEdits,
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
