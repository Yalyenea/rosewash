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

test("packs known X posts into the shortest column", async () => {
  const core = await loadCore();
  const firstWindow = [
    { key: "a", originalY: 0, height: 200, tweet: true },
    { key: "b", originalY: 200, height: 100, tweet: true },
    { key: "c", originalY: 300, height: 180, tweet: true }
  ];
  const initial = core.computeLayout(firstWindow, 12);
  const extended = core.computeLayout([
    ...firstWindow,
    { key: "d", originalY: 480, height: 120, tweet: true }
  ], 12);

  assert.deepEqual(plain(initial.placements), [
    { key: "a", column: "left", y: 12 },
    { key: "b", column: "right", y: 12 },
    { key: "c", column: "right", y: 124 }
  ]);
  assert.deepEqual(
    plain(extended.placements.slice(0, 3)),
    plain(initial.placements)
  );
  assert.deepEqual(plain(extended.placements[3]), {
    key: "d",
    column: "left",
    y: 224
  });
});

test("keeps a masonry post in its assigned column after height changes", async () => {
  const core = await loadCore();
  const entries = [
    { key: "a", originalY: 0, height: 200, tweet: true },
    { key: "b", originalY: 200, height: 100, tweet: true },
    { key: "c", originalY: 300, height: 180, tweet: true }
  ];
  const initial = core.computeLayout(entries, 12);
  const columns = new Map(initial.placements.map(({ key, column }) => [key, column]));
  const resized = core.computeLayout(entries.map((entry) => ({
    ...entry,
    column: columns.get(entry.key),
    height: entry.key === "b" ? 300 : entry.height
  })), 12);

  assert.deepEqual(plain(resized.placements), [
    { key: "a", column: "left", y: 12 },
    { key: "b", column: "right", y: 12 },
    { key: "c", column: "right", y: 324 }
  ]);
  assert.equal(core.reconcileRecords(
    [{ ...entries[0], column: "left" }],
    [{ ...entries[0], height: 240 }]
  )[0].column, "left");
});

test("keeps non-tweet modules full-width between tweet rows", async () => {
  const core = await loadCore();
  const result = core.computeLayout([
    { key: "banner", originalY: 0, height: 40, tweet: false },
    { key: "a", originalY: 40, height: 100, tweet: true },
    { key: "b", originalY: 140, height: 120, tweet: true }
  ], 10);

  assert.deepEqual(plain(result.placements), [
    { key: "banner", column: "full", y: 10 },
    { key: "a", column: "left", y: 60 },
    { key: "b", column: "right", y: 60 }
  ]);
  assert.equal(core.compactOffsetAt(0, result.scrollPoints), 0);
});

test("maps native virtual scroll continuously onto compact rows", async () => {
  const core = await loadCore();
  const { scrollPoints } = core.computeLayout([
    { key: "a", originalY: 0, height: 100, tweet: true },
    { key: "b", originalY: 100, height: 100, tweet: true },
    { key: "c", originalY: 200, height: 100, tweet: true },
    { key: "d", originalY: 300, height: 100, tweet: true }
  ], 0);

  assert.equal(core.compactOffsetAt(100, scrollPoints), 50);
  assert.equal(core.compactOffsetAt(300, scrollPoints), 150);
  assert.equal(core.compactOffsetAt(500, scrollPoints), 250);
});

test("retains offscreen X modules that define later masonry offsets", async () => {
  const core = await loadCore();
  const previous = [
    { key: "a", originalY: 0, height: 100, tweet: true },
    { key: "banner", originalY: 100, height: 40, tweet: false },
    { key: "b", originalY: 140, height: 100, tweet: true },
    { key: "c", originalY: 240, height: 100, tweet: true }
  ];
  const offscreen = core.reconcileRecords(previous, previous.slice(2));
  const removedInWindow = core.reconcileRecords(previous, [previous[0], ...previous.slice(2)]);

  assert.deepEqual(
    plain(core.computeLayout(offscreen, 10).placements),
    plain(core.computeLayout(previous, 10).placements)
  );
  assert.deepEqual(plain(removedInWindow.map(({ key }) => key)), ["a", "b", "c"]);
});

test("continues an X layout from a bounded-cache anchor", async () => {
  const core = await loadCore();
  const entries = [
    { key: "a", originalY: 0, height: 100, tweet: true },
    { key: "b", originalY: 100, height: 120, tweet: true },
    { key: "c", originalY: 220, height: 80, tweet: true },
    { key: "d", originalY: 300, height: 90, tweet: true }
  ];
  const full = core.computeLayout(entries, 10);
  const checkpoint = full.checkpoints.find(({ key }) => key === "c");
  const anchor = {
    compactY: checkpoint.compactY,
    key: "c",
    leftY: checkpoint.leftY,
    rightY: checkpoint.rightY
  };
  const bounded = core.computeLayout(entries.slice(2), 10, anchor);

  assert.deepEqual(plain(bounded.placements), plain(full.placements.slice(2)));
  assert.equal(
    core.compactOffsetAt(entries[2].originalY, bounded.scrollPoints),
    anchor.compactY
  );
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
  assert.equal(core.compactOffsetAt(899, result.scrollPoints), 899);
  assert.equal(core.compactOffsetAt(900, result.scrollPoints), 900);
  assert.equal(core.compactOffsetAt(901, result.scrollPoints), 901.1);
  assert.equal(core.compactOffsetAt(1020, result.scrollPoints), 1032);
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
});
