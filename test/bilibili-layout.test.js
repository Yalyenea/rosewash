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

function layoutRuntime({ host = "www.bilibili.com", path = "/", enabled = true } = {}) {
  const attributes = new Set(enabled ? [layoutAttribute] : []);
  const document = new EventTarget();
  const root = {
    hasAttribute: (name) => attributes.has(name),
    toggleAttribute: (name, active) => active ? attributes.add(name) : attributes.delete(name)
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
  const leftColumn = {
    children: [],
    appendChild(node) {
      node.parentNode?.children?.splice(node.parentNode.children.indexOf(node), 1);
      node.parentNode = leftColumn;
      node.nextSibling = null;
      leftColumn.children.push(node);
    },
    insertBefore(node, reference) {
      node.parentNode?.children?.splice(node.parentNode.children.indexOf(node), 1);
      const refIndex = leftColumn.children.indexOf(reference);
      node.parentNode = leftColumn;
      node.nextSibling = reference;
      leftColumn.children.splice(refIndex >= 0 ? refIndex : leftColumn.children.length, 0, node);
    }
  };
  const rightColumn = {
    children: [],
    appendChild(node) {
      node.parentNode?.children?.splice(node.parentNode.children.indexOf(node), 1);
      node.parentNode = rightColumn;
      node.nextSibling = null;
      rightColumn.children.push(node);
    }
  };
  const commentNode = { id: "commentapp", parentNode: null, nextSibling: null };
  const tagNode = { id: "tags", parentNode: null, nextSibling: null };
  leftColumn.appendChild(commentNode);
  leftColumn.appendChild(tagNode);
  commentNode.nextSibling = tagNode;
  document.querySelector = (selector) => {
    if (selector === "#commentapp") return commentNode;
    if (selector === ".right-container-inner") return rightColumn;
    return null;
  };
  const window = {
    location, navigation, history: { ...pageHistory },
    addEventListener() {},
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  };
  vm.runInNewContext(runtimeSource, {
    document, window,
    MutationObserver: class {
      constructor(callback) {
        if (!rootChanged) rootChanged = callback;
      }
      observe(target, options) {
        assert.equal(target, root);
        if (options.attributeFilter) {
          assert.deepEqual(Array.from(options.attributeFilter), [layoutAttribute]);
        }
      }
      disconnect() {}
    }
  });
  return {
    location,
    pageHistory,
    leftColumn,
    rightColumn,
    commentNode,
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
  assert.equal(runtime.commentNode.parentNode, runtime.rightColumn);
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

test("keeps UP info and collection selectors on Bilibili video pages while hiding recommendations and ads", async () => {
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
  assert.match(homeRule, /\.bili-header__channel/);
  assert.match(homeRule, /\.recommended-swipe/);
  assert.match(css, /a\[href\*="game\.bilibili\.com"\]/);
  assert.match(css, /\.bili-header \.vip-entry/);
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
