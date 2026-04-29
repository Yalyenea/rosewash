import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const manifestPath = join(root, "manifest.json");
const packagePath = join(root, "package.json");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const pkg = JSON.parse(await readFile(packagePath, "utf8"));

const requiredFiles = [
  "popup.html",
  "options.html",
  ...(manifest.content_scripts?.[0]?.css || []),
  ...(manifest.content_scripts?.[0]?.js || [])
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

if (!manifest.host_permissions?.includes("<all_urls>")) {
  throw new Error("<all_urls> host permission is required for page tinting");
}

const scriptFiles = [
  "src/content/core.js",
  "src/content/content.js",
  "src/popup/popup.js",
  "src/options/options.js",
  "scripts/validate.mjs"
];

for (const file of scriptFiles) {
  const result = spawnSync(process.execPath, ["--check", join(root, file)], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
}

console.log("manifest ok");
