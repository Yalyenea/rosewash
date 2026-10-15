import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const coreSource = await readFile(new URL("../src/content/core.js", import.meta.url), "utf8");
const backgroundSource = await readFile(new URL("../src/background/background.js", import.meta.url), "utf8");

function background({ url = "https://x.com/home", messageError = false } = {}) {
  const writes = [];
  const messages = [];
  let stored = {};
  let listener;
  const context = { URL, console };
  context.globalThis = context;
  context.importScripts = () => vm.runInNewContext(coreSource, context);
  context.chrome = {
    commands: { onCommand: { addListener: (fn) => { listener = fn; } } },
    tabs: {
      query: async () => [{ id: 1, url }],
      sendMessage: async (tabId, message) => {
        messages.push({ tabId, message });
        if (messageError) throw new Error("No receiver");
      }
    },
    storage: { sync: {
      get: async () => structuredClone(stored),
      set: async (next) => {
        await new Promise(setImmediate);
        stored = structuredClone(next);
        writes.push(stored);
      }
    } }
  };
  vm.runInNewContext(backgroundSource, context);
  return {
    writes, messages,
    command: (tab) => listener("toggle-current-site", tab),
    done: () => vm.runInNewContext("toggleQueue", context)
  };
}

test("shortcut persists and directly applies each rapid toggle to the command's tab", async () => {
  const runtime = background();
  const tab = { id: 7, url: "https://www.zhihu.com/question/123" };
  runtime.command(tab);
  runtime.command(tab);
  await runtime.done();
  assert.equal(runtime.writes.length, 2);
  assert.deepEqual(runtime.writes.map((settings) => settings.disabledHosts), [["www.zhihu.com"], []]);
  assert.deepEqual(runtime.writes[1].enabledHosts, ["www.zhihu.com"]);
  assert.deepEqual(runtime.messages.map(({ tabId }) => tabId), [7, 7]);
  assert.equal(runtime.messages[0].message.type, "rosewash:settings-updated");
  assert.deepEqual(structuredClone(runtime.messages[0].message.settings), runtime.writes[0]);
  assert.deepEqual(structuredClone(runtime.messages[1].message.settings), runtime.writes[1]);
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
