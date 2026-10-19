import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { archiveName, distDirectory, manifestForBrowser } from "./browsers.mjs";

const [browser = "chrome", flag] = process.argv.slice(2);
if (flag && flag !== "--package") throw new Error(`Unknown option: ${flag}`);
const root = fileURLToPath(new URL("..", import.meta.url));
const source = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
const manifest = manifestForBrowser(source, browser);
const directory = distDirectory(browser);
const destination = join(root, directory);
await rm(destination, { recursive: true, force: true });
await mkdir(join(destination, "icons"), { recursive: true });
for (const file of ["popup.html", "options.html", "src"]) {
  await cp(join(root, file), join(destination, file), {
    recursive: true, filter: (path) => !path.endsWith(".DS_Store")
  });
}
for (const icon of await readdir(join(root, "icons"))) {
  if (icon.endsWith(".png")) await cp(join(root, "icons", icon), join(destination, "icons", icon));
}
await writeFile(join(destination, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`staged ${directory}/ (${browser})`);

if (flag === "--package") {
  const archive = join(root, "release", archiveName(manifest.version, browser));
  await mkdir(join(root, "release"), { recursive: true });
  await rm(archive, { force: true });
  const result = spawnSync("zip", ["-qr", archive, "."], { cwd: destination, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "Could not create extension archive");
  console.log(archive);
}
