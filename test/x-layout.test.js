import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function profileHoverRuntime({ wide = true, path = "/", posts = [], enabled = true, autoExpand = false } = {}) {
  const listeners = new Map();
  const observers = [];
  const attributes = new Set(enabled ? ["data-rosewash-x-compact"] : []);
  if (autoExpand) attributes.add("data-rosewash-x-expand-replies");
  const media = { matches: wide, addEventListener() {} };
  const navigation = new EventTarget();
  const location = { pathname: path };
  const timers = new Map();
  let timerId = 0;
  const document = {
    documentElement: { hasAttribute: (name) => attributes.has(name) },
    querySelectorAll: selector => selector.includes("article[data-testid='tweet']") ? posts : [],
    addEventListener: (type, callback) => listeners.set(type, callback),
    removeEventListener: (type, callback) => {
      if (listeners.get(type) === callback) listeners.delete(type);
    }
  };
  const context = {
    document,
    Node: { ELEMENT_NODE: 1 },
    MouseEvent: class {
      constructor(type, options) { Object.assign(this, { type }, options); }
    },
    MutationObserver: class {
      constructor(callback) { observers.push(callback); }
      observe() {}
      disconnect() {}
    },
    window: {
      location, navigation, matchMedia: () => media,
      setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
      clearTimeout(id) { timers.delete(id); }
    }
  };
  vm.runInNewContext(await readFile(new URL("../src/sites/x.js", import.meta.url), "utf8"), context);
  return {
    listeners,
    mountCard: (card) => observers[0]([{ addedNodes: [card] }]),
    flush() {
      for (const [id, callback] of timers) {
        timers.delete(id);
        callback();
      }
    },
    navigate(path) {
      location.pathname = path;
      navigation.dispatchEvent(new Event("currententrychange"));
      this.flush();
    },
    pointer: (type, target, relatedTarget = null) => listeners.get(type)?.({ target, relatedTarget }),
    disable() {
      attributes.clear();
      listeners.get("rosewash:x-compact-change")();
    }
  };
}

function truncatedPost(id) {
  const button = { clicks: 0, closest: () => null, click() { this.clicks++; } };
  const permalink = {
    closest: () => permalink,
    parentElement: { closest: () => null },
    getAttribute: () => `/reader/status/${id}`
  };
  return {
    nodeType: 1, id, button,
    matches: () => true,
    querySelector: () => null,
    querySelectorAll: selector => selector.startsWith("a[") ? [permalink] : [button]
  };
}

test("expands reply text after the current post, skipping ancestors and quoted text", async () => {
  const ancestor = truncatedPost("10");
  const main = truncatedPost("20");
  const reply = truncatedPost("30");
  const quote = { clicks: 0, closest: () => ({}), click() { this.clicks++; } };
  const query = reply.querySelectorAll;
  reply.querySelectorAll = selector => selector.startsWith("a[") ? query(selector) : [reply.button, quote];
  const posts = [ancestor, main, reply];
  const runtime = await profileHoverRuntime({ path: "/reader/status/20", posts, autoExpand: true });
  assert.deepEqual(posts.map(post => post.button.clicks), [0, 0, 1]);
  assert.equal(quote.clicks, 0);

  // Added replies expand without re-clicking buttons that are still loading.
  const added = truncatedPost("40");
  posts.push(added);
  runtime.mountCard(added);
  runtime.flush();
  assert.deepEqual(posts.map(post => post.button.clicks), [0, 0, 1, 1]);
  runtime.disable();
  const paused = truncatedPost("50");
  posts.push(paused);
  runtime.navigate("/reader/status/20");
  assert.equal(paused.button.clicks, 0);
});

test("waits for the current detail post and follows in-page navigation", async () => {
  const reply = truncatedPost("30");
  const posts = [reply];
  const runtime = await profileHoverRuntime({ path: "/home", posts, autoExpand: true });
  assert.equal(reply.button.clicks, 0);
  runtime.navigate("/reader/status/20");
  assert.equal(reply.button.clicks, 0);
  posts.unshift(truncatedPost("20"));
  runtime.mountCard(posts[0]);
  runtime.flush();
  assert.equal(reply.button.clicks, 1);

  const recycled = truncatedPost("40");
  recycled.button = reply.button;
  const query = recycled.querySelectorAll;
  recycled.querySelectorAll = selector => selector.startsWith("a[") ? query(selector) : [reply.button];
  posts.push(recycled);
  runtime.mountCard(recycled);
  runtime.flush();
  assert.equal(reply.button.clicks, 2);

  const homePost = truncatedPost("50");
  posts.push(homePost);
  runtime.navigate("/home");
  assert.equal(homePost.button.clicks, 0);
  runtime.navigate("/reader/status/20/photo/1");
  assert.equal(homePost.button.clicks, 0);
});

test("expands replies independently of compact layout and viewport width", async () => {
  for (const options of [{ enabled: false }, { wide: false }]) {
    const reply = truncatedPost("30");
    await profileHoverRuntime({ ...options, autoExpand: true, path: "/reader/status/20", posts: [truncatedPost("20"), reply] });
    assert.equal(reply.button.clicks, 1);
  }
  const reply = truncatedPost("30");
  await profileHoverRuntime({ path: "/reader/status/20", posts: [truncatedPost("20"), reply] });
  assert.equal(reply.button.clicks, 0);
});

function hoverElement(selectors = [], parent = null) {
  return {
    nodeType: 1, isConnected: true, parent,
    matches: (selector) => selectors.includes(selector),
    querySelector: () => null,
    querySelectorAll: () => [],
    closest(selector) {
      return selectors.includes(selector) ? this : parent?.closest(selector) || null;
    },
    contains(node) {
      for (; node; node = node.parent) if (node === this) return true;
      return false;
    }
  };
}

test("keeps an avatar's portaled profile card open until the pointer leaves it", async () => {
  const runtime = await profileHoverRuntime();
  const avatar = hoverElement(["[data-testid^='UserAvatar-Container-']"]);
  const anchor = hoverElement(["a[href]"], avatar);
  const card = hoverElement(["[data-testid='HoverCard']"]);
  const button = hoverElement([], card);
  const name = hoverElement([], card);
  const events = [];
  let nativeHovered = true;
  let closing = true;
  anchor.dispatchEvent = (event) => {
    events.push(event.type);
    if (event.type === "mouseout") {
      nativeHovered = false;
      closing = true;
    } else if (!nativeHovered) {
      nativeHovered = true;
      closing = false;
    }
  };
  runtime.pointer("pointerover", anchor);
  runtime.mountCard(card);
  // Crossing unrelated content must retain the card's original owner.
  runtime.pointer("pointerover", hoverElement());
  runtime.pointer("pointerover", button, anchor);
  assert.equal(closing, false);
  assert.deepEqual(events, ["mouseout", "mouseover"]);

  runtime.pointer("pointerout", button, name);
  runtime.pointer("pointerover", name, button);
  assert.equal(closing, false);
  assert.equal(events.length, 2);

  runtime.pointer("pointerout", name);
  assert.equal(closing, true);
  assert.deepEqual(events, ["mouseout", "mouseover", "mouseout"]);
});

test("cleans up profile hover ownership when disabled and ignores unrelated links", async () => {
  const runtime = await profileHoverRuntime();
  const card = hoverElement(["[data-testid='HoverCard']"]);
  const unrelated = hoverElement(["a[href]"]);
  unrelated.dispatchEvent = () => assert.fail("unrelated link received a hover event");
  runtime.pointer("pointerover", unrelated);
  runtime.mountCard(card);
  runtime.pointer("pointerover", card);

  const avatar = hoverElement(["[data-testid^='UserAvatar-Container-']"]);
  const anchor = hoverElement(["a[href]"], avatar);
  const events = [];
  anchor.dispatchEvent = (event) => events.push(event.type);
  const ownedCard = hoverElement(["[data-testid='HoverCard']"]);
  runtime.pointer("pointerover", anchor);
  runtime.pointer("pointerover", card);
  assert.equal(events.length, 0);
  runtime.mountCard(ownedCard);
  runtime.pointer("pointerover", ownedCard);
  runtime.disable();
  assert.deepEqual(events, ["mouseout", "mouseover", "mouseout"]);
  assert.equal(runtime.listeners.has("pointerover"), false);
  assert.equal(runtime.listeners.has("pointerout"), false);

  const mobile = await profileHoverRuntime({ wide: false });
  assert.equal(mobile.listeners.has("pointerover"), false);
  assert.equal(mobile.listeners.has("pointerout"), false);
});

test("constrains every navigation ancestor to the compact rail hit area", async () => {
  const css = await readFile(new URL("../src/sites/x.css", import.meta.url), "utf8");
  const rule = css.match(/header\[role="banner"\] div:has\(nav\)\s*\{([^}]*)\}/)?.[1];

  assert.ok(rule);
  assert.match(rule, /align-items:\s*center !important/);
  assert.match(rule, /margin-inline:\s*0 !important/);
  assert.match(rule, /max-width:\s*var\(--rosewash-x-rail\) !important/);
  assert.match(rule, /min-width:\s*var\(--rosewash-x-rail\) !important/);
  assert.match(rule, /width:\s*var\(--rosewash-x-rail\) !important/);
  assert.match(rule, /padding-inline:\s*0 !important/);
  assert.doesNotMatch(rule, /flex:/);
});

test("leaves X timelines, wheel behavior, and thread pages native", async () => {
  const css = await readFile(new URL("../src/sites/x.css", import.meta.url), "utf8");
  const runtime = await readFile(new URL("../src/sites/x.js", import.meta.url), "utf8");

  assert.doesNotMatch(runtime, /data-rosewash-x-home/);
  assert.doesNotMatch(runtime, /data-rosewash-x-timeline/);
  assert.doesNotMatch(runtime, /data-rosewash-x-cell/);
  assert.doesNotMatch(runtime, /data-rosewash-x-detail/);
  assert.doesNotMatch(runtime, /function layoutHome/);
  assert.doesNotMatch(runtime, /function layoutDetail/);
  assert.doesNotMatch(runtime, /addEventListener\("wheel"/);
  assert.doesNotMatch(runtime, /event\.preventDefault\(\)/);
  assert.doesNotMatch(runtime, /window\.addEventListener\("scroll"/);
  assert.doesNotMatch(css, /data-rosewash-x-home/);
  assert.doesNotMatch(css, /data-rosewash-x-timeline/);
  assert.doesNotMatch(css, /data-rosewash-x-cell/);
  assert.doesNotMatch(css, /data-rosewash-x-detail/);
  assert.doesNotMatch(css, /@media \(min-width: 1280px\)/);
  assert.doesNotMatch(css, /animation-timeline:\s*scroll/);
});

test("centers native single-column pages such as home and bookmarks", async () => {
  const css = await readFile(new URL("../src/sites/x.css", import.meta.url), "utf8");
  const rule = css.match(
    /html\[data-rosewash-x-compact\]\s*main\[role="main"\] > div:has\(\[data-testid="primaryColumn"\]\)\s*\{([^}]*)\}/
  )?.[1];

  assert.ok(rule);
  assert.match(rule, /flex:\s*0 0 var\(--rosewash-x-column\) !important/);
  assert.match(rule, /inset-inline-start:\s*0 !important/);
  assert.match(rule, /margin-inline-start:\s*max\(\s*12px,\s*calc\(\(100vw - var\(--rosewash-x-column\)\) \/ 2 - var\(--rosewash-x-rail\)\)\s*\) !important/);
  assert.match(rule, /margin-inline-end:\s*auto !important/);
  assert.match(rule, /width:\s*var\(--rosewash-x-column\) !important/);
  assert.match(
    css,
    /html\[data-rosewash-x-compact\]\s*\[data-testid="primaryColumn"\] \[data-testid="cellInnerDiv"\]\s*,/
  );
  assert.match(
    css,
    /\[data-testid="cellInnerDiv"\] > div,/
  );
  assert.match(
    css,
    /\[data-testid="primaryColumn"\] article \{/
  );
  assert.match(
    css,
    /\[data-testid="primaryColumn"\] div:has\(> section\[role="region"\]\)/
  );
  assert.match(
    css,
    /section\[role="region"\]:has\(\[data-testid="cellInnerDiv"\]\) > div > div > div/
  );
  assert.doesNotMatch(
    css,
    /div:has\(> section\[role="region"\] \[data-testid="cellInnerDiv"\]\)/
  );
});

test("keeps the compact single-column layout from 720px", async () => {
  const css = await readFile(new URL("../src/sites/x.css", import.meta.url), "utf8");
  const runtime = await readFile(new URL("../src/sites/x.js", import.meta.url), "utf8");

  assert.match(css, /@media \(min-width: 720px\)/);
  assert.match(
    css,
    /--rosewash-x-column:\s*min\(\s*var\(--rosewash-x-single\),\s*calc\(100vw - var\(--rosewash-x-rail\) - 24px\)\s*\)/
  );
  assert.match(runtime, /const compactQuery = window\.matchMedia\("\(min-width: 720px\)"\)/);
  assert.match(runtime, /document\.documentElement\.hasAttribute\(ROOT_ATTRIBUTE\)\s*&& compactQuery\.matches/);
  assert.doesNotMatch(runtime, /detailQuery/);
});

test("hides the redundant X search column in compact mode", async () => {
  const css = await readFile(new URL("../src/sites/x.css", import.meta.url), "utf8");
  const rule = css.match(/\[data-testid="sidebarColumn"\]\s*\{([^}]*)\}/)?.[1];

  assert.ok(rule);
  assert.match(rule, /display:\s*none !important/);
  assert.doesNotMatch(css, /inset-inline-start:\s*calc\([^)]*--rosewash-x-single/);
});

test("exposes snapped X single-column widths in settings", async () => {
  const html = await readFile(new URL("../options.html", import.meta.url), "utf8");
  const options = await readFile(new URL("../src/options/options.js", import.meta.url), "utf8");
  const content = await readFile(new URL("../src/content/content.js", import.meta.url), "utf8");
  const input = html.match(/<input id="x-single-column-width"[^>]+>/)?.[0];

  assert.ok(input);
  assert.match(input, /type="range"/);
  assert.match(input, /min="0"/);
  assert.match(input, /max="3"/);
  assert.match(input, /step="1"/);
  assert.match(options, /core\.X_SINGLE_COLUMN_WIDTHS\[Number\(xSingleWidthInput\.value\)\]/);
  assert.match(content, /`\$\{settings\.xSingleColumnWidth\}px`/);
  assert.match(content, /X_SINGLE_WIDTH_PROPERTY/);
});
