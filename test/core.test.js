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
});

test("detects harsh near-white backgrounds", async () => {
  const core = await loadCore();
  assert.equal(core.isNearWhiteColor(core.parseColor("rgb(255, 255, 255)")), true);
  assert.equal(core.isNearWhiteColor(core.parseColor("rgb(250, 244, 237)")), true);
  assert.equal(core.isNearWhiteColor(core.parseColor("rgb(240, 230, 210)")), false);
  assert.equal(core.isNearWhiteColor(core.parseColor("rgba(255, 255, 255, 0)")), false);
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

test("turns dark neutral text light in moon mode", async () => {
  const core = await loadCore();
  assert.equal(core.shouldTintTextColor("moon", core.parseColor("rgb(17, 17, 17)"), false), true);
  assert.equal(core.shouldTintTextColor("moon", core.parseColor("#575279"), false), true);
  assert.equal(core.shouldTintTextColor("moon", core.parseColor("#e0def4"), false), false);
  assert.equal(core.shouldTintTextColor("dawn", core.parseColor("rgb(17, 17, 17)"), false), false);
  assert.equal(core.shouldTintTextColor("dawn", core.parseColor("rgb(17, 17, 17)"), true), true);
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
});
