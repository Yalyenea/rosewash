import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("hides Zhihu chrome that is not the article column", async () => {
  const css = await readFile(new URL("../src/sites/zhihu.css", import.meta.url), "utf8");
  const rule = css.match(
    /html\[data-rosewash-zhihu-article\] \.AppHeader,[\s\S]*?\{([^}]*)\}/
  )?.[1];

  assert.ok(rule);
  assert.match(rule, /display:\s*none !important/);
  assert.match(css, /\.App > :not\(\.App-main\)/);
  assert.match(css, /\.Post-content > :not\(:has\(\.Post-Main\)\)/);
  assert.match(
    css,
    /\.Post-content > div:has\(\.Post-Main\) > :not\(:has\(\.Post-Main\)\)/
  );
  assert.match(css, /\.ColumnPageHeader/);
  assert.match(css, /\.CornerButtons/);
  assert.match(css, /\.Recommendations-Main/);
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
  assert.match(css, /@media \(min-width: 720px\)/);
  assert.match(runtime, /const compactQuery = window\.matchMedia\("\(min-width: 720px\)"\)/);
  assert.match(runtime, /\/\^\\\/p\\\/\\d\+\//);
  assert.match(runtime, /LAYOUT_ATTRIBUTE/);
  assert.match(runtime, /ARTICLE_ATTRIBUTE/);
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
  assert.match(options, /core\.ZHIHU_ARTICLE_WIDTHS\[Number\(zhihuWidthInput\.value\)\]/);
  assert.match(content, /`\$\{settings\.zhihuArticleWidth\}px`/);
  assert.match(content, /ZHIHU_WIDTH_PROPERTY/);
  assert.match(content, /core\.isZhihuHost\(host\)/);
});
