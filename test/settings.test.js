import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const settle = () => new Promise(setImmediate);
const plain = (value) => JSON.parse(JSON.stringify(value));
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function settingsUI(page, initial = {}, browser = "chrome") {
  const elements = new Map();
  const radios = [];
  class Element {
    constructor() {
      this.value = "";
      this._checked = false;
      this.disabled = false;
      this.options = [];
      this.children = [];
      this.dataset = {};
      this.attributes = {};
      this.listeners = {};
      this.style = { setProperty() {} };
      this.classList = { toggle() {} };
    }
    get checked() { return this._checked; }
    set checked(value) {
      if (value && radios.includes(this)) for (const radio of radios) radio._checked = false;
      this._checked = value;
    }
    addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
    emit(name) { return Promise.all((this.listeners[name] || []).map((listener) => listener())); }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name]; }
    replaceWith(next) { elements.set(`#${this.id}`, next); }
    removeAttribute(name) { delete this.attributes[name]; }
    replaceChildren(...children) { this.options = children; this.children = children; }
    add(option) { this.options.push(option); }
    appendChild(child) { this.children.push(child); }
    querySelectorAll() { return this.children; }
  }
  const element = (id) => {
    if (!elements.has(id)) {
      const next = new Element();
      next.id = id.replace(/^#/, "");
      elements.set(id, next);
    }
    return elements.get(id);
  };
  const appearanceButtons = ["auto", "light", "dark"].map((appearance) => {
    const button = element(`button-${appearance}`);
    button.dataset.appearance = appearance;
    const radio = element(`radio-${appearance}`);
    radio.value = appearance;
    radios.push(radio);
    return button;
  });
  const changed = [];
  const messages = [];
  const writes = [];
  const requests = [];
  const openedTabs = [];
  const windowListeners = new Map();
  let messageListener;
  let closed = false;
  let raw = plain(initial);
  let nextRead;
  let nextWrite;
  let nextBroadcast;
  const storage = {
    async get() {
      const snapshot = plain(raw);
      if (nextRead) {
        const hold = nextRead;
        nextRead = null;
        await hold.promise;
      }
      return snapshot;
    },
    async set(values) {
      writes.push(plain(values));
      if (nextWrite) {
        const hold = nextWrite;
        nextWrite = null;
        await hold.promise;
      }
      const changes = Object.fromEntries(Object.entries(values).filter(([key, value]) =>
        JSON.stringify(raw[key]) !== JSON.stringify(value)).map(([key, newValue]) => [key, { newValue }]));
      raw = { ...raw, ...plain(values) };
      if (Object.keys(changes).length) for (const listener of changed) listener(changes, "sync");
    },
    async remove(keys) {
      const changes = {};
      for (const key of keys) if (key in raw) { changes[key] = { oldValue: raw[key] }; delete raw[key]; }
      if (Object.keys(changes).length) for (const listener of changed) listener(changes, "sync");
    }
  };
  const document = {
    documentElement: new Element(), fonts: { add() {}, delete() {} },
    addEventListener() {}, createElement: () => new Element(),
    querySelectorAll: (query) => query === "[data-appearance]" ? appearanceButtons : query === "input[name='appearance']" ? radios : [],
    querySelector(query) {
      if (query === "input[name='appearance']:checked") return radios.find((radio) => radio.checked);
      if (query.startsWith("input[name='appearance'][value=")) return element(`radio-${query.match(/value='([^']+)'/)[1]}`);
      return element(query);
    }
  };
  const tabs = {
    async create(details) { openedTabs.push(details); },
    async query(query) {
      if (!query.active && nextBroadcast) {
        const hold = nextBroadcast;
        nextBroadcast = null;
        await hold.promise;
      }
      return [{ id: 1, url: "https://example.com/" }];
    },
    async sendMessage(_id, message) { messages.push(plain(message)); }
  };
  const runtime = {
    id: "test-extension",
    getURL: (path) => `${browser === "firefox" ? "moz-extension" : "chrome-extension"}://test-extension/${path}`,
    onMessage: { addListener: (listener) => { messageListener = listener; } },
    onStartup: { addListener() {} },
    onInstalled: { addListener() {} }
  };
  const backgroundContext = vm.createContext({
    URL, console,
    chrome: {
      runtime, tabs: { ...tabs, onUpdated: { addListener() {} } },
      storage: { sync: storage, onChanged: { addListener() {} } },
      action: { setIcon: async () => {} },
      commands: { onCommand: { addListener() {} } }
    }
  });
  backgroundContext.importScripts = () => vm.runInContext(source("src/content/core.js"), backgroundContext);
  vm.runInContext(source("src/background/background.js"), backgroundContext);
  const context = vm.createContext({
    URL, console, document, navigator: { userAgent: browser === "edge" ? "Edg/150.0" : "Firefox/150.0" },
    Option: class { constructor(label, value) { this.text = label; this.value = value; } },
    window: {
      matchMedia: () => ({ matches: false, addEventListener() {} }),
      addEventListener(name, listener) {
        if (!windowListeners.has(name)) windowListeners.set(name, []);
        windowListeners.get(name).push(listener);
      }, clearTimeout() {}, setTimeout() { return 1; },
      FontFace: class { constructor(family) { this.family = family; } async load() { return this; } }
    },
    chrome: {
      storage: { sync: storage, onChanged: { addListener: (listener) => changed.push(listener) } },
      commands: { getAll: async () => [] },
      ...(browser === "firefox" ? {} : { fontSettings: { getFontList: async () => [] } }),
      runtime: { getURL: runtime.getURL, sendMessage(message) {
        requests.push(plain(message));
        return new Promise((resolve) => messageListener(plain(message), {
          id: runtime.id, url: runtime.getURL(`${page}.html`)
        }, (response) => { if (!closed) resolve(plain(response)); }));
      } },
      tabs
    }
  });
  for (const path of ["src/content/core.js", "src/settings/fonts.js", `src/${page}/${page}.js`]) {
    vm.runInContext(source(path), context);
  }
  await settle();
  return {
    element, messages, writes, storage, requests, openedTabs,
    change: (query = "#enabled") => element(query).emit("change"),
    emitWindow: (name) => (windowListeners.get(name) || []).forEach((listener) => listener()),
    raw: () => plain(raw),
    close() { closed = true; changed.length = 0; },
    done: () => vm.runInContext("settingsQueue", backgroundContext),
    holdRead() { return (nextRead = deferred()); },
    holdWrite() { return (nextWrite = deferred()); },
    holdBroadcast() { return (nextBroadcast = deferred()); }
  };
}

test("popup persists subsequent edits without waiting for an earlier broadcast", async () => {
  const ui = await settingsUI("popup", { appearance: "auto" });
  const held = ui.holdBroadcast();
  const dark = ui.element("button-dark").emit("click");
  await settle();
  const light = ui.element("button-light").emit("click");
  ui.element("#enabled").checked = false;
  const paused = ui.element("#enabled").emit("change");
  await settle();
  assert.equal(ui.raw().appearance, "light");
  assert.equal(ui.element("button-light").attributes["aria-pressed"], "true");
  assert.equal(ui.element("#enabled").checked, false);
  held.resolve();
  await Promise.all([dark, light, paused]);
  assert.deepEqual(ui.writes.map((settings) => settings.appearance), ["dark", "light", "light"]);
  assert.equal(ui.raw().appearance, "light");
  assert.equal(ui.raw().enabled, false);
  assert.ok(ui.messages.every((message) => message.type === "rosewash:settings-updated" && !message.settings));
});

test("popup sends all edits to the background before closing during a pending save", async () => {
  const ui = await settingsUI("popup", { appearance: "auto", enabled: true });
  const write = ui.holdWrite();
  ui.element("button-dark").emit("click");
  await settle();
  ui.element("#enabled").checked = false;
  ui.element("#enabled").emit("change");
  assert.equal(ui.requests.length, 2);
  ui.close();
  write.resolve();
  await ui.done();
  assert.equal(ui.raw().appearance, "dark");
  assert.equal(ui.raw().enabled, false);
  assert.deepEqual(ui.writes.map((settings) => settings.enabled), [true, false]);
});

test("popup discards a storage read that predates local edits", async () => {
  const ui = await settingsUI("popup", { appearance: "auto" });
  const held = ui.holdRead();
  await ui.storage.set({ appearance: "dark", fontEnglish: "Georgia" });
  const light = ui.element("button-light").emit("click");
  ui.element("#enabled").checked = false;
  const paused = ui.element("#enabled").emit("change");
  held.resolve();
  await Promise.all([light, paused]);
  assert.equal(ui.raw().appearance, "light");
  assert.equal(ui.raw().enabled, false);
  assert.equal(ui.raw().fontEnglish, "Georgia");
  assert.equal(ui.element("button-light").attributes["aria-pressed"], "true");
});

test("popup keeps pending edits when the preceding write emits onChanged", async () => {
  const ui = await settingsUI("popup", { appearance: "auto" });
  const write = ui.holdWrite();
  const broadcast = ui.holdBroadcast();
  const dark = ui.element("button-dark").emit("click");
  await settle();
  const light = ui.element("button-light").emit("click");
  write.resolve();
  await settle();
  assert.equal(ui.raw().appearance, "light");
  assert.equal(ui.element("button-light").attributes["aria-pressed"], "true");
  broadcast.resolve();
  await Promise.all([dark, light]);
  assert.equal(ui.raw().appearance, "light");
});

test("classic popup site button toggles explicit policy without changing other sites", async () => {
  const ui = await settingsUI("popup", { defaultEnabled: false, disabledHosts: ["other.com"] });
  assert.equal(ui.element("#site-toggle").textContent, "Blocked");
  await ui.element("#site-toggle").emit("click");
  await ui.done();
  await settle();
  assert.deepEqual(ui.raw().enabledHosts, ["example.com"]);
  assert.deepEqual(ui.raw().disabledHosts, ["other.com"]);
  assert.equal(ui.element("#site-toggle").textContent, "Allowed");
  await ui.element("#site-toggle").emit("click");
  await ui.done();
  await settle();
  assert.deepEqual(ui.raw().enabledHosts, []);
  assert.deepEqual(ui.raw().disabledHosts, ["example.com", "other.com"]);
  assert.equal(ui.element("#site-toggle").textContent, "Blocked");
});

test("classic popup reports global pause and disables element picking", async () => {
  const ui = await settingsUI("popup", { enabled: false });
  assert.equal(ui.element("#site-toggle").textContent, "Paused");
  assert.equal(ui.element("#pick-element").disabled, true);
});

test("options saves only edited fields and retains settings changed by another UI", async () => {
  const ui = await settingsUI("options", { enabled: true, disabledHosts: [] });
  await ui.storage.set({ disabledHosts: ["example.com"], enabledHosts: ["other.com"], appearance: "dark", fontEnglish: "Georgia" });
  ui.element("#enabled").checked = false;
  await ui.change();
  assert.equal(ui.raw().enabled, false);
  assert.deepEqual(ui.raw().disabledHosts, ["example.com"]);
  assert.deepEqual(ui.raw().enabledHosts, ["other.com"]);
  assert.equal(ui.raw().appearance, "dark");
  assert.equal(ui.raw().fontEnglish, "Georgia");
});

test("options dispatches rapid reversals before closing while an earlier save is pending", async () => {
  const ui = await settingsUI("options", { enabled: true });
  const held = ui.holdWrite();
  ui.element("#enabled").checked = false;
  ui.change();
  await settle();
  ui.element("#enabled").checked = true;
  ui.change();
  assert.equal(ui.requests.length, 2);
  ui.close();
  held.resolve();
  await ui.done();
  assert.deepEqual(ui.writes.map((settings) => settings.enabled), [false, true]);
  assert.equal(ui.raw().enabled, true);
});

test("options flushes pending domain input when leaving the page", async () => {
  const ui = await settingsUI("options");
  ui.element("#disabled-hosts").value = "later.com";
  await ui.element("#disabled-hosts").emit("input");
  assert.equal(ui.requests.length, 0);
  ui.emitWindow("pagehide");
  assert.equal(ui.requests.length, 1);
  ui.close();
  await ui.done();
  assert.deepEqual(ui.raw().disabledHosts, ["later.com"]);
});

test("options merges host additions and removals with external rule changes", async () => {
  const ui = await settingsUI("options", { disabledHosts: ["remove.com", "unchanged.com"], enabledHosts: ["old.com"] });
  await ui.storage.set({ disabledHosts: ["external.com", "remove.com"], enabledHosts: ["external-on.com", "old.com"] });
  ui.element("#disabled-hosts").value = "unchanged.com\nadded.com";
  ui.element("#enabled-hosts").value = "new.com";
  await ui.change();
  assert.deepEqual(ui.raw().disabledHosts, ["added.com", "external.com"]);
  assert.deepEqual(ui.raw().enabledHosts, ["external-on.com", "new.com"]);
  assert.equal(ui.element("#disabled-hosts").value, "unchanged.com\nadded.com");
  await ui.storage.set({ disabledHosts: ["added.com", "external.com", "later.com"] });
  ui.element("#enabled").checked = false;
  await ui.change();
  assert.deepEqual(ui.raw().disabledHosts, ["added.com", "external.com", "later.com"]);
});

test("options retains edits made while saving and writes them on the next save", async () => {
  const ui = await settingsUI("options", { enabled: true });
  const held = ui.holdRead();
  ui.element("#enabled").checked = false;
  const saving = ui.change();
  ui.element("#disabled-hosts").value = "later.com";
  held.resolve();
  await saving;
  assert.equal(ui.element("#disabled-hosts").value, "later.com");
  assert.deepEqual(ui.raw().disabledHosts, []);
  await ui.change("#disabled-hosts");
  assert.deepEqual(ui.raw().disabledHosts, ["later.com"]);
});

for (const [selected, opposite] of [["enabledHosts", "disabledHosts"], ["disabledHosts", "enabledHosts"]]) {
  test(`options local ${selected} additions replace an external opposite rule`, async () => {
    const ui = await settingsUI("options", { enabledHosts: [], disabledHosts: [] });
    await ui.storage.set({
      enabledHosts: ["external-on.com"], disabledHosts: ["external-off.com"],
      [opposite]: ["example.com", opposite === "enabledHosts" ? "external-on.com" : "external-off.com"]
    });
    ui.element(selected === "enabledHosts" ? "#enabled-hosts" : "#disabled-hosts").value = "example.com";
    await ui.change();
    assert.deepEqual(ui.raw()[selected], ["example.com", selected === "enabledHosts" ? "external-on.com" : "external-off.com"]);
    assert.deepEqual(ui.raw()[opposite], [opposite === "enabledHosts" ? "external-on.com" : "external-off.com"]);
  });
}

test("options gives disabled precedence for explicit additions while preserving untouched conflicts", async () => {
  const ui = await settingsUI("options", {
    disabledHosts: ["existing-off.com", "untouched.com"], enabledHosts: ["untouched.com"]
  });
  await ui.storage.set({
    disabledHosts: ["existing-off.com", "external-off.com", "untouched.com"],
    enabledHosts: ["external-on.com", "untouched.com"]
  });
  ui.element("#disabled-hosts").value = "existing-off.com\nuntouched.com\nboth.com";
  ui.element("#enabled-hosts").value = "untouched.com\nexisting-off.com\nboth.com\nnew-on.com";
  await ui.change();
  assert.deepEqual(ui.raw().disabledHosts, ["both.com", "existing-off.com", "external-off.com", "untouched.com"]);
  assert.deepEqual(ui.raw().enabledHosts, ["external-on.com", "new-on.com", "untouched.com"]);
});

for (const page of ["popup", "options"]) {
  test(`${page} preserves legacy theme migration when saving an unrelated field`, async () => {
    const ui = await settingsUI(page, { mode: "moon", preset: "rose-pine" });
    ui.element("#enabled").checked = false;
    await ui.element("#enabled").emit("change");
    assert.equal(ui.raw().appearance, "dark");
    assert.equal(ui.raw().presetLight, "rose-pine");
    assert.equal(ui.raw().presetDark, "rose-pine");
    assert.equal("mode" in ui.raw(), false);
    assert.equal("preset" in ui.raw(), false);
  });
}

test("options saves image dimming with its brightness", async () => {
  const options = await settingsUI("options", {});
  options.element("#dim-images").checked = true;
  options.element("#image-brightness").value = "2";
  await options.element("#dim-images").emit("change");
  assert.equal(options.raw().dimImages, true);
  assert.equal(options.raw().imageBrightness, 90);
});

test("Firefox manual font names save through the shared queue and remain editable after reload", async () => {
  const ui = await settingsUI("options", { customFontsEnabled: true, fontEnglish: "Georgia" }, "firefox");
  assert.equal(ui.element("#font-english").type, "text");
  assert.equal(ui.element("#font-english").value, "Georgia");
  assert.equal(ui.element("#font-english").disabled, false);
  assert.match(ui.element("#font-list-status").textContent, /installed font name/);
  ui.element("#font-english").value = "Times New Roman";
  await ui.change("#font-english");
  assert.equal(ui.raw().fontEnglish, "Times New Roman");
  const reopened = await settingsUI("options", ui.raw(), "firefox");
  assert.equal(reopened.element("#font-english").value, "Times New Roman");
  reopened.element("#custom-fonts-enabled").checked = false;
  await reopened.change("#custom-fonts-enabled");
  assert.equal(reopened.element("#font-english").disabled, true);
});

test("shortcut controls open Edge settings and explain Firefox's privileged-page restriction", async () => {
  const edge = await settingsUI("options", {}, "edge");
  await edge.element("#edit-shortcut").emit("click");
  assert.equal(edge.openedTabs[0].url, "edge://extensions/shortcuts");
  const firefox = await settingsUI("options", {}, "firefox");
  await firefox.element("#edit-shortcut").emit("click");
  assert.equal(firefox.openedTabs.length, 0);
  assert.match(firefox.element("#shortcut-help").textContent, /about:addons/);
});
