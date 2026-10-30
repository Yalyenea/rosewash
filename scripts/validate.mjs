import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { browsers, manifestForBrowser } from "./browsers.mjs";

const root = new URL("..", import.meta.url).pathname;
const manifestPath = join(root, "manifest.json");
const packagePath = join(root, "package.json");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const pkg = JSON.parse(await readFile(packagePath, "utf8"));

const requiredFiles = [
  "popup.html",
  "options.html",
  ...(manifest.background?.service_worker ? [manifest.background.service_worker] : []),
  ...browsers.flatMap((browser) => manifestForBrowser(manifest, browser).background.scripts || []),
  ...Object.values(manifest.icons || {}),
  ...Object.values(manifest.action?.default_icon || {}),
  ...(manifest.content_scripts || []).flatMap((entry) => [
    ...(entry.css || []),
    ...(entry.js || [])
  ])
];

const missing = requiredFiles.filter((file) => !existsSync(join(root, file)));
if (missing.length > 0) {
  throw new Error(`Missing manifest files: ${missing.join(", ")}`);
}

if (manifest.manifest_version !== 3) {
  throw new Error("manifest_version must be 3");
}

if (manifest.version !== pkg.version) {
  throw new Error(`Version mismatch: manifest ${manifest.version}, package ${pkg.version}`);
}

if (!manifest.permissions.includes("storage")) {
  throw new Error("storage permission is required");
}

if (!manifest.permissions.includes("fontSettings")) {
  throw new Error("fontSettings permission is required for automatic system font lists");
}

if (!manifest.host_permissions?.includes("<all_urls>")) {
  throw new Error("<all_urls> host permission is required for page tinting");
}

const scriptFiles = [
  "src/content/core.js",
  "src/content/content.js",
  "src/background/background.js",
  "src/popup/popup.js",
  "src/options/options.js",
  "src/settings/fonts.js",
  ...(manifest.content_scripts || []).flatMap((entry) => entry.js || []),
  "scripts/validate.mjs",
  "scripts/browsers.mjs",
  "scripts/dist.mjs",
  "scripts/themes.mjs",
  "scripts/release-notes.mjs",
  "scripts/upload-chrome.mjs",
  "scripts/upload-edge.mjs",
  "scripts/upload-firefox.mjs"
].filter((file, index, files) => files.indexOf(file) === index);

for (const command of ["toggle-current-site", "toggle-enabled"]) {
  if (!manifest.commands?.[command]?.suggested_key?.default) {
    throw new Error(`${command} command with suggested_key.default is required`);
  }
}

const iconStates = ["", "-off"].flatMap((state) => [16, 32, 48, 128].map((size) => `icons/icon${state}-${size}.png`));
const missingIcons = iconStates.filter((file) => !existsSync(join(root, file)));
if (missingIcons.length > 0) {
  throw new Error(`Missing toolbar icons: ${missingIcons.join(", ")}`);
}

if (!manifest.background?.service_worker) {
  throw new Error("background.service_worker is required for keyboard commands");
}

for (const file of scriptFiles) {
  const result = spawnSync(process.execPath, ["--check", join(root, file)], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
}

console.log("manifest ok");
for (const browser of browsers) {
  const target = manifestForBrowser(manifest, browser);
  if (browser === "firefox") {
    if (target.background.service_worker || target.permissions.includes("fontSettings")
      || !target.permissions.includes("theme")) {
      throw new Error("Firefox must use background scripts with theme and without fontSettings");
    }
    if (!target.browser_specific_settings?.gecko?.id) throw new Error("Firefox requires a stable extension ID");
  } else if (!target.background.service_worker) {
    throw new Error(`${browser} requires a background service worker`);
  }
  console.log(`${browser} manifest ok`);
}
