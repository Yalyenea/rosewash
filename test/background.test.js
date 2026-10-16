import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const coreSource = await readFile(new URL("../src/content/core.js", import.meta.url), "utf8");
const backgroundSource = await readFile(new URL("../src/background/background.js", import.meta.url), "utf8");
const flush = () => new Promise(setImmediate);

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function background({ url = "https://x.com/home", messageError = false, beforeSet, notify } = {}) {
  const writes = [];
  const messages = [];
  const errors = [];
  let stored = {};
  let commandListener;
  let messageListener;
  let writeAttempts = 0;
  const icons = [];
  let tabUpdated;
  let storageChanged;
  const extensionUrl = "chrome-extension://test/";
  const context = { URL, console: { error: (...args) => errors.push(args) } };
  context.globalThis = context;
  context.importScripts = () => vm.runInNewContext(coreSource, context);
  context.chrome = {
    runtime: {
      id: "test",
      getURL: (path) => extensionUrl + path,
      onMessage: { addListener: (fn) => { messageListener = fn; } },
      onStartup: { addListener() {} },
      onInstalled: { addListener() {} }
    },
    action: { setIcon: async (details) => { icons.push(structuredClone(details)); } },
    commands: { onCommand: { addListener: (fn) => { commandListener = fn; } } },
    tabs: {
      onUpdated: { addListener: (fn) => { tabUpdated = fn; } },
      query: async () => [{ id: 1, url }],
      sendMessage: async (tabId, message) => {
        messages.push({ tabId, message: structuredClone(message) });
        if (messageError) throw new Error("No receiver");
        if (notify) await notify();
      }
    },
    storage: { onChanged: { addListener: (fn) => { storageChanged = fn; } }, sync: {
      get: async () => structuredClone(stored),
      set: async (next) => {
        await flush();
        if (beforeSet) await beforeSet(++writeAttempts);
        stored = structuredClone(next);
        writes.push(structuredClone(stored));
      },
      remove: async (keys) => { for (const key of keys) delete stored[key]; }
    } }
  };
  vm.runInNewContext(backgroundSource, context);
  const sender = { id: "test", url: extensionUrl + "popup.html" };
  return {
    writes, messages, errors, icons,
    command: (tab, name = "toggle-current-site") => commandListener(name, tab),
    tabUpdated: (tab, changeInfo) => tabUpdated(tab.id, changeInfo, tab),
    storageChanged: () => storageChanged({}, "sync"),
    store: (next) => { stored = structuredClone(next); },
    receiveFrom: (message, from) => new Promise((resolve) => {
      if (!messageListener(message, from, resolve)) resolve(null);
    }),
    receive: (message, sendResponse) => messageListener(message, sender, sendResponse),
    send: (message) => new Promise((resolve) => messageListener(message, sender, resolve)),
    done: () => vm.runInNewContext("settingsQueue", context)
  };
}

function edit(settings, baseline = {}) {
  return { type: "rosewash:edit-settings", baseline, settings };
}

test("shortcut persists each rapid toggle and notifies the command's tab without snapshots", async () => {
  const runtime = background();
  const tab = { id: 7, url: "https://www.zhihu.com/question/123" };
  runtime.command(tab);
  runtime.command(tab);
  await runtime.done();
  assert.equal(runtime.writes.length, 2);
  assert.deepEqual(runtime.writes.map((settings) => settings.disabledHosts), [["www.zhihu.com"], []]);
  assert.deepEqual(runtime.writes[1].enabledHosts, ["www.zhihu.com"]);
  assert.deepEqual(runtime.messages, [
    { tabId: 7, message: { type: "rosewash:settings-updated" } },
    { tabId: 7, message: { type: "rosewash:settings-updated" } }
  ]);
});

test("shortcut ignores protected pages", async () => {
  const runtime = background({ url: "chrome://extensions/" });
  runtime.command();
  await runtime.done();
  assert.equal(runtime.writes.length, 0);
  assert.equal(runtime.messages.length, 0);
});

test("a tab without a content script still retains its shortcut preference", async () => {
  const runtime = background({ messageError: true });
  runtime.command();
  await runtime.done();
  assert.deepEqual(runtime.writes[0].disabledHosts, ["x.com"]);
});

test("accepted popup saves finish in order after the sender closes without consuming replies", async () => {
  const firstWrite = deferred();
  const runtime = background({ beforeSet: (attempt) => attempt === 1 ? firstWrite.promise : undefined });
  // A closed popup has no receiver for the callback's return value or response.
  const closedPopupResponse = () => {};
  assert.equal(runtime.receive(edit({ appearance: "dark" }), closedPopupResponse), true);
  assert.equal(runtime.receive(edit({ xCompactLayout: true }), closedPopupResponse), true);
  await flush();
  assert.equal(runtime.writes.length, 0);
  firstWrite.resolve();
  await runtime.done();
  assert.equal(runtime.writes.length, 2);
  assert.equal(runtime.writes[0].appearance, "dark");
  assert.equal(runtime.writes[0].xCompactLayout, false);
  assert.equal(runtime.writes[1].appearance, "dark");
  assert.equal(runtime.writes[1].xCompactLayout, true);
});

test("unanswered tab notifications do not delay another save or its acknowledgement", async () => {
  const notification = deferred();
  const runtime = background({ notify: () => notification.promise });
  const first = await runtime.send(edit({ appearance: "dark" }));
  assert.equal(first.ok, true);
  await flush();
  assert.equal(runtime.messages.length, 1);
  const second = await runtime.send(edit({ xCompactLayout: true }));
  assert.equal(second.ok, true);
  assert.equal(runtime.writes.length, 2);
  assert.equal(second.settings.appearance, "dark");
  assert.equal(second.settings.xCompactLayout, true);
  notification.resolve();
  await flush();
});

test("popup edits and shortcuts share a queue and preserve each other's settings", async () => {
  const runtime = background();
  const popupSave = runtime.send(edit({ appearance: "dark" }));
  runtime.command({ id: 7, url: "https://x.com/home" });
  const nextPopupSave = runtime.send(edit({ xSingleColumnWidth: 680 }));
  await runtime.done();
  assert.equal((await popupSave).ok, true);
  assert.equal((await nextPopupSave).ok, true);
  assert.equal(runtime.writes.length, 3);
  assert.equal(runtime.writes[0].appearance, "dark");
  assert.deepEqual(runtime.writes[1].disabledHosts, ["x.com"]);
  assert.equal(runtime.writes[1].appearance, "dark");
  assert.deepEqual(runtime.writes[2].disabledHosts, ["x.com"]);
  assert.equal(runtime.writes[2].appearance, "dark");
  assert.equal(runtime.writes[2].xSingleColumnWidth, 680);
});

test("a failed save responds with its error and does not block the next save", async () => {
  const runtime = background({ beforeSet: (attempt) => {
    if (attempt === 1) throw new Error("Storage write failed");
  } });
  const failed = runtime.send(edit({ appearance: "dark" }));
  const next = runtime.send(edit({ xCompactLayout: true }));
  assert.deepEqual(structuredClone(await failed), { ok: false, error: "Storage write failed" });
  const response = await next;
  await runtime.done();
  assert.equal(response.ok, true);
  assert.equal(runtime.writes.length, 1);
  assert.equal(runtime.writes[0].appearance, "auto");
  assert.equal(runtime.writes[0].xCompactLayout, true);
  assert.equal(runtime.errors.length, 1);
  assert.equal(runtime.messages.length, 1);
});

test("global shortcut pauses and resumes Rosewash and notifies every tab", async () => {
  const runtime = background();
  runtime.command(undefined, "toggle-enabled");
  runtime.command(undefined, "toggle-enabled");
  await runtime.done();
  assert.deepEqual(runtime.writes.map((settings) => settings.enabled), [false, true]);
  await flush();
  assert.equal(runtime.messages.length, 2);
});

test("picker saves take the site from the sender's top-frame tab", async () => {
  const runtime = background();
  const tab = { id: 4, url: "https://news.example.com/story" };
  const selector = "#comments > div.card";
  const saved = await runtime.receiveFrom({ type: "rosewash:ignore-element", selector, host: "evil.com" },
    { id: "test", tab, frameId: 0, url: tab.url });
  assert.equal(saved.ok, true);
  assert.deepEqual(runtime.writes.at(-1).ignoredElements, { "news.example.com": [selector] });
  for (const sender of [{ id: "test", tab, frameId: 3 }, { id: "other", tab, frameId: 0 }]) {
    assert.equal(await runtime.receiveFrom({ type: "rosewash:ignore-element", selector: "p" }, sender), null);
  }
  assert.equal(runtime.writes.length, 1);
});

test("toolbar icon is gray when the tab's site is off, paused, or protected", async () => {
  const runtime = background();
  runtime.store({ disabledHosts: ["blocked.com"] });
  const icon = async (url) => {
    runtime.tabUpdated({ id: 9, url }, { url });
    await flush();
    await flush();
    return runtime.icons.at(-1).path[16];
  };
  assert.equal(await icon("https://example.com/"), "/icons/icon-16.png");
  assert.equal(await icon("https://docs.blocked.com/"), "/icons/icon-off-16.png");
  assert.equal(await icon("chrome://extensions/"), "/icons/icon-off-16.png");
  runtime.store({ enabled: false });
  assert.equal(await icon("https://example.com/"), "/icons/icon-off-16.png");
});
