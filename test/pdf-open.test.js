import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadPdfOpen() {
  const source = await readFile(new URL("../src/shared/pdf-open.js", import.meta.url), "utf8");
  const context = { console, URL };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return context.RosewashPdfOpen;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("detects and conservatively normalizes supported PDF URLs", async () => {
  const pdf = await loadPdfOpen();

  assert.equal(pdf.normalizePdfUrl("https://example.com/paper.pdf?download=1"), "https://example.com/paper.pdf?download=1");
  assert.equal(pdf.normalizePdfUrl("https://arxiv.org/pdf/1706.03762"), "https://arxiv.org/pdf/1706.03762.pdf");
  assert.equal(pdf.normalizePdfUrl("https://arxiv.org/pdf/1706.03762.pdf"), "https://arxiv.org/pdf/1706.03762.pdf");
  assert.equal(pdf.normalizePdfUrl("https://arxiv.org/abs/1706.03762#page=2"), "https://arxiv.org/pdf/1706.03762.pdf#page=2");
  assert.equal(pdf.normalizePdfUrl("https://arxiv.org/abs/hep-th/9901001"), "https://arxiv.org/pdf/hep-th/9901001.pdf");
  assert.equal(pdf.isPdfUrl("https://example.com/paper.PDF"), true);
  assert.equal(pdf.isPdfUrl("https://example.com/article"), false);
  assert.equal(pdf.normalizePdfUrl("file:///tmp/paper.pdf"), "");
});

test("validates and expands opener templates with encoded local values", async () => {
  const pdf = await loadPdfOpen();
  const path = "/Users/A Reader/Downloads/paper #1.pdf";
  const fileURL = "file:///Users/A%20Reader/Downloads/paper%20%231.pdf";

  assert.equal(pdf.fileUrlFromPath(path), fileURL);
  assert.equal(
    pdf.expandOpenerTemplate("serein://open?file={fileURL}", path),
    `serein://open?file=${encodeURIComponent(fileURL)}`
  );
  assert.equal(
    pdf.expandOpenerTemplate("reader://open?path={filePath}", path),
    `reader://open?path=${encodeURIComponent(path)}`
  );
  assert.equal(pdf.validateOpenerTemplate("https://example.com/{fileURL}"), false);
  assert.equal(pdf.validateOpenerTemplate("reader://open"), false);
  assert.equal(pdf.expandOpenerTemplate("javascript://open?file={fileURL}", path), "");
});

test("keeps pending download state serializable across worker restarts", async () => {
  const pdf = await loadPdfOpen();
  const one = pdf.addPendingDownload({}, 41, { tabId: 7, template: pdf.SEREIN_TEMPLATE });
  const two = pdf.addPendingDownload(one, 42, { tabId: 8, template: "reader://open?file={fileURL}" });

  assert.deepEqual(plain(pdf.pendingDownload(two, 41)), {
    tabId: 7,
    template: "serein://open?file={fileURL}"
  });
  assert.deepEqual(plain(pdf.removePendingDownload(two, 41)), {
    "42": { tabId: 8, template: "reader://open?file={fileURL}" }
  });
});
