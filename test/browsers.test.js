import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { archiveName, distDirectory, manifestForBrowser } from "../scripts/browsers.mjs";

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));

test("browser manifests retain shared content while using the correct background and permissions", () => {
  for (const browser of ["chrome", "edge", "firefox"]) {
    const target = manifestForBrowser(manifest, browser);
    assert.deepEqual(target.content_scripts, manifest.content_scripts);
    assert.deepEqual(target.host_permissions, manifest.host_permissions);
    assert.equal(target.version, manifest.version);
    if (browser === "firefox") {
      assert.equal(target.background.service_worker, undefined);
      assert.deepEqual(target.background.scripts, ["src/content/core.js", "src/background/background.js"]);
      assert.deepEqual(target.permissions, ["storage"]);
      assert.equal(target.browser_specific_settings.gecko.strict_min_version, "148.0");
      assert.ok(target.browser_specific_settings.gecko.id);
    } else assert.deepEqual(target, manifest);
  }
  assert.deepEqual(manifest.permissions, ["storage", "fontSettings"]);
  assert.ok(manifest.background.service_worker);
});

test("browser packages have isolated directories and cannot overwrite each other", () => {
  assert.deepEqual(["chrome", "edge", "firefox"].map(distDirectory), ["dist", "dist-edge", "dist-firefox"]);
  assert.deepEqual(["chrome", "edge", "firefox"].map((browser) => archiveName("1.2.3", browser)),
    ["rosewash-v1.2.3.zip", "rosewash-v1.2.3-edge.zip", "rosewash-v1.2.3-firefox.zip"]);
  assert.throws(() => manifestForBrowser(manifest, "../firefox"), /Unknown browser/);
  assert.throws(() => distDirectory("../firefox"), /Unknown browser/);
});
