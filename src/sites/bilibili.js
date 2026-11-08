(function () {
  "use strict";

  const LAYOUT_ATTRIBUTE = "data-rosewash-bilibili-layout";
  const LAYOUT_EVENT = "rosewash:bilibili-layout-change";
  const PAGE_ATTRIBUTES = {
    dynamic: "data-rosewash-bilibili-dynamic",
    home: "data-rosewash-bilibili-home",
    read: "data-rosewash-bilibili-read",
    video: "data-rosewash-bilibili-video"
  };

  let timer = 0;
  let videoObserving = false;
  let commentOriginParent = null;
  let commentOriginNextSibling = null;
  const rootObserver = new MutationObserver(handleRootChange);
  const videoObserver = new MutationObserver(schedule);

  function pageKind() {
    const host = String(window.location.hostname || "").toLowerCase();
    const path = window.location.pathname || "/";
    if (host === "t.bilibili.com" || /^\/v\/popular(?:\/|$)/.test(path)) {
      return "dynamic";
    }
    if (/^\/(?:video|bangumi\/play|cheese\/play|list)\//.test(path)) {
      return "video";
    }
    if (/^\/(?:read\/cv\d+|opus\/\d+)/.test(path)) {
      return "read";
    }
    if ((host === "www.bilibili.com" || host === "bilibili.com" || !host)
      && (path === "/" || path === "/index.html")) {
      return "home";
    }
    return "";
  }

  function disconnectVideoObserver() {
    if (!videoObserving) {
      return;
    }
    videoObserver.disconnect?.();
    videoObserving = false;
  }

  function isVideoHydrated() {
    const headerHost = document.querySelector?.("#biliMainHeader");
    if (!headerHost) {
      return true;
    }
    return Boolean(
      document.querySelector?.("#biliMainHeader .bili-header, .bili-header__bar, .mini-header")
    );
  }

  function syncVideoComments(active) {
    const comment = document.querySelector?.("#commentapp");
    if (!active) {
      disconnectVideoObserver();
      if (comment && commentOriginParent && comment.parentNode !== commentOriginParent) {
        if (commentOriginNextSibling && commentOriginNextSibling.parentNode === commentOriginParent) {
          commentOriginParent.insertBefore(comment, commentOriginNextSibling);
        } else {
          commentOriginParent.appendChild(comment);
        }
      }
      commentOriginParent = null;
      commentOriginNextSibling = null;
      return;
    }

    const rightColumn = document.querySelector?.(".right-container-inner");
    if (comment && rightColumn && isVideoHydrated()) {
      if (comment.parentNode !== rightColumn) {
        commentOriginParent = comment.parentNode;
        commentOriginNextSibling = comment.nextSibling;
        rightColumn.appendChild(comment);
        window.dispatchEvent?.(new Event("scroll"));
      }
      disconnectVideoObserver();
      return;
    }

    if (!videoObserving) {
      videoObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
      videoObserving = true;
    }
  }

  function sync() {
    timer = 0;
    const kind = document.documentElement.hasAttribute(LAYOUT_ATTRIBUTE)
      ? pageKind()
      : "";
    for (const [name, attribute] of Object.entries(PAGE_ATTRIBUTES)) {
      const active = kind === name;
      if (document.documentElement.hasAttribute(attribute) !== active) {
        document.documentElement.toggleAttribute(attribute, active);
      }
    }
    syncVideoComments(kind === "video");
  }

  function schedule() {
    if (timer) {
      return;
    }
    timer = window.setTimeout(sync, 16);
  }

  function handleRootChange() {
    if (timer) {
      window.clearTimeout(timer);
    }
    timer = 0;
    sync();
  }

  // Native navigation events also reach isolated content scripts when the page
  // changes its history from the main world.
  window.navigation.addEventListener("currententrychange", schedule);
  window.addEventListener("DOMContentLoaded", schedule);
  window.addEventListener("load", schedule);
  document.addEventListener(LAYOUT_EVENT, handleRootChange);
  rootObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [LAYOUT_ATTRIBUTE]
  });
  sync();
})();
