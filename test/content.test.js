import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

test("startup waits for site policy and storage changes update site layouts", async () => {
  const context = { URL, console };
  context.globalThis = context;
  vm.runInNewContext(await readFile(new URL("../src/content/core.js", import.meta.url), "utf8"), context);
  const core = context.RosewashCore;
  const applied = [];
  const attributes = new Set();
  const properties = new Map();
  const root = {
    hasAttribute: (name) => attributes.has(name),
    toggleAttribute: (name, on) => on ? attributes.add(name) : attributes.delete(name),
    style: {
      setProperty: (name, value) => properties.set(name, value),
      removeProperty: (name) => properties.delete(name)
    }
  };
  const events = {};
  context.document = {
    documentElement: root,
    addEventListener: (name, fn) => { events[name] = fn; },
    dispatchEvent() {}
  };
  context.window = {
    location: { hostname: "x.com" },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener() {}
  };
  context.CustomEvent = class {};
  context.RosewashCore = { ...core, createEngine: () => ({
    apply: (settings) => applied.push(settings), refresh() {}
  }) };
  let releaseStorage;
  let storageChanged;
  let raw = { defaultEnabled: false, xCompactLayout: true };
  const initialRead = new Promise((resolve) => { releaseStorage = resolve; });
  let loaded = false;
  context.chrome = {
    runtime: { id: "test", onMessage: { addListener() {} } },
    storage: {
      sync: { get: () => loaded ? Promise.resolve(raw) : initialRead },
      onChanged: { addListener: (fn) => { storageChanged = fn; } }
    }
  };
  vm.runInNewContext(await readFile(new URL("../src/content/content.js", import.meta.url), "utf8"), context);
  events.DOMContentLoaded();
  assert.equal(applied.length, 0);
  assert.equal(attributes.size, 0);
  loaded = true;
  releaseStorage(raw);
  await new Promise(setImmediate);
  assert.equal(applied.length, 1);
  assert.equal(applied[0].defaultEnabled, false);
  assert.equal(attributes.has("data-rosewash-x-compact"), false);
  raw = { ...raw, enabledHosts: ["x.com"], xSingleColumnWidth: 680 };
  storageChanged({ enabledHosts: { newValue: ["x.com"] } }, "sync");
  await new Promise(setImmediate);
  assert.equal(attributes.has("data-rosewash-x-compact"), true);
  assert.equal(properties.get("--rosewash-x-single"), "680px");
  raw = { ...raw, disabledHosts: ["x.com"] };
  storageChanged({ disabledHosts: { newValue: ["x.com"] } }, "sync");
  await new Promise(setImmediate);
  assert.equal(attributes.has("data-rosewash-x-compact"), false);
  assert.equal(properties.has("--rosewash-x-single"), false);
});
