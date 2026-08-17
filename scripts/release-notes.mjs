import { readFile } from "node:fs/promises";
import { join } from "node:path";

const tag = process.argv[2];
if (!tag) {
  throw new Error("usage: node scripts/release-notes.mjs vX.Y.Z");
}

const version = tag.replace(/^v/, "");
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`Release tags must look like vX.Y.Z, got: ${tag}`);
}

const root = new URL("..", import.meta.url).pathname;
const changelog = await readFile(join(root, "changelog.md"), "utf8");
const heading = new RegExp(`^## ${version.replaceAll(".", "\\.")}(?:[ \\t].*)?$`, "m");
const match = changelog.match(heading);
if (!match) {
  throw new Error(`changelog.md has no section for ${version}`);
}

const start = match.index;
const afterHeading = changelog.slice(start + match[0].length);
const nextHeading = afterHeading.search(/^## /m);
const body = (nextHeading === -1 ? afterHeading : afterHeading.slice(0, nextHeading)).trim();
if (!body) {
  throw new Error(`changelog.md section ${version} is empty`);
}

process.stdout.write(
  [
    `Rosewash v${version}`,
    "",
    "Download the zip, extract it, then Load unpacked the extracted folder",
    "from Chromium developer mode.",
    "",
    body,
    ""
  ].join("\n")
);
