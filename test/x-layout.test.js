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
    /html\[data-rosewash-x-compact\]\s*main\[role="main"\] > div:has\(\[data-testid="primaryColumn"\]\)\s*\{([^}]*)\}/
  )?.[1];

  assert.ok(rule);
  assert.match(rule, /flex:\s*0 0 var\(--rosewash-x-column\) !important/);
  assert.match(rule, /margin-inline:\s*auto !important/);
  assert.match(rule, /width:\s*var\(--rosewash-x-column\) !important/);
  assert.match(
    css,
    /html\[data-rosewash-x-compact\]\s*\[data-testid="primaryColumn"\] \[data-testid="cellInnerDiv"\]\s*\{[^}]*width:\s*100% !important/
  );
});

test("keeps the compact single-column layout at medium viewport widths", async () => {
  const css = await readFile(new URL("../src/sites/x.css", import.meta.url), "utf8");
  const runtime = await readFile(new URL("../src/sites/x.js", import.meta.url), "utf8");
  const compactStart = css.indexOf("@media (min-width: 720px)");
  const singleColumn = css.indexOf("Native single-column pages");
  const detailStart = css.indexOf("@media (min-width: 1280px)");
  const detailLayout = css.indexOf("Thread pages use the same centered canvas");

  assert.ok(compactStart >= 0);
  assert.ok(compactStart < singleColumn);
  assert.ok(singleColumn < detailStart);
  assert.ok(detailStart < detailLayout);
  assert.match(
    css,
    /--rosewash-x-column:\s*min\(\s*var\(--rosewash-x-single\),\s*calc\(100vw - var\(--rosewash-x-rail\) - 24px\)\s*\)/
  );
  assert.match(runtime, /const compactQuery = window\.matchMedia\("\(min-width: 720px\)"\)/);
  assert.match(runtime, /const detailQuery = window\.matchMedia\("\(min-width: 1280px\)"\)/);
  assert.match(runtime, /document\.documentElement\.hasAttribute\(ROOT_ATTRIBUTE\)\s*&& compactQuery\.matches/);
  assert.match(runtime, /const detail = isDetail\(\) && detailQuery\.matches/);
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
  assert.match(detailLayout, /return false/);
  assert.match(detailLayout, /return true/);
  assert.match(runtime, /function cellMatchesRoute\(cell, route\)/);
  assert.match(runtime, /\.some\(\(link\) =>/);
  assert.match(detailLayout, /Array\.from\(timeline\.children\)\.find/);
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

test("tracks SPA routes and retries detail layout while the main post hydrates", async () => {
  const runtime = await readFile(new URL("../src/sites/x.js", import.meta.url), "utf8");
  const mutations = runtime.match(/function handleDocumentMutations\(mutations\) \{([\s\S]*?)\n  \}/)?.[1];
  const layout = runtime.match(/function layout\(\) \{([\s\S]*?)\n  \}\n\n  function scheduleLayout/)?.[1];

  assert.ok(mutations);
  assert.ok(layout);
  assert.match(mutations, /layoutRoute !== currentRouteKey\(\)/);
  assert.match(mutations, /target\?\.closest\(CELL_SELECTOR\)/);
  assert.match(mutations, /isDetail\(\) && !detailMainTemplate/);
  assert.doesNotMatch(mutations, /Boolean\(target\?\.closest\(CELL_SELECTOR\)\)/);
  assert.match(layout, /prepareRailControls\(\);\s*startDocumentObserver\(\);\s*const detail = isDetail\(\)/);
  assert.match(layout, /toggleAttribute\(DETAIL_ATTRIBUTE, layoutDetail\(\)\)/);
  assert.doesNotMatch(layout, /else \{\s*stopDocumentObserver\(\)/);
  assert.match(runtime, /attributes:\s*true,\s*attributeFilter:\s*\["style"\]/);
});
