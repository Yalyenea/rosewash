import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/content/picker.js", import.meta.url), "utf8");

function picker({ holdRead = false, failRead = false } = {}) {
  const listeners = new Map();
  const overlays = new Set();
  let receive, releaseRead, releaseSave;
  let writes = 0;
  const document = {
    activeElement: { isConnected: true, focus() { document.activeElement = this; } },
    documentElement: { append(host) { overlays.add(host); } },
    createElement() {
      const parts = Object.fromEntries([".box", ".tip", ".selector", ".hint"].map((key) => [key, { style: {} }]));
      return {
        style: { setProperty() {} }, setAttribute() {},
        attachShadow: () => ({ querySelector: (key) => parts[key] }),
        focus() { document.activeElement = this; },
        remove() { overlays.delete(this); }
      };
    }
  };
  const window = {
    focus() {}, matchMedia: () => ({ matches: false }),
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); }
  };
  window.top = window;
  vm.runInNewContext(source, {
    window, document,
    RosewashCore: {
      plainSettings: (value) => value,
      PALETTES: { test: {} }, resolveSettingsThemeKey: () => "test",
      selectorForElement: () => "#target"
    },
    chrome: {
      storage: { sync: { async get() {
        if (holdRead) await new Promise((resolve) => { releaseRead = resolve; });
        if (failRead) throw new Error("Storage unavailable");
        return {};
      } } },
      runtime: {
        id: "rosewash", onMessage: { addListener(listener) { receive = listener; } },
        async sendMessage() { writes++; return new Promise((resolve) => { releaseSave = resolve; }); }
      }
    }
  });
  const emit = (type, values = {}) => {
    const event = { preventDefault() {}, stopImmediatePropagation() {}, ...values };
    return Promise.all([...(listeners.get(type) || [])].map((listener) => listener(event)));
  };
  return {
    document, overlays, listeners,
    start: () => new Promise((resolve) => receive({ type: "rosewash:start-picker" }, { id: "rosewash" }, resolve)),
    escape: () => emit("keydown", { key: "Escape" }),
    click: () => emit("click"),
    point: (element) => emit("pointermove", { composedPath: () => [element] }),
    releaseRead: () => releaseRead(), releaseSave: () => releaseSave({ ok: false, error: "Save failed" }),
    writes: () => writes
  };
}

test("picker takes focus from an iframe and Esc removes interception without saving", async () => {
  const ui = picker();
  const previous = ui.document.activeElement;
  assert.equal((await ui.start()).ok, true);
  assert.notEqual(ui.document.activeElement, previous);
  assert.equal(ui.overlays.size, 1);
  await ui.escape();
  assert.equal(ui.overlays.size, 0);
  assert.equal(ui.document.activeElement, previous);
  assert.equal([...ui.listeners.values()].every((items) => items.size === 0), true);
  assert.equal(ui.writes(), 0);
  assert.equal((await ui.start()).ok, true);
  await ui.escape();
  assert.equal(ui.overlays.size, 0);
});

test("Esc during picker startup prevents the overlay appearing after storage resolves", async () => {
  const ui = picker({ holdRead: true });
  const started = ui.start();
  await ui.escape();
  ui.releaseRead();
  await started;
  assert.equal(ui.overlays.size, 0);
  assert.equal(ui.writes(), 0);
});

test("Esc during a save stays closed when the pending save fails", async () => {
  const ui = picker();
  await ui.start();
  await ui.point({ nodeType: 1, getBoundingClientRect: () => ({}), getRootNode: () => ({}) });
  const saving = ui.click();
  await ui.escape();
  ui.releaseSave();
  await saving;
  assert.equal(ui.overlays.size, 0);
  assert.equal(ui.writes(), 1);
});

test("picker reports storage startup failure and releases its listeners", async () => {
  const ui = picker({ failRead: true });
  const response = await ui.start();
  assert.equal(response.ok, false);
  assert.equal(response.error, "Storage unavailable");
  assert.equal([...ui.listeners.values()].every((items) => items.size === 0), true);
});
