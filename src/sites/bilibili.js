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
  const VIDEO_PROPERTIES = {
    x: "--rosewash-bilibili-comment-x",
    top: "--rosewash-bilibili-comment-top",
    width: "--rosewash-bilibili-comment-width",
    height: "--rosewash-bilibili-comment-height"
  };

  let timer = 0;
  let videoObserving = false;
  let videoElements = [];
  let commentScrollTarget = null;
  const rootObserver = new MutationObserver(handleRootChange);
  const videoObserver = new MutationObserver(schedule);
  const videoResizeObserver = new ResizeObserver(schedule);

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

  function syncVideoComments(active) {
    if (!active) {
      syncCommentScroll(null);
      videoObserver.disconnect();
      videoResizeObserver.disconnect();
      videoObserving = false;
      videoElements = [];
      for (const property of Object.values(VIDEO_PROPERTIES)) {
        document.documentElement.style.removeProperty(property);
      }
      return;
    }

    if (!videoObserving) {
      videoObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
      videoObserving = true;
    }

    const comment = document.querySelector("#commentapp");
    syncCommentScroll(comment);
    const leftColumn = document.querySelector(".left-container");
    const rightContent = document.querySelector(".right-container-inner");
    const elements = [comment, leftColumn, rightContent];
    if (elements.some((element, index) => element !== videoElements[index])) {
      videoResizeObserver.disconnect();
      videoElements = elements;
      for (const element of elements) {
        if (element) videoResizeObserver.observe(element);
      }
    }
    if (!comment || !leftColumn || !rightContent) return;

    // Moving <bili-comments> (even through an ancestor) runs its unload/init
    // callbacks. Keep the native DOM intact and position its box beside the player.
    const rightContentRect = rightContent.getBoundingClientRect();
    const top = Math.max(16, rightContentRect.bottom + 18);
    const values = {
      x: rightContentRect.left,
      top,
      width: rightContentRect.width,
      height: Math.max(0, window.innerHeight - top - 16)
    };
    for (const [key, value] of Object.entries(values)) {
      const property = VIDEO_PROPERTIES[key];
      const next = `${value}px`;
      if (document.documentElement.style.getPropertyValue(property) !== next) {
        document.documentElement.style.setProperty(property, next);
      }
    }
  }

  function relayCommentScroll() {
    // Bilibili's next-page loader listens on window, even when the comments
    // themselves scroll in a separate panel.
    window.dispatchEvent(new Event("scroll"));
  }

  function syncCommentScroll(comment) {
    if (comment === commentScrollTarget) return;
    commentScrollTarget?.removeEventListener("scroll", relayCommentScroll);
    commentScrollTarget = comment;
    commentScrollTarget?.addEventListener("scroll", relayCommentScroll, { passive: true });
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
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule);
  document.addEventListener(LAYOUT_EVENT, handleRootChange);
  rootObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [LAYOUT_ATTRIBUTE]
  });
  sync();
})();
