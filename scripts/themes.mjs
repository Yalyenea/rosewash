import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { chromiumThemeManifest, loadCore, themeDirectory } from "./browsers.mjs";

const [flag] = process.argv.slice(2);
if (flag && flag !== "--package") throw new Error(`Unknown option: ${flag}`);
const root = fileURLToPath(new URL("..", import.meta.url));
const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const core = await loadCore();
const destination = join(root, "dist-themes");
await rm(destination, { recursive: true, force: true });
let count = 0;
for (const preset of Object.values(core.PRESETS)) {
  for (const variant of ["light", "dark"]) {
    const palette = preset[variant];
    if (!palette || palette.tint === false) continue;
    const directory = join(destination, themeDirectory(preset.id, variant));
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "manifest.json"),
      JSON.stringify(chromiumThemeManifest(preset, variant, version), null, 2) + "\n"
    );
    count += 1;
  }
}
console.log(`staged dist-themes/ (${count} themes)`);

if (flag === "--package") {
  const archive = join(root, "release", `rosewash-v${version}-chromium-themes.zip`);
  await mkdir(join(root, "release"), { recursive: true });
  await rm(archive, { force: true });
  const result = spawnSync("zip", ["-qr", archive, "."], { cwd: destination, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "Could not create themes archive");
  console.log(archive);
}
