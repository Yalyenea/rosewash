import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const runtimeSource = await readFile(new URL("../src/sites/bilibili.js", import.meta.url), "utf8");
const layoutAttribute = "data-rosewash-bilibili-layout";
const pageAttributes = [
  "data-rosewash-bilibili-dynamic",
  "data-rosewash-bilibili-home",
  "data-rosewash-bilibili-read",
  "data-rosewash-bilibili-video"
];

function layoutRuntime({ host = "www.bilibili.com", path = "/", enabled = true, ready = true } = {}) {
  const attributes = new Set(enabled ? [layoutAttribute] : []);
  const properties = new Map();
  const document = new EventTarget();
  const root = {
    hasAttribute: (name) => attributes.has(name),
    toggleAttribute: (name, active) => active ? attributes.add(name) : attributes.delete(name),
    style: {
      getPropertyValue: (name) => properties.get(name) || "",
      setProperty: (name, value) => properties.set(name, value),
      removeProperty: (name) => properties.delete(name)
    }
  };
  document.documentElement = root;
  const location = { hostname: host, pathname: path };
  const navigation = new EventTarget();
  const entries = [path];
  let index = 0;
  function commit() {
    location.pathname = entries[index];
    navigation.dispatchEvent(new Event("currententrychange"));
  }
  const pageHistory = {
    pushState(_data, _unused, url) {
      entries.splice(++index, entries.length, url);
      commit();
    },
    replaceState(_data, _unused, url) {
      entries[index] = url;
      commit();
    },
    back() { index--; commit(); },
    forward() { index++; commit(); }
  };
  const timers = new Map();
  let timerId = 0;
  let rootChanged;
  let videoChanged;
  let resized;
  const contentBounds = { left: 804, bottom: 400, width: 390 };
  const rightContent = { getBoundingClientRect: () => contentBounds };
  const leftColumn = {
    children: [],
    getBoundingClientRect: () => ({ left: 24, top: 80 }),
    appendChild(node) {
      node.parentNode?.children?.splice(node.parentNode.children.indexOf(node), 1);
      node.parentNode = leftColumn;
      node.nextSibling = null;
      leftColumn.children.push(node);
    }
  };
  function createComment() {
    return Object.assign(new EventTarget(), {
      id: "commentapp", parentNode: null, nextSibling: null
    });
  }
  let commentNode = createComment();
  const tagNode = { id: "tags", parentNode: null, nextSibling: null };
  leftColumn.appendChild(commentNode);
  leftColumn.appendChild(tagNode);
  commentNode.nextSibling = tagNode;
  document.querySelector = (selector) => {
    if (!ready) return null;
    if (selector === "#commentapp") return commentNode;
    if (selector === ".left-container") return leftColumn;
    if (selector === ".right-container-inner") return rightContent;
    return null;
  };
  const window = Object.assign(new EventTarget(), {
    location, navigation, history: { ...pageHistory }, innerHeight: 900,
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  });
  let scrollEvents = 0;
  window.addEventListener("scroll", () => scrollEvents++);
  vm.runInNewContext(runtimeSource, {
    document, window, Event,
    MutationObserver: class {
      constructor(callback) {
        if (!rootChanged) rootChanged = callback;
        else videoChanged = callback;
      }
      observe(target, options) {
        assert.equal(target, root);
        if (options.attributeFilter) {
          assert.deepEqual(Array.from(options.attributeFilter), [layoutAttribute]);
        }
      }
      disconnect() {}
    },
    ResizeObserver: class {
      constructor(callback) { resized = callback; }
      observe() {}
      disconnect() {}
    }
  });
  return {
    location,
    pageHistory,
    leftColumn,
    get commentNode() { return commentNode; },
    get scrollEvents() { return scrollEvents; },
    properties,
    resizeRightContent(bounds) {
      Object.assign(contentBounds, bounds);
      resized();
    },
    replaceComment() {
      const previous = commentNode;
      const index = leftColumn.children.indexOf(previous);
      previous.parentNode = null;
      commentNode = createComment();
      commentNode.parentNode = leftColumn;
      leftColumn.children[index] = commentNode;
      videoChanged();
      return previous;
    },
    setReady(value) {
      ready = value;
      videoChanged();
    },
    flush() {
      for (const [id, callback] of timers) {
        timers.delete(id);
        callback();
      }
    },
    setEnabled(active, viaObserver = false) {
      root.toggleAttribute(layoutAttribute, active);
      if (viaObserver) rootChanged();
      else document.dispatchEvent(new Event("rosewash:bilibili-layout-change"));
    },
    assertKind(kind) {
      assert.deepEqual(pageAttributes.filter((attribute) => attributes.has(attribute)),
        kind ? [`data-rosewash-bilibili-${kind}`] : []);
    }
  };
}

test("updates Bilibili route markers across home, video, read, and dynamic pages", () => {
  const runtime = layoutRuntime();
  runtime.assertKind("home");
  runtime.pageHistory.pushState(null, "", "/video/BV1xx411c7mD");
  runtime.flush();
  runtime.assertKind("video");
  assert.equal(runtime.commentNode.parentNode, runtime.leftColumn);
  runtime.pageHistory.replaceState(null, "", "/read/cv123456");
  runtime.flush();
  runtime.assertKind("read");
  assert.equal(runtime.commentNode.parentNode, runtime.leftColumn);
  assert.equal(runtime.leftColumn.children[0], runtime.commentNode);
  runtime.pageHistory.pushState(null, "", "/opus/987654321");
  runtime.flush();
  runtime.assertKind("read");
  runtime.pageHistory.pushState(null, "", "/v/popular/all");
  runtime.flush();
  runtime.assertKind("dynamic");
  runtime.pageHistory.pushState(null, "", "/anime");
  runtime.flush();
  runtime.assertKind("");

  const dynamicHost = layoutRuntime({ host: "t.bilibili.com", path: "/" });
  dynamicHost.assertKind("dynamic");
  dynamicHost.setEnabled(false);
  dynamicHost.assertKind("");
  dynamicHost.setEnabled(true, true);
  dynamicHost.assertKind("dynamic");
});

test("positions comments beside the player without reconnecting them and clears offsets when disabled", () => {
  const runtime = layoutRuntime({ path: "/video/BV1xx411c7mD" });
  const comment = runtime.commentNode;
  const top = "--rosewash-bilibili-comment-top";
  assert.equal(runtime.properties.get(top), "418px");
  assert.equal(runtime.properties.get("--rosewash-bilibili-comment-x"), "804px");
  assert.equal(runtime.properties.get("--rosewash-bilibili-comment-width"), "390px");
  assert.equal(runtime.properties.get("--rosewash-bilibili-comment-height"), "466px");
  assert.equal(comment.parentNode, runtime.leftColumn);

  runtime.resizeRightContent({ bottom: 600, width: 320 });
  runtime.flush();
  assert.equal(runtime.properties.get(top), "618px");
  assert.equal(runtime.properties.get("--rosewash-bilibili-comment-height"), "266px");
  assert.equal(runtime.properties.get("--rosewash-bilibili-comment-width"), "320px");
  // Repeated notifications keep the viewport's independent comment area stable.
  runtime.resizeRightContent({});
  runtime.flush();
  assert.equal(runtime.properties.get(top), "618px");
  runtime.setEnabled(false);
  assert.equal(runtime.properties.size, 0);
  assert.equal(comment.parentNode, runtime.leftColumn);
  runtime.setEnabled(true);
  assert.equal(runtime.commentNode, comment);
  assert.equal(comment.parentNode, runtime.leftColumn);
  assert.equal(runtime.properties.get(top), "618px");
});

test("handles delayed video containers and comments replaced by the site", () => {
  const runtime = layoutRuntime({ path: "/video/BV1xx411c7mD", ready: false });
  assert.equal(runtime.properties.size, 0);
  runtime.setReady(true);
  runtime.flush();
  assert.equal(runtime.properties.get("--rosewash-bilibili-comment-top"), "418px");

  const previous = runtime.replaceComment();
  runtime.flush();
  assert.notEqual(runtime.commentNode, previous);
  assert.equal(previous.parentNode, null);
  assert.equal(runtime.commentNode.parentNode, runtime.leftColumn);
  assert.equal(runtime.properties.get("--rosewash-bilibili-comment-top"), "418px");
});

test("notifies Bilibili's page loader when comments scroll and removes old listeners", () => {
  const runtime = layoutRuntime({ path: "/video/BV1xx411c7mD" });
  runtime.commentNode.dispatchEvent(new Event("scroll"));
  assert.equal(runtime.scrollEvents, 1);
  runtime.flush();

  const previous = runtime.replaceComment();
  runtime.flush();
  previous.dispatchEvent(new Event("scroll"));
  assert.equal(runtime.scrollEvents, 1);
  runtime.commentNode.dispatchEvent(new Event("scroll"));
  assert.equal(runtime.scrollEvents, 2);

  runtime.setEnabled(false);
  runtime.commentNode.dispatchEvent(new Event("scroll"));
  assert.equal(runtime.scrollEvents, 2);
});

test("preserves Bilibili categories and video selectors while hiding selected service entries and promotions", async () => {
  const css = await readFile(new URL("../src/sites/bilibili.css", import.meta.url), "utf8");
  const videoRule = css.match(/html\[data-rosewash-bilibili-video\] :is\(([\s\S]*?)\) \{\s*display:\s*none !important;/)?.[1];
  const homeRule = css.match(/html\[data-rosewash-bilibili-home\] :is\(([\s\S]*?)\) \{\s*display:\s*none !important;/)?.[1];

  assert.ok(videoRule);
  assert.match(videoRule, /\.recommend-list-v1/);
  assert.match(videoRule, /\.rec-list/);
  assert.match(videoRule, /\.pop-live-small-mode/);
  assert.match(videoRule, /\.video-card-ad-small/);
  assert.doesNotMatch(videoRule, /\.up-panel-container|#multi_page|\.video-pod/);

  assert.ok(homeRule);
  assert.match(homeRule, /\.bili-header__banner/);
  assert.doesNotMatch(homeRule, /\.bili-header__channel/);
  assert.match(homeRule, /\.bili-feed4 > \.header-channel/);
  assert.match(homeRule, /\.fixed-channel-shim/);
  assert.match(homeRule, /\.recommended-swipe/);
  for (const link of ["show.bilibili.com", "manga.bilibili.com", "/match/", "app.bilibili.com"]) {
    assert.ok(css.includes(link));
  }
  assert.match(css, /\.left-entry__item:has\(> a:is\(/);
  assert.match(css, /\.bili-header \.vip-entry/);
  assert.match(css, /\.bili-header \.game-download-notify-entry-wrap/);
  assert.doesNotMatch(css, /\.bili-header \.left-loc-entry/);
  assert.match(css, /\.bili-header \.vip-login-tip/);
});

test("exposes Bilibili layout controls in popup and settings", async () => {
  const popupHtml = await readFile(new URL("../popup.html", import.meta.url), "utf8");
  const optionsHtml = await readFile(new URL("../options.html", import.meta.url), "utf8");
  const options = await readFile(new URL("../src/options/options.js", import.meta.url), "utf8");
  const content = await readFile(new URL("../src/content/content.js", import.meta.url), "utf8");

  assert.match(popupHtml, /id="bilibili-layout-row"/);
  assert.match(optionsHtml, /id="bilibili-layout"/);
  assert.match(optionsHtml, /id="bilibili-column-width"/);
  assert.match(options, /core\.BILIBILI_COLUMN_WIDTHS\[Number\(bilibiliWidthInput\.value\)\]/);
  assert.match(content, /core\.isBilibiliHost\(host\)/);
  assert.match(content, /`\$\{settings\.bilibiliColumnWidth\}px`/);
});
