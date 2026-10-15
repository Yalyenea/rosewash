import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const runtimeSource = await readFile(new URL("../src/sites/zhihu.js", import.meta.url), "utf8");
const layoutAttribute = "data-rosewash-zhihu-layout";
const pageAttributes = [
  "data-rosewash-zhihu-article",
  "data-rosewash-zhihu-home",
  "data-rosewash-zhihu-question"
];

function layoutRuntime({ path = "/", enabled = true } = {}) {
  const attributes = new Set(enabled ? [layoutAttribute] : []);
  const document = new EventTarget();
  const root = {
    hasAttribute: (name) => attributes.has(name),
    toggleAttribute: (name, active) => active ? attributes.add(name) : attributes.delete(name)
  };
  document.documentElement = root;
  const location = { pathname: path };
  const navigation = new EventTarget();
  const entries = [path];
  let index = 0;
  function commit() {
    location.pathname = entries[index];
    navigation.dispatchEvent(new Event("currententrychange"));
  }
  // Page-owned methods remain separate from the isolated world's wrappers.
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
  const window = {
    location, navigation, history: { ...pageHistory },
    addEventListener() {},
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  };
  vm.runInNewContext(runtimeSource, {
    document, window,
    MutationObserver: class {
      constructor(callback) { rootChanged = callback; }
      observe(target, options) {
        assert.equal(target, root);
        assert.deepEqual(Array.from(options.attributeFilter), [layoutAttribute]);
      }
    }
  });
  return {
    pageHistory,
    flush() {
      for (const [id, callback] of timers) {
        timers.delete(id);
        callback();
      }
    },
    setEnabled(active, viaObserver = false) {
      root.toggleAttribute(layoutAttribute, active);
      if (viaObserver) rootChanged();
      else document.dispatchEvent(new Event("rosewash:zhihu-layout-change"));
    },
    assertKind(kind) {
      assert.deepEqual(pageAttributes.filter((attribute) => attributes.has(attribute)),
        kind ? [`data-rosewash-zhihu-${kind}`] : []);
    }
  };
}

test("updates Zhihu markers for page-owned history navigation", () => {
  const runtime = layoutRuntime();
  runtime.assertKind("home");
  runtime.pageHistory.pushState(null, "", "/question/123");
  runtime.flush();
  runtime.assertKind("question");
  runtime.pageHistory.replaceState(null, "", "/p/456");
  runtime.flush();
  runtime.assertKind("article");
  runtime.pageHistory.back();
  runtime.flush();
  runtime.assertKind("home");
  runtime.pageHistory.forward();
  runtime.flush();
  runtime.assertKind("article");
  runtime.pageHistory.pushState(null, "", "/people/example");
  runtime.flush();
  runtime.assertKind("");
  for (const path of ["/follow", "/hot"]) {
    runtime.pageHistory.pushState(null, "", path);
    runtime.flush();
    runtime.assertKind("home");
  }
});

test("clears pending Zhihu markers when disabled and resumes on the current route", () => {
  const runtime = layoutRuntime({ path: "/question/123" });
  runtime.assertKind("question");
  runtime.pageHistory.pushState(null, "", "/p/456");
  runtime.setEnabled(false);
  runtime.assertKind("");
  runtime.flush();
  runtime.assertKind("");
  runtime.pageHistory.replaceState(null, "", "/hot");
  runtime.flush();
  runtime.assertKind("");
  runtime.setEnabled(true, true);
  runtime.assertKind("home");
});

test("hides Zhihu chrome outside the reading column", async () => {
  const css = await readFile(new URL("../src/sites/zhihu.css", import.meta.url), "utf8");
  const rule = css.match(
    /html:is\([\s\S]*?\[data-rosewash-zhihu-article\][\s\S]*?\) :is\(([\s\S]*?)\) \{\s*display:\s*none !important;/
  )?.[1];

  assert.ok(rule);
  assert.match(rule, /\.AppHeader/);
  assert.match(rule, /\.App > :not\(\.App-main\)/);
  assert.match(rule, /div:has\(> \.AppHeader\)/);
  assert.match(rule, /div:has\(\+ \.App-main\)/);
  assert.match(rule, /\.PageHeader/);
  assert.match(rule, /\.ColumnPageHeader/);
  assert.match(rule, /\.CornerButtons/);
  assert.match(css, /\.Post-content > :not\(:has\(\.Post-Main\)\)/);
  assert.match(
    css,
    /\.Post-content > div:has\(\.Post-Main\) > :not\(:has\(\.Post-Main\)\)/
  );
  assert.match(css, /\.Recommendations-Main/);
  assert.match(css, /\.Topstory-container > :not\(\.Topstory-mainColumn\)/);
  assert.match(css, /\.QuestionHeader-side/);
  assert.match(css, /\.Question-sideColumn/);
});

test("centers a viewport-capped Zhihu article column", async () => {
  const css = await readFile(new URL("../src/sites/zhihu.css", import.meta.url), "utf8");
  const runtime = await readFile(new URL("../src/sites/zhihu.js", import.meta.url), "utf8");
  const row = css.match(
    /html\[data-rosewash-zhihu-article\] \.Post-content > div:has\(\.Post-Main\)\s*\{([^}]*)\}/
  )?.[1];

  assert.ok(row);
  assert.match(row, /margin-inline:\s*auto !important/);
  assert.match(row, /width:\s*var\(--rosewash-zhihu-column\) !important/);
  assert.match(
    css,
    /--rosewash-zhihu-column:\s*min\(\s*var\(--rosewash-zhihu-article, 960px\),\s*calc\(100vw - 48px\)\s*\)/
  );
  assert.doesNotMatch(css, /@media \(min-width:/);
  assert.doesNotMatch(runtime, /compactQuery|matchMedia/);
  assert.match(runtime, /\/\^\\\/p\\\/\\d\+\//);
  assert.match(runtime, /LAYOUT_ATTRIBUTE/);
  assert.match(runtime, /data-rosewash-zhihu-article/);
});

test("centers Zhihu home and question columns at the same width", async () => {
  const css = await readFile(new URL("../src/sites/zhihu.css", import.meta.url), "utf8");
  const runtime = await readFile(new URL("../src/sites/zhihu.js", import.meta.url), "utf8");
  const row = css.match(
    /html\[data-rosewash-zhihu-home\] \.Topstory-container,\s*html\[data-rosewash-zhihu-question\] \.QuestionPage > div:has\(\.Question-mainColumn\)\s*\{([^}]*)\}/
  )?.[1];

  assert.ok(row);
  assert.match(row, /margin-inline:\s*auto !important/);
  assert.match(row, /width:\s*var\(--rosewash-zhihu-column\) !important/);
  assert.match(
    css,
    /html\[data-rosewash-zhihu-question\] div:has\(> \.Question-mainColumn\)/
  );
  assert.match(runtime, /\/\^\\\/question\\\/\\d\+\//);
  assert.match(runtime, /path === "\/"/);
  assert.match(runtime, /path === "\/follow"/);
  assert.match(runtime, /path === "\/hot"/);
  assert.match(runtime, /data-rosewash-zhihu-home/);
  assert.match(runtime, /data-rosewash-zhihu-question/);
  assert.match(runtime, /attributeFilter: \[LAYOUT_ATTRIBUTE\]/);
  assert.doesNotMatch(runtime, /subtree:\s*true/);
  assert.doesNotMatch(runtime, /childList:\s*true/);
});

test("exposes snapped Zhihu article widths in settings", async () => {
  const html = await readFile(new URL("../options.html", import.meta.url), "utf8");
  const options = await readFile(new URL("../src/options/options.js", import.meta.url), "utf8");
  const content = await readFile(new URL("../src/content/content.js", import.meta.url), "utf8");
  const input = html.match(/<input id="zhihu-article-width"[^>]+>/)?.[0];

  assert.ok(input);
  assert.match(input, /type="range"/);
  assert.match(input, /min="0"/);
  assert.match(input, /max="3"/);
  assert.match(html, /Zhihu · Clean layout/);
  assert.match(options, /core\.ZHIHU_ARTICLE_WIDTHS\[Number\(zhihuWidthInput\.value\)\]/);
  assert.match(content, /`\$\{settings\.zhihuArticleWidth\}px`/);
  assert.match(content, /ZHIHU_WIDTH_PROPERTY/);
  assert.match(content, /core\.isZhihuHost\(host\)/);
  assert.match(content, /data-rosewash-zhihu-home/);
  assert.match(content, /data-rosewash-zhihu-question/);
});
