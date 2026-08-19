"use strict";

importScripts("../content/core.js");
importScripts("../shared/pdf-open.js");

const core = globalThis.RosewashCore;
const pdfOpen = globalThis.RosewashPdfOpen;
const TOGGLE_SITE_COMMAND = "toggle-current-site";
const OPEN_PDF_COMMAND = "open-pdf-locally";
const PENDING_KEY = "pdfPendingDownloads";

async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function toggleCurrentSite() {
  const tab = await activeTab();
  if (!tab || !tab.url) {
    return;
  }

  const host = core.hostFromUrl(tab.url);
  if (!host) {
    return;
  }

  const raw = await chrome.storage.sync.get(null);
  const settings = core.plainSettings(raw);
  const disabledHosts = core.toggleHostDisabled(host, settings.disabledHosts);
  await chrome.storage.sync.set(core.plainSettings({ ...settings, disabledHosts }));
}

async function pendingDownloads() {
  const stored = await chrome.storage.session.get(PENDING_KEY);
  return stored[PENDING_KEY] || {};
}

async function setPendingDownloads(pending) {
  await chrome.storage.session.set({ [PENDING_KEY]: pending });
}

async function setPdfStatus(tabId, text, title) {
  await Promise.all([
    chrome.action.setBadgeText({ tabId, text }),
    chrome.action.setTitle({ tabId, title })
  ]);
}

async function finishDownload(downloadId) {
  const pending = await pendingDownloads();
  const entry = pdfOpen.pendingDownload(pending, downloadId);
  if (!entry) {
    return;
  }

  await setPendingDownloads(pdfOpen.removePendingDownload(pending, downloadId));
  const [item] = await chrome.downloads.search({ id: downloadId });
  const openerUrl = item && pdfOpen.expandOpenerTemplate(entry.template, item.filename);
  if (!openerUrl) {
    await setPdfStatus(entry.tabId, "!", "Rosewash: downloaded PDF could not be opened");
    return;
  }

  try {
    await chrome.tabs.create({ url: openerUrl });
    await setPdfStatus(entry.tabId, "✓", "Rosewash: PDF downloaded and opener requested");
  } catch {
    await setPdfStatus(entry.tabId, "!", "Rosewash: browser could not request the configured opener");
  }
}

async function failDownload(downloadId) {
  const pending = await pendingDownloads();
  const entry = pdfOpen.pendingDownload(pending, downloadId);
  if (!entry) {
    return;
  }
  await setPendingDownloads(pdfOpen.removePendingDownload(pending, downloadId));
  await setPdfStatus(entry.tabId, "!", "Rosewash: PDF download failed");
}

async function openCurrentPdf() {
  const tab = await activeTab();
  if (!tab || !tab.id) {
    return;
  }

  const pdfUrl = pdfOpen.normalizePdfUrl(tab.url);
  if (!pdfUrl) {
    await setPdfStatus(tab.id, "PDF?", "Rosewash: current page is not a supported PDF URL");
    return;
  }

  const raw = await chrome.storage.sync.get(["pdfOpener", "pdfCustomOpenerTemplate"]);
  const template = pdfOpen.openerTemplate(raw);
  if (!pdfOpen.validateOpenerTemplate(template)) {
    await setPdfStatus(tab.id, "!", "Rosewash: configure a valid PDF opener template in Settings");
    return;
  }

  await setPdfStatus(tab.id, "↓", "Rosewash: downloading PDF");
  try {
    const downloadId = await chrome.downloads.download({
      url: pdfUrl,
      conflictAction: "uniquify",
      saveAs: false
    });
    const pending = await pendingDownloads();
    await setPendingDownloads(pdfOpen.addPendingDownload(pending, downloadId, {
      tabId: tab.id,
      template
    }));

    const [item] = await chrome.downloads.search({ id: downloadId });
    if (item?.state === "complete") {
      await finishDownload(downloadId);
    } else if (item?.state === "interrupted") {
      await failDownload(downloadId);
    }
  } catch {
    await setPdfStatus(tab.id, "!", "Rosewash: PDF download could not start");
  }
}

chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state?.current === "complete") {
    finishDownload(delta.id);
  } else if (delta.state?.current === "interrupted") {
    failDownload(delta.id);
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === TOGGLE_SITE_COMMAND) {
    toggleCurrentSite();
  } else if (command === OPEN_PDF_COMMAND) {
    openCurrentPdf();
  }
});
