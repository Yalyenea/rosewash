import { readFile } from "node:fs/promises";
import vm from "node:vm";

export const browsers = ["chrome", "edge", "firefox"];

export async function loadCore() {
  const source = await readFile(new URL("../src/content/core.js", import.meta.url), "utf8");
  const context = { URL };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return context.RosewashCore;
}

export function manifestForBrowser(source, browser) {
  if (!browsers.includes(browser)) throw new Error(`Unknown browser: ${browser}`);
  const manifest = structuredClone(source);
  if (browser === "firefox") {
    // Firefox MV3 uses an event page; core must load before the shared background.
    manifest.background = { scripts: ["src/content/core.js", "src/background/background.js"] };
    manifest.permissions = manifest.permissions
      .filter((permission) => permission !== "fontSettings")
      .concat("theme");
    manifest.browser_specific_settings = {
      gecko: {
        id: "rosewash@rosewash",
        // ancestorOrigins arrived in 148; Navigation API arrived in 147.
        strict_min_version: "148.0",
        data_collection_permissions: { required: ["none"] }
      }
    };
  }
  return manifest;
}

export function distDirectory(browser) {
  if (!browsers.includes(browser)) throw new Error(`Unknown browser: ${browser}`);
  return browser === "chrome" ? "dist" : `dist-${browser}`;
}

export function archiveName(version, browser) {
  if (!browsers.includes(browser)) throw new Error(`Unknown browser: ${browser}`);
  return `rosewash-v${version}${browser === "chrome" ? "" : `-${browser}`}.zip`;
}

export function themeDirectory(presetId, variant) {
  return `rosewash-${presetId}-${variant}`;
}

// Chromium themes cannot follow settings, so each tinted preset ships as a
// static package. Colors use [r, g, b] channels from the palette hex tokens.
export function chromiumThemeManifest(preset, variant, version) {
  const rgb = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  const { base, overlay, muted, text, link } = preset[variant];
  return {
    manifest_version: 3,
    name: `Rosewash ${preset.label} ${variant === "light" ? "Light" : "Dark"}`,
    version,
    description: "Browser frame matching the Rosewash page palette.",
    theme: {
      colors: {
        frame: rgb(base),
        frame_inactive: rgb(base),
        background_tab: rgb(base),
        background_tab_inactive: rgb(base),
        toolbar: rgb(base),
        ntp_background: rgb(base),
        tab_text: rgb(text),
        toolbar_text: rgb(text),
        toolbar_button_icon: rgb(text),
        bookmark_text: rgb(text),
        omnibox_text: rgb(text),
        ntp_text: rgb(text),
        tab_background_text: rgb(muted),
        tab_background_text_inactive: rgb(muted),
        omnibox_background: rgb(overlay),
        ntp_link: rgb(link)
      }
    }
  };
}
