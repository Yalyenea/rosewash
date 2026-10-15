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
    apply: (settings) => applied.push(settings), refresh() {}, stats: () => ({})
  }) };
  let releaseStorage;
  let storageChanged;
  let messageReceived;
  let pendingRead;
  let raw = { defaultEnabled: false, xCompactLayout: true };
  const initialRead = new Promise((resolve) => { releaseStorage = resolve; });
  let loaded = false;
  context.chrome = {
    runtime: { id: "test", onMessage: { addListener: (fn) => { messageReceived = fn; } } },
    storage: {
      sync: { get: () => pendingRead || (loaded ? Promise.resolve(raw) : initialRead) },
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

  // A slow read from a previous change must not undo a directly delivered toggle.
  let releaseOldRead;
  pendingRead = new Promise((resolve) => { releaseOldRead = resolve; });
  storageChanged({ disabledHosts: { newValue: ["x.com"] } }, "sync");
  const latest = { ...raw, disabledHosts: [], enabledHosts: ["x.com"] };
  messageReceived({ type: "rosewash:settings-updated", settings: latest }, {}, () => {});
  assert.equal(attributes.has("data-rosewash-x-compact"), true);
  releaseOldRead(raw);
  await new Promise(setImmediate);
  assert.equal(attributes.has("data-rosewash-x-compact"), true);
  assert.equal(applied.at(-1).disabledHosts.length, 0);

  // Overlapping storage reads must also finish in change order, not read order.
  pendingRead = new Promise((resolve) => { releaseOldRead = resolve; });
  storageChanged({ enabledHosts: { newValue: [] } }, "sync");
  pendingRead = Promise.resolve(raw);
  storageChanged({ disabledHosts: { newValue: ["x.com"] } }, "sync");
  await new Promise(setImmediate);
  assert.equal(attributes.has("data-rosewash-x-compact"), false);
  releaseOldRead(latest);
  await new Promise(setImmediate);
  assert.equal(attributes.has("data-rosewash-x-compact"), false);
});
