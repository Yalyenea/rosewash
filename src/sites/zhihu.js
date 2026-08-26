(function () {
  "use strict";

  const LAYOUT_ATTRIBUTE = "data-rosewash-zhihu-layout";
  const LAYOUT_EVENT = "rosewash:zhihu-layout-change";
  const PAGE_ATTRIBUTES = {
    article: "data-rosewash-zhihu-article",
    home: "data-rosewash-zhihu-home",
    question: "data-rosewash-zhihu-question"
  };
  const compactQuery = window.matchMedia("(min-width: 720px)");

  let timer = 0;
  const rootObserver = new MutationObserver(handleRootChange);

  function pageKind() {
    const path = window.location.pathname;
    if (/^\/p\/\d+/.test(path)) {
      return "article";
    }
    if (/^\/question\/\d+/.test(path)) {
      return "question";
    }
    if (path === "/" || path === "/follow" || path === "/hot") {
      return "home";
    }
    return "";
  }

  function sync() {
    timer = 0;
    const kind = document.documentElement.hasAttribute(LAYOUT_ATTRIBUTE)
      && compactQuery.matches
      ? pageKind()
      : "";
    for (const [name, attribute] of Object.entries(PAGE_ATTRIBUTES)) {
      const active = kind === name;
      if (document.documentElement.hasAttribute(attribute) !== active) {
        document.documentElement.toggleAttribute(attribute, active);
      }
    }
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

  window.addEventListener("popstate", schedule, { passive: true });
  document.addEventListener(LAYOUT_EVENT, handleRootChange);
  compactQuery.addEventListener("change", schedule);
  rootObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [LAYOUT_ATTRIBUTE],
    childList: true,
    subtree: true
  });
  sync();
})();
