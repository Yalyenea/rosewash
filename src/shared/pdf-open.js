(function (global) {
  "use strict";

  const DEFAULT_OPENER = "serein";
  const SEREIN_TEMPLATE = "serein://open?file={fileURL}";
  const TEMPLATE_FIELDS = Object.freeze(["{fileURL}", "{filePath}"]);
  const WEB_SCHEMES = new Set(["http", "https", "file", "chrome", "javascript", "data"]);

  function normalizePdfUrl(value) {
    let url;
    try {
      url = new URL(String(value || ""));
    } catch {
      return "";
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }

    const path = url.pathname;
    if (/\.pdf$/i.test(path)) {
      return url.href;
    }

    if (url.hostname === "arxiv.org") {
      const absMatch = path.match(/^\/abs\/([^/]+(?:\/[^/]+)?)\/?$/i);
      if (absMatch) {
        url.pathname = `/pdf/${absMatch[1]}.pdf`;
        return url.href;
      }

      const pdfMatch = path.match(/^\/pdf\/([^/]+(?:\/[^/]+?)?)(?:\.pdf)?\/?$/i);
      if (pdfMatch) {
        url.pathname = `/pdf/${pdfMatch[1]}.pdf`;
        return url.href;
      }
    }

    return "";
  }

  function isPdfUrl(value) {
    return normalizePdfUrl(value) !== "";
  }

  function normalizeOpenerSettings(raw = {}) {
    return {
      pdfOpener: raw.pdfOpener === "custom" ? "custom" : DEFAULT_OPENER,
      pdfCustomOpenerTemplate: String(raw.pdfCustomOpenerTemplate || "").trim()
    };
  }

  function openerTemplate(settings) {
    const normalized = normalizeOpenerSettings(settings);
    return normalized.pdfOpener === "custom"
      ? normalized.pdfCustomOpenerTemplate
      : SEREIN_TEMPLATE;
  }

  function validateOpenerTemplate(template) {
    const value = String(template || "").trim();
    const scheme = value.match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1]?.toLowerCase();
    if (!scheme || WEB_SCHEMES.has(scheme)) {
      return false;
    }
    return TEMPLATE_FIELDS.some((field) => value.includes(field));
  }

  function fileUrlFromPath(filePath) {
    const value = String(filePath || "");
    const windowsPath = /^[a-z]:[\\/]/i.test(value);
    if (!value.startsWith("/") && !windowsPath) {
      return "";
    }

    const normalized = value.replace(/\\/g, "/");
    const encoded = normalized
      .split("/")
      .map((part, index) => windowsPath && index === 0
        ? encodeURIComponent(part).replace("%3A", ":")
        : encodeURIComponent(part))
      .join("/");
    return windowsPath ? `file:///${encoded}` : `file://${encoded}`;
  }

  function expandOpenerTemplate(template, filePath) {
    if (!validateOpenerTemplate(template)) {
      return "";
    }

    const fileURL = fileUrlFromPath(filePath);
    if (!fileURL) {
      return "";
    }

    return String(template).trim()
      .replaceAll("{fileURL}", encodeURIComponent(fileURL))
      .replaceAll("{filePath}", encodeURIComponent(String(filePath)));
  }

  function addPendingDownload(pending, downloadId, entry) {
    return {
      ...(pending || {}),
      [String(downloadId)]: {
        tabId: entry.tabId,
        template: entry.template
      }
    };
  }

  function removePendingDownload(pending, downloadId) {
    const next = { ...(pending || {}) };
    delete next[String(downloadId)];
    return next;
  }

  function pendingDownload(pending, downloadId) {
    return (pending || {})[String(downloadId)] || null;
  }

  global.RosewashPdfOpen = Object.freeze({
    DEFAULT_OPENER,
    SEREIN_TEMPLATE,
    addPendingDownload,
    expandOpenerTemplate,
    fileUrlFromPath,
    isPdfUrl,
    normalizeOpenerSettings,
    normalizePdfUrl,
    openerTemplate,
    pendingDownload,
    removePendingDownload,
    validateOpenerTemplate
  });
})(globalThis);
