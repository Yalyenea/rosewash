import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadCore() {
  const source = await readFile(new URL("../src/content/core.js", import.meta.url), "utf8");
  const context = { console };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return context.RosewashCore;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("parses rgb, rgba, and hex colors", async () => {
  const core = await loadCore();
  assert.deepEqual(plain(core.parseColor("rgb(255, 250, 243)")), {
    red: 255,
    green: 250,
    blue: 243,
    alpha: 1
  });
  assert.deepEqual(plain(core.parseColor("rgba(35, 33, 54, 0.5)")), {
    red: 35,
    green: 33,
    blue: 54,
    alpha: 0.5
  });
  assert.deepEqual(plain(core.parseColor("#faf4ed")), {
    red: 250,
    green: 244,
    blue: 237,
    alpha: 1
  });
  assert.deepEqual(plain(core.parseColor("#fffffff2")), {
    red: 255,
    green: 255,
    blue: 255,
    alpha: 242 / 255
  });
  assert.equal(core.classifySurfaceCssVar("--main-surface-background", core.parseColor("#fffffff2")), "base");
});

test("parses modern CSS color functions enough for tone detection", async () => {
  const core = await loadCore();
  assert.equal(core.isDarkSurfaceColor(core.parseColor("lab(0.0177803 0 0)")), true);
  assert.equal(core.isLightNeutralColor(core.parseColor("lab(93.736 0 0)")), true);
  assert.equal(core.isDarkSurfaceColor(core.parseColor("oklch(0.09 0.025 45)")), true);
  assert.equal(core.isDarkSurfaceColor(core.parseColor("oklab(0.144788 7.45058e-9 7.45058e-9 / 0.8)")), true);
  assert.equal(core.isLightNeutralColor(core.parseColor("oklch(0.922 0 0)")), true);
  assert.equal(core.isLightNeutralColor(core.parseColor("oklch(70.5% .213 47.604)")), false);
});

test("detects harsh near-white backgrounds", async () => {
  const core = await loadCore();
  assert.equal(core.isNearWhiteColor(core.parseColor("rgb(255, 255, 255)")), true);
  assert.equal(core.isNearWhiteColor(core.parseColor("rgb(250, 244, 237)")), true);
  assert.equal(core.isNearWhiteColor(core.parseColor("rgb(238, 242, 246)")), true);
  assert.equal(core.isNearWhiteColor(core.parseColor("rgb(240, 230, 210)")), false);
  assert.equal(core.isNearWhiteColor(core.parseColor("rgba(255, 255, 255, 0)")), false);
});

test("covers any opaque surface and transparent page roots", async () => {
  const core = await loadCore();
  const transparent = core.parseColor("rgba(0, 0, 0, 0)");
  const coolPaper = core.parseColor("rgb(238, 242, 246)");
  const darkShell = core.parseColor("rgb(10, 12, 16)");
  const midGray = core.parseColor("rgb(150, 150, 150)");
  assert.equal(core.isTransparentColor(transparent), true);
  assert.equal(core.isCoverSurfaceBackground(transparent, { pageElement: true }), true);
  assert.equal(core.isCoverSurfaceBackground(transparent, { pageElement: false }), false);
  assert.equal(core.isCoverSurfaceBackground(coolPaper, { pageElement: false }), true);
  assert.equal(core.isCoverSurfaceBackground(darkShell, { pageElement: false }), true);
  assert.equal(core.isCoverSurfaceBackground(midGray, { pageElement: false }), true);

  const dawn = core.PALETTES.dawn;
  assert.equal(core.surfaceColorFor(coolPaper, dawn, { pageElement: true }), dawn.base);
  assert.equal(core.surfaceColorFor(coolPaper, dawn, { pageElement: false }), dawn.surface);
  assert.equal(core.surfaceColorFor(darkShell, dawn, { pageElement: false }), dawn.surface);
  assert.equal(core.surfaceColorFor(midGray, dawn, { pageElement: false }), dawn.overlay);
});

test("detects dark-only page tone from root surfaces and theme signals", async () => {
  const core = await loadCore();
  assert.equal(core.isDarkSurfaceColor(core.parseColor("#080b0a")), true);
  assert.equal(core.isLightNeutralColor(core.parseColor("rgba(224, 214, 189, 0.72)")), true);
  assert.equal(core.classifyPageTone([
    { backgroundColor: "rgb(8, 11, 10)", color: "rgb(0, 0, 0)", darkSignal: true },
    { backgroundColor: "rgb(8, 11, 10)", color: "rgba(224, 214, 189, 0.72)" }
  ]), "dark-only");
  assert.equal(core.classifyPageTone([
    { backgroundColor: "rgba(0, 0, 0, 0)", color: "rgb(0, 0, 0)", darkSignal: true },
    { backgroundColor: "lab(0.0177803 0 0)", color: "lab(93.736 0 0)" }
  ]), "dark-only");
  assert.equal(core.classifyPageTone([
    { backgroundColor: "oklch(0.09 0.025 45)", color: "rgb(0, 0, 0)" },
    { backgroundColor: "rgb(5, 5, 5)", color: "oklch(0.922 0 0)" }
  ]), "dark-only");
  // Single dark root + light body text (Substack-like nested shells).
  assert.equal(core.classifyPageTone([
    { backgroundColor: "rgb(23, 23, 23)", color: "rgb(0, 0, 0)" },
    { backgroundColor: "rgb(23, 23, 23)", color: "rgb(255, 255, 255)" }
  ]), "dark-only");
  // Single dark root + publication theme flag, no light text on the root sample.
  assert.equal(core.classifyPageTone([
    { backgroundColor: "rgba(0, 0, 0, 0)", color: "rgb(0, 0, 0)", darkSignal: true },
    { backgroundColor: "#171717", color: "rgb(0, 0, 0)" }
  ]), "dark-only");
});

test("keeps normal light and mixed pages out of dark-only adaptation", async () => {
  const core = await loadCore();
  assert.equal(core.classifyPageTone([
    { backgroundColor: "rgb(255, 255, 255)", color: "rgb(17, 17, 17)" },
    { backgroundColor: "rgb(250, 250, 250)", color: "rgb(17, 17, 17)" }
  ]), "light-page");
  assert.equal(core.classifyPageTone([
    { backgroundColor: "rgb(8, 11, 10)", color: "rgb(229, 219, 192)" },
    { backgroundColor: "rgb(255, 250, 243)", color: "rgb(87, 82, 121)" }
  ]), "light-page");
  // Lone dark surface without light text or theme flags stays mixed.
  assert.equal(core.classifyPageTone([
    { backgroundColor: "rgb(23, 23, 23)", color: "rgb(0, 0, 0)" }
  ]), "mixed");
});

test("skips non-layout nodes when sampling page tone", async () => {
  const core = await loadCore();
  assert.equal(core.isToneSampleElement({ nodeType: 1, tagName: "DIV" }), true);
  assert.equal(core.isToneSampleElement({ nodeType: 1, tagName: "SCRIPT" }), false);
  assert.equal(core.isToneSampleElement({ nodeType: 1, tagName: "STYLE" }), false);
  assert.equal(core.isToneSampleElement({ nodeType: 3, tagName: undefined }), false);
});

test("detects generated CSS gradients without treating image urls as safe backgrounds", async () => {
  const core = await loadCore();
  assert.equal(core.isGeneratedBackgroundImage("linear-gradient(rgb(8, 11, 10), transparent)"), true);
  assert.equal(core.isGeneratedBackgroundImage("radial-gradient(circle, #111, #0000)"), true);
  assert.equal(core.isGeneratedBackgroundImage("url(hero.png)"), false);
  assert.equal(core.isGeneratedBackgroundImage("none"), false);
  assert.equal(core.generatedBackgroundHasDarkSurface("linear-gradient(rgb(8, 11, 10), transparent)"), true);
  assert.equal(core.generatedBackgroundHasDarkSurface("linear-gradient(#d1bd95, #b39769)"), false);
});

test("classifies design-system surface and text tokens for root CSS var overrides", async () => {
  const core = await loadCore();
  const white = core.parseColor("#fcfcfc");
  const pure = core.parseColor("#ffffff");
  const dark = core.parseColor("#0a0c10");
  const ink = core.parseColor("rgb(22, 30, 27)");
  assert.equal(core.classifySurfaceCssVar("--main-surface-primary", white), "base");
  assert.equal(core.classifySurfaceCssVar("--bg-primary", pure), "base");
  assert.equal(core.classifySurfaceCssVar("--composer-surface-primary", pure), "surface");
  assert.equal(core.classifySurfaceCssVar("--main-surface-secondary", white), "surface");
  assert.equal(core.classifySurfaceCssVar("--sidebar-surface-primary", white), "base");
  assert.equal(core.classifySurfaceCssVar("--component-sidebar-bg", white), "base");
  assert.equal(core.classifySurfaceCssVar("--ground", dark), "base");
  assert.equal(core.classifySurfaceCssVar("--web_bg_color", dark), "base");
  // Do not recolor inverted button/icon whites or brand accents.
  assert.equal(core.classifySurfaceCssVar("--text-inverted", pure), null);
  assert.equal(core.classifySurfaceCssVar("--icon-inverted", pure), null);
  assert.equal(core.classifySurfaceCssVar("--interactive-label-primary-default", pure), null);
  assert.equal(core.classifySurfaceCssVar("--white", pure), null);
  assert.equal(core.classifyTextCssVar("--ink", ink), "text");
  assert.equal(core.classifyTextCssVar("--title-ink", ink), "text");
  assert.equal(core.classifyTextCssVar("--text-inverted", pure), null);

  const palette = core.PALETTES.dawn;
  assert.equal(
    JSON.stringify(core.resolveSurfaceCssVarOverrides([
      ["--main-surface-primary", "#fcfcfc"],
      ["--composer-surface-primary", "#fff"],
      ["--text-inverted", "#fff"],
      ["--bg-primary", "#ffffff"],
      ["--ground", "rgb(238, 242, 246)"],
      ["--ink", "rgb(22, 30, 27)"]
    ], palette)),
    JSON.stringify([
      ["--main-surface-primary", palette.base],
      ["--composer-surface-primary", palette.surface],
      ["--bg-primary", palette.base],
      ["--ground", palette.base],
      ["--ink", palette.text]
    ])
  );
});

test("resolves auto mode from system preference", async () => {
  const core = await loadCore();
  assert.equal(core.resolveThemeMode("auto", false), "dawn");
  assert.equal(core.resolveThemeMode("auto", true), "moon");
  assert.equal(core.resolveThemeMode("dawn", true), "dawn");
  assert.equal(core.resolveThemeMode("moon", false), "moon");
});

test("uses the same moon theme for auto dark and manual moon", async () => {
  const core = await loadCore();
  const autoDarkTheme = core.resolveThemeMode("auto", true);
  const manualMoonTheme = core.resolveThemeMode("moon", false);
  assert.equal(autoDarkTheme, "moon");
  assert.equal(autoDarkTheme, manualMoonTheme);
});

test("uses the same dawn theme for auto light and manual dawn", async () => {
  const core = await loadCore();
  const autoLightTheme = core.resolveThemeMode("auto", false);
  const manualDawnTheme = core.resolveThemeMode("dawn", true);
  assert.equal(autoLightTheme, "dawn");
  assert.equal(autoLightTheme, manualDawnTheme);
});

test("covers opaque text colors in both dawn and moon", async () => {
  const core = await loadCore();
  assert.equal(core.shouldTintTextColor("moon", core.parseColor("rgb(17, 17, 17)"), false), true);
  assert.equal(core.shouldTintTextColor("moon", core.parseColor("#575279"), false), true);
  assert.equal(core.shouldTintTextColor("moon", core.parseColor("#e0def4"), false), true);
  assert.equal(core.shouldTintTextColor("dawn", core.parseColor("rgb(17, 17, 17)"), false), true);
  assert.equal(core.shouldTintTextColor("dawn", core.parseColor("rgb(255, 255, 255)"), false), true);
  assert.equal(core.shouldTintTextColor("dawn", core.parseColor("rgba(0, 0, 0, 0)"), false), false);
});

test("recognizes page-level headers and navigation without matching article chrome", async () => {
  const core = await loadCore();
  assert.equal(core.isPageChromeCandidate({ tagName: "header" }), true);
  assert.equal(core.isPageChromeCandidate({ tagName: "div", role: "banner" }), true);
  assert.equal(core.isPageChromeCandidate({ tagName: "nav" }), true);
  assert.equal(core.isPageChromeCandidate({ tagName: "nav", insideChrome: true }), false);
  assert.equal(core.isPageChromeCandidate({ tagName: "header", insideContent: true }), false);
  assert.equal(core.isPageChromeCandidate({ tagName: "section" }), false);
  assert.equal(core.isPageChromeCandidate({ tagName: "div", className: "AppHeader" }), true);
  assert.equal(core.isPageChromeCandidate({ tagName: "div", className: "AppHeader", insideContent: true }), false);
  assert.equal(core.isPageChromeCandidate({ tagName: "header", className: "LeanAppHeaderBar" }), true);
  assert.equal(core.isPageChromeCandidate({ tagName: "header", className: "MobileAppHeader" }), true);
});

function createStyleBag(initial = {}) {
  const values = new Map();
  const priorities = new Map();
  for (const [property, value] of Object.entries(initial)) {
    values.set(property, value);
    priorities.set(property, "");
  }

  return {
    getPropertyValue(property) {
      return values.get(property) || "";
    },
    getPropertyPriority(property) {
      return priorities.get(property) || "";
    },
    setProperty(property, value, priority = "") {
      values.set(property, value);
      priorities.set(property, priority || "");
    },
    removeProperty(property) {
      values.delete(property);
      priorities.delete(property);
    }
  };
}

function createMockDom(nodes) {
  const byId = new Map();
  const all = [];

  function createNode(spec, parent = null) {
    const attrs = new Map(Object.entries(spec.attrs || {}));
    const style = createStyleBag();
    const customProperties = new Map(Object.entries(spec.cssVars || {}));
    const computedNames = [...customProperties.keys()];
    const computed = {
      backgroundColor: spec.backgroundColor || "rgba(0, 0, 0, 0)",
      backgroundImage: spec.backgroundImage || "none",
      color: spec.color || "rgb(0, 0, 0)",
      borderTopColor: spec.borderTopColor || "rgb(0, 0, 0)",
      borderRightColor: spec.borderRightColor || "rgb(0, 0, 0)",
      borderBottomColor: spec.borderBottomColor || "rgb(0, 0, 0)",
      borderLeftColor: spec.borderLeftColor || "rgb(0, 0, 0)",
      colorScheme: spec.colorScheme || "normal",
      length: computedNames.length,
      getPropertyValue(property) {
        if (customProperties.has(property)) {
          return customProperties.get(property);
        }
        return "";
      },
      item(index) {
        return computedNames[index] || "";
      }
    };
    for (let index = 0; index < computedNames.length; index += 1) {
      computed[index] = computedNames[index];
    }
    const children = [];
    const node = {
      nodeType: 1,
      tagName: String(spec.tag || "div").toUpperCase(),
      id: spec.id || "",
      className: spec.className || "",
      classList: {
        contains(token) {
          return String(spec.className || "").split(/\s+/).includes(token);
        }
      },
      parentElement: parent,
      children,
      style,
      _computed: computed,
      getAttribute(name) {
        if (name === "class") {
          return node.className || null;
        }
        return attrs.has(name) ? attrs.get(name) : null;
      },
      setAttribute(name, value) {
        if (name === "class") {
          node.className = String(value);
          return;
        }
        attrs.set(name, String(value));
      },
      removeAttribute(name) {
        if (name === "class") {
          node.className = "";
          return;
        }
        attrs.delete(name);
      },
      hasAttribute(name) {
        if (name === "class") {
          return Boolean(node.className);
        }
        return attrs.has(name);
      },
      matches(selector) {
        if (selector.includes("[")) {
          const attrNames = [...selector.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1]);
          return attrNames.every((name) => node.hasAttribute(name));
        }
        return false;
      },
      closest(selector) {
        let current = node;
        while (current) {
          if (selector.split(",").map((part) => part.trim()).some((part) => {
            if (part.startsWith(".")) {
              return current.classList.contains(part.slice(1));
            }
            if (part.startsWith("[")) {
              const attr = part.slice(1, -1).replace(/=['"]?([^'"]+)['"]?/, "");
              if (part.includes("=")) {
                const match = part.match(/\[([^=]+)=['"]?([^'"\]]+)['"]?\]/);
                return match && current.getAttribute(match[1]) === match[2];
              }
              return current.hasAttribute(attr);
            }
            return current.tagName.toLowerCase() === part.toLowerCase();
          })) {
            return current;
          }
          current = current.parentElement;
        }
        return null;
      },
      querySelectorAll(selector) {
        if (selector === "*") {
          const collected = [];
          const walk = (current) => {
            for (const child of current.children) {
              collected.push(child);
              walk(child);
            }
          };
          walk(node);
          return collected;
        }
        return [];
      }
    };

    if (spec.id) {
      byId.set(spec.id, node);
    }
    all.push(node);

    for (const childSpec of spec.children || []) {
      children.push(createNode(childSpec, node));
    }

    return node;
  }

  const html = createNode({
    tag: "html",
    backgroundColor: nodes.htmlBackgroundColor || "rgb(255, 255, 255)",
    color: nodes.htmlColor || "rgb(0, 0, 0)",
    cssVars: nodes.rootCssVars || {},
    children: [
      {
        tag: "body",
        backgroundColor: nodes.bodyBackgroundColor || "rgb(255, 255, 255)",
        color: nodes.bodyColor || "rgb(17, 17, 17)",
        children: nodes.tree || []
      }
    ]
  });
  const body = html.children[0];

  function findBySelector(selector) {
    if (selector.startsWith("#")) {
      return byId.get(selector.slice(1)) || null;
    }
    if (selector.startsWith(".")) {
      const token = selector.slice(1);
      return all.find((node) => node.classList.contains(token)) || null;
    }
    if (selector.includes("use-theme-bg")) {
      return all.find((node) => String(node.className).includes("use-theme-bg")) || null;
    }
    return null;
  }

  const document = {
    documentElement: html,
    body,
    location: { href: nodes.href || "https://example.com/" },
    querySelector(selector) {
      return findBySelector(selector);
    },
    querySelectorAll(selector) {
      if (selector === "*") {
        return all.filter((node) => node !== html);
      }
      if (selector === "#root > *") {
        const root = byId.get("root");
        return root ? [...root.children] : [];
      }
      if (selector === "#root > *, #entry > *, #main, .main") {
        const collected = [];
        const root = byId.get("root");
        const entry = byId.get("entry");
        if (root) {
          collected.push(...root.children);
        }
        if (entry) {
          collected.push(...entry.children);
        }
        for (const node of all) {
          if (node.id === "main" || node.classList.contains("main")) {
            collected.push(node);
          }
        }
        return collected;
      }
      if (selector === "main, article, section, header, footer, nav, aside") {
        return all.filter((node) => ["MAIN", "ARTICLE", "SECTION", "HEADER", "FOOTER", "NAV", "ASIDE"].includes(node.tagName));
      }
      if (selector.startsWith("[") && selector.includes("data-rosewash")) {
        return all.filter((node) => node.matches(selector));
      }
      return [];
    }
  };

  const window = {
    getComputedStyle(element) {
      return element._computed;
    },
    matchMedia() {
      return { matches: Boolean(nodes.prefersDark) };
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    setTimeout(fn) {
      return 1;
    },
    clearTimeout() {},
    requestAnimationFrame(fn) {
      return 1;
    },
    cancelAnimationFrame() {}
  };

  return { document, window, byId, all };
}

test("engine tints colored and near-white page chrome to base with forced text", async () => {
  const core = await loadCore();
  const { document, window, byId } = createMockDom({
    tree: [
      {
        id: "site-header",
        tag: "header",
        className: "site-header",
        backgroundColor: "rgb(179, 27, 27)",
        color: "rgb(255, 255, 255)",
        children: [
          {
            id: "header-link",
            tag: "a",
            backgroundColor: "rgba(0, 0, 0, 0)",
            color: "rgb(255, 255, 255)"
          }
        ]
      },
      {
        id: "zhihu-header",
        tag: "div",
        className: "AppHeader",
        backgroundColor: "rgb(255, 255, 255)",
        color: "rgb(18, 18, 18)",
        children: [
          {
            id: "zhihu-title",
            tag: "span",
            backgroundColor: "rgba(0, 0, 0, 0)",
            color: "rgb(18, 18, 18)"
          }
        ]
      },
      {
        id: "article-header",
        tag: "main",
        backgroundColor: "rgb(255, 255, 255)",
        color: "rgb(17, 17, 17)",
        children: [
          {
            id: "inner-header",
            tag: "header",
            backgroundColor: "rgb(0, 102, 204)",
            color: "rgb(255, 255, 255)"
          }
        ]
      }
    ]
  });

  const engine = core.createEngine({ document, window });
  const result = engine.apply({ enabled: true, mode: "dawn", disabledHosts: [] });
  assert.equal(result.enabled, true);
  assert.equal(result.theme, "dawn");

  const palette = core.PALETTES.dawn;
  assert.equal(byId.get("site-header").style.getPropertyValue("background-color"), palette.base);
  assert.equal(byId.get("site-header").style.getPropertyPriority("background-color"), "important");
  assert.equal(byId.get("site-header").style.getPropertyValue("color"), palette.text);
  assert.equal(byId.get("site-header").style.getPropertyPriority("color"), "important");
  assert.equal(byId.get("header-link").style.getPropertyValue("color"), palette.text);
  assert.equal(byId.get("header-link").style.getPropertyPriority("color"), "important");

  assert.equal(byId.get("zhihu-header").style.getPropertyValue("background-color"), palette.base);
  assert.equal(byId.get("zhihu-header").style.getPropertyPriority("background-color"), "important");
  assert.equal(byId.get("zhihu-header").style.getPropertyValue("color"), palette.text);
  assert.equal(byId.get("zhihu-title").style.getPropertyPriority("color"), "important");

  // Full cover remaps nested painted boxes too, not only near-white surfaces.
  assert.equal(byId.get("inner-header").style.getPropertyValue("background-color"), palette.surface);
  assert.equal(byId.get("article-header").style.getPropertyValue("background-color"), palette.surface);

  engine.clear();
  assert.equal(byId.get("site-header").style.getPropertyValue("background-color"), "");
  assert.equal(byId.get("site-header").style.getPropertyValue("color"), "");
  assert.equal(byId.get("zhihu-header").style.getPropertyValue("background-color"), "");
});

test("engine rebuilds page chrome membership after restore", async () => {
  const core = await loadCore();
  const { document, window, byId } = createMockDom({
    tree: [
      {
        id: "site-header",
        tag: "header",
        backgroundColor: "rgb(179, 27, 27)",
        color: "rgb(255, 255, 255)",
        children: [
          {
            id: "header-text",
            tag: "span",
            backgroundColor: "rgba(0, 0, 0, 0)",
            color: "rgb(255, 255, 255)"
          }
        ]
      }
    ]
  });

  const engine = core.createEngine({ document, window });
  engine.apply({ enabled: true, mode: "dawn", disabledHosts: [] });
  engine.clear();

  byId.get("site-header")._computed.backgroundColor = "rgba(0, 0, 0, 0)";
  byId.get("site-header")._computed.color = "rgb(17, 17, 17)";
  engine.apply({ enabled: true, mode: "dawn", disabledHosts: [] });

  // Transparent non-shell headers are no longer forced as page chrome.
  assert.equal(byId.get("site-header").style.getPropertyValue("background-color"), "");
  // Full-cover still remaps descendant text (with !important against SPA CSS).
  assert.equal(
    byId.get("header-text").style.getPropertyValue("color"),
    core.PALETTES.dawn.text
  );
  assert.equal(byId.get("header-text").style.getPropertyPriority("color"), "important");
});

test("engine tints default transparent html/body like jmlr-style pages", async () => {
  const core = await loadCore();
  const { document, window } = createMockDom({
    htmlBackgroundColor: "rgba(0, 0, 0, 0)",
    bodyBackgroundColor: "rgba(0, 0, 0, 0)",
    bodyColor: "rgb(0, 0, 0)",
    tree: [
      {
        id: "fixed",
        tag: "div",
        backgroundColor: "rgba(0, 0, 0, 0)",
        color: "rgb(0, 0, 0)",
        children: [
          {
            id: "nav-link",
            tag: "a",
            backgroundColor: "rgba(0, 0, 0, 0)",
            color: "rgb(48, 48, 160)"
          }
        ]
      },
      {
        id: "content",
        tag: "div",
        backgroundColor: "rgba(0, 0, 0, 0)",
        color: "rgb(0, 0, 0)",
        children: [
          {
            id: "heading",
            tag: "h1",
            backgroundColor: "rgba(0, 0, 0, 0)",
            color: "rgb(0, 0, 0)"
          }
        ]
      }
    ]
  });

  const engine = core.createEngine({ document, window });
  const result = engine.apply({ enabled: true, mode: "dawn", disabledHosts: [] });
  assert.equal(result.enabled, true);
  assert.equal(result.theme, "dawn");

  const palette = core.PALETTES.dawn;
  assert.equal(document.documentElement.style.getPropertyValue("background-color"), palette.base);
  assert.equal(document.body.style.getPropertyValue("background-color"), palette.base);
  // Nested transparent boxes stay unset; canvas paint comes from the page roots.
  assert.equal(document.body.children[0].style.getPropertyValue("background-color"), "");
  assert.equal(document.body.children[1].style.getPropertyValue("background-color"), "");
});

test("engine paints transparent known chrome shells with important base fill", async () => {
  const core = await loadCore();
  const { document, window, byId } = createMockDom({
    tree: [
      {
        id: "lean-bar",
        tag: "header",
        className: "LeanAppHeaderBar",
        role: "banner",
        backgroundColor: "rgba(0, 0, 0, 0)",
        color: "rgb(18, 18, 18)",
        children: [
          {
            id: "lean-fill",
            tag: "div",
            backgroundColor: "rgb(255, 255, 255)",
            color: "rgb(18, 18, 18)"
          }
        ]
      }
    ]
  });

  const engine = core.createEngine({ document, window });
  engine.apply({ enabled: true, mode: "dawn", disabledHosts: [] });
  const palette = core.PALETTES.dawn;

  assert.equal(byId.get("lean-bar").style.getPropertyValue("background-color"), palette.base);
  assert.equal(byId.get("lean-bar").style.getPropertyPriority("background-color"), "important");
  assert.equal(byId.get("lean-bar").style.getPropertyPriority("background-image"), "important");
  assert.equal(byId.get("lean-fill").style.getPropertyValue("color"), palette.text);
});

test("engine covers cool paper and dark shells in both themes", async () => {
  const core = await loadCore();
  const { document, window, byId } = createMockDom({
    htmlBackgroundColor: "rgb(238, 242, 246)",
    bodyBackgroundColor: "rgb(238, 242, 246)",
    bodyColor: "rgb(22, 30, 27)",
    rootCssVars: {
      "--ground": "rgb(238, 242, 246)",
      "--ink": "rgb(22, 30, 27)"
    },
    tree: [
      {
        id: "card",
        tag: "main",
        backgroundColor: "rgb(10, 12, 16)",
        color: "rgb(229, 231, 234)",
        children: [
          {
            id: "title",
            tag: "h1",
            backgroundColor: "rgba(0, 0, 0, 0)",
            color: "rgb(229, 231, 234)"
          }
        ]
      }
    ]
  });

  const engine = core.createEngine({ document, window });
  const dawn = core.PALETTES.dawn;
  const moon = core.PALETTES.moon;

  let result = engine.apply({ enabled: true, mode: "dawn", disabledHosts: [] });
  assert.equal(result.theme, "dawn");
  assert.equal(document.documentElement.style.getPropertyValue("background-color"), dawn.base);
  assert.equal(document.body.style.getPropertyValue("background-color"), dawn.base);
  assert.equal(document.body.style.getPropertyValue("color"), dawn.text);
  assert.equal(byId.get("card").style.getPropertyValue("background-color"), dawn.surface);
  assert.equal(byId.get("title").style.getPropertyValue("color"), dawn.text);
  assert.equal(document.documentElement.style.getPropertyValue("--ground"), dawn.base);
  assert.equal(document.documentElement.style.getPropertyValue("--ink"), dawn.text);

  result = engine.apply({ enabled: true, mode: "moon", disabledHosts: [] });
  assert.equal(result.theme, "moon");
  assert.equal(document.documentElement.style.getPropertyValue("background-color"), moon.base);
  assert.equal(byId.get("card").style.getPropertyValue("background-color"), moon.surface);
  assert.equal(byId.get("title").style.getPropertyValue("color"), moon.text);
  assert.equal(document.documentElement.style.getPropertyValue("--ground"), moon.base);
  assert.equal(document.documentElement.style.getPropertyValue("--ink"), moon.text);
});

test("engine adapts nested Substack-like dark publication shells in Dawn", async () => {
  const core = await loadCore();
  const { document, window, byId } = createMockDom({
    htmlBackgroundColor: "rgb(23, 23, 23)",
    htmlColor: "rgb(0, 0, 0)",
    bodyBackgroundColor: "rgba(0, 0, 0, 0)",
    bodyColor: "rgb(54, 55, 55)",
    prefersDark: false,
    rootCssVars: {
      "--web_bg_color": "#171717",
      "--theme_bg_is_dark": "1",
      "--print_on_web_bg_color": "#ffffff"
    },
    tree: [
      {
        id: "entry",
        tag: "div",
        backgroundColor: "rgba(0, 0, 0, 0)",
        color: "rgb(54, 55, 55)",
        children: [
          {
            id: "main",
            tag: "div",
            className: "main typography use-theme-bg",
            backgroundColor: "rgb(23, 23, 23)",
            color: "rgb(255, 255, 255)",
            children: [
              {
                id: "panel",
                tag: "div",
                className: "panel",
                backgroundColor: "rgb(37, 37, 37)",
                color: "rgb(255, 255, 255)"
              }
            ]
          }
        ]
      }
    ]
  });

  const engine = core.createEngine({ document, window });
  const result = engine.apply({ enabled: true, mode: "auto", disabledHosts: [] });
  const palette = core.PALETTES.dawn;

  assert.equal(result.enabled, true);
  assert.equal(result.theme, "dawn");
  assert.equal(engine.stats().pageTone, "dark-only");
  assert.equal(document.documentElement.style.getPropertyValue("background-color"), palette.base);
  assert.equal(byId.get("main").style.getPropertyValue("background-color"), palette.surface);
  assert.equal(byId.get("main").style.getPropertyValue("color"), palette.text);
  assert.equal(byId.get("panel").style.getPropertyValue("background-color"), palette.surface);
  assert.equal(byId.get("panel").style.getPropertyValue("color"), palette.text);
});

test("normalizes settings and blocked hosts", async () => {
  const core = await loadCore();
  assert.deepEqual(plain(core.normalizeSettings({
    enabled: true,
    mode: "moon",
    disabledHosts: [" Example.COM ", ".docs.example.com", "example.com"]
  })), {
    enabled: true,
    mode: "moon",
    disabledHosts: ["docs.example.com", "example.com"]
  });

  assert.equal(core.isHostDisabled("news.example.com", ["example.com"]), true);
  assert.equal(core.isHostDisabled("example.org", ["example.com"]), false);

  assert.deepEqual(plain(core.toggleHostDisabled("Example.COM", [])), ["example.com"]);
  assert.deepEqual(plain(core.toggleHostDisabled("example.com", ["example.com"])), []);
  assert.deepEqual(plain(core.toggleHostDisabled("news.example.com", ["example.com"])), []);
  assert.deepEqual(
    plain(core.toggleHostDisabled("docs.example.com", ["other.org"])),
    ["docs.example.com", "other.org"]
  );
  assert.deepEqual(plain(core.toggleHostDisabled("", ["example.com"])), ["example.com"]);
});
