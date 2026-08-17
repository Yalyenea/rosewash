(function () {
  "use strict";

  const LAYOUT_ATTRIBUTE = "data-rosewash-zhihu-layout";
  const ARTICLE_ATTRIBUTE = "data-rosewash-zhihu-article";
  const LAYOUT_EVENT = "rosewash:zhihu-layout-change";
  const compactQuery = window.matchMedia("(min-width: 720px)");

  let timer = 0;
  const rootObserver = new MutationObserver(handleRootChange);

  function isArticle() {
    return /^\/p\/\d+/.test(window.location.pathname);
  }

  function isEnabled() {
    return document.documentElement.hasAttribute(LAYOUT_ATTRIBUTE)
      && compactQuery.matches
      && isArticle();
  }

  function sync() {
    timer = 0;
    const active = isEnabled();
    if (document.documentElement.hasAttribute(ARTICLE_ATTRIBUTE) !== active) {
      document.documentElement.toggleAttribute(ARTICLE_ATTRIBUTE, active);
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
