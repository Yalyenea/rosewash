import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadCore() {
  const source = await readFile(new URL("../src/sites/x-core.js", import.meta.url), "utf8");
  const context = {};
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return context.RosewashXCore;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("retains offscreen X replies that define later thread offsets", async () => {
  const core = await loadCore();
  const previous = [
    { key: "a", originalY: 0, height: 100, tweet: true },
    { key: "b", originalY: 100, height: 100, tweet: true },
    { key: "c", originalY: 200, height: 100, tweet: true }
  ];
  const offscreen = core.reconcileRecords(previous, previous.slice(1));

  assert.deepEqual(plain(offscreen.map(({ key }) => key)), ["a", "b", "c"]);
});

test("stacks X thread replies independently from the original post offset", async () => {
  const core = await loadCore();
  const entries = [
    { key: "reply-a", originalY: 900, height: 120, tweet: true },
    { key: "reply-b", originalY: 1020, height: 80, tweet: true }
  ];
  const result = core.computeStack(entries, 12);

  assert.deepEqual(plain(result.placements), [
    { key: "reply-a", y: 12 },
    { key: "reply-b", y: 144 }
  ]);
});

test("keeps thread navigation gestures out of the main post scroller", async () => {
  const css = await readFile(new URL("../src/sites/x.css", import.meta.url), "utf8");
  const rule = css.match(/\[data-rosewash-x-detail-main\]\s*\{([^}]*)\}/)?.[1];

  assert.ok(rule);
  assert.match(rule, /overflow-x:\s*hidden !important/);
  assert.match(rule, /overflow-y:\s*auto !important/);
  assert.match(rule, /overscroll-behavior-x:\s*auto !important/);
  assert.match(rule, /overscroll-behavior-y:\s*contain !important/);
  assert.doesNotMatch(rule, /overscroll-behavior:\s*contain/);
});

test("constrains every navigation ancestor to the compact rail hit area", async () => {
  const css = await readFile(new URL("../src/sites/x.css", import.meta.url), "utf8");
  const rule = css.match(/header\[role="banner"\] div:has\(nav\)\s*\{([^}]*)\}/)?.[1];

  assert.ok(rule);
  assert.match(rule, /max-width:\s*var\(--rosewash-x-rail\) !important/);
  assert.match(rule, /min-width:\s*var\(--rosewash-x-rail\) !important/);
  assert.match(rule, /width:\s*var\(--rosewash-x-rail\) !important/);
  assert.doesNotMatch(rule, /flex:/);
});

test("leaves X home timelines and wheel behavior native", async () => {
  const css = await readFile(new URL("../src/sites/x.css", import.meta.url), "utf8");
  const runtime = await readFile(new URL("../src/sites/x.js", import.meta.url), "utf8");

  assert.doesNotMatch(runtime, /data-rosewash-x-home/);
  assert.doesNotMatch(runtime, /data-rosewash-x-timeline/);
  assert.doesNotMatch(runtime, /data-rosewash-x-cell/);
  assert.doesNotMatch(runtime, /function layoutHome/);
  assert.doesNotMatch(runtime, /computeLayout/);
  assert.doesNotMatch(runtime, /addEventListener\("wheel"/);
  assert.doesNotMatch(runtime, /event\.preventDefault\(\)/);
  assert.doesNotMatch(runtime, /window\.addEventListener\("scroll"/);
  assert.doesNotMatch(css, /data-rosewash-x-home/);
  assert.doesNotMatch(css, /data-rosewash-x-timeline/);
  assert.doesNotMatch(css, /data-rosewash-x-cell/);
  assert.doesNotMatch(css, /animation-timeline:\s*scroll/);
});

test("centers native single-column pages such as home and bookmarks", async () => {
  const css = await readFile(new URL("../src/sites/x.css", import.meta.url), "utf8");
  const rule = css.match(
    /:not\(\[data-rosewash-x-detail\]\)\s*main\[role="main"\] > div:has\(\[data-testid="primaryColumn"\]\)\s*\{([^}]*)\}/
  )?.[1];

  assert.ok(rule);
  assert.match(rule, /flex:\s*0 0 var\(--rosewash-x-single\) !important/);
  assert.match(rule, /margin-inline:\s*auto !important/);
  assert.match(rule, /width:\s*var\(--rosewash-x-single\) !important/);
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

test("keeps the detail route active while X virtualizes its main post", async () => {
  const runtime = await readFile(new URL("../src/sites/x.js", import.meta.url), "utf8");
  const detailRoute = runtime.match(/function isDetail\(\) \{([\s\S]*?)\n  \}/)?.[1];
  const detailLayout = runtime.match(/function layoutDetail\(\) \{([\s\S]*?)\n  \}\n\n  function layout\(/)?.[1];

  assert.ok(detailRoute);
  assert.doesNotMatch(detailRoute, /querySelector/);
  assert.ok(detailLayout);
  assert.doesNotMatch(detailLayout, /clearLayout\(\)/);
  assert.match(detailLayout, /detailMainCell/);
  assert.match(detailLayout, /detailMainSnapshot/);
});

test("pins the preserved main post outside X's virtualized cells", async () => {
  const css = await readFile(new URL("../src/sites/x.css", import.meta.url), "utf8");
  const runtime = await readFile(new URL("../src/sites/x.js", import.meta.url), "utf8");
  const rule = css.match(/\[data-rosewash-x-detail-snapshot\]\s*\{([^}]*)\}/)?.[1];

  assert.ok(rule);
  assert.match(rule, /position:\s*fixed !important/);
  assert.match(rule, /left:\s*calc\(\(100vw - var\(--rosewash-x-feed\)\)/);
  assert.match(rule, /width:\s*calc\(var\(--rosewash-x-feed\) \* 0\.6 - 18px\)/);
  assert.doesNotMatch(runtime, /cloneNode\(true\)/);
  assert.match(runtime, /html:\s*cell\.innerHTML/);
  assert.match(runtime, /video\.replaceWith\(media\)/);
});

test("ignores nested card mutations that do not change X cell geometry", async () => {
  const runtime = await readFile(new URL("../src/sites/x.js", import.meta.url), "utf8");
  const mutations = runtime.match(/function handleDocumentMutations\(mutations\) \{([\s\S]*?)\n  \}/)?.[1];

  assert.ok(mutations);
  assert.match(mutations, /target\?\.closest\(CELL_SELECTOR\)/);
  assert.doesNotMatch(mutations, /Boolean\(target\?\.closest\(CELL_SELECTOR\)\)/);
});
