export const browsers = ["chrome", "edge", "firefox"];

export function manifestForBrowser(source, browser) {
  if (!browsers.includes(browser)) throw new Error(`Unknown browser: ${browser}`);
  const manifest = structuredClone(source);
  if (browser === "firefox") {
    // Firefox MV3 uses an event page; core must load before the shared background.
    manifest.background = { scripts: ["src/content/core.js", "src/background/background.js"] };
    manifest.permissions = manifest.permissions.filter((permission) => permission !== "fontSettings");
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
