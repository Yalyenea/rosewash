import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("constrains every navigation ancestor to the compact rail hit area", async () => {
  const css = await readFile(new URL("../src/sites/x.css", import.meta.url), "utf8");
  const rule = css.match(/header\[role="banner"\] div:has\(nav\)\s*\{([^}]*)\}/)?.[1];

  assert.ok(rule);
  assert.match(rule, /max-width:\s*var\(--rosewash-x-rail\) !important/);
  assert.match(rule, /min-width:\s*var\(--rosewash-x-rail\) !important/);
  assert.match(rule, /width:\s*var\(--rosewash-x-rail\) !important/);
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
  assert.match(rule, /margin-inline:\s*auto !important/);
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
