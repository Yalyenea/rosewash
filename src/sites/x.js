(function () {
  "use strict";

  const ROOT_ATTRIBUTE = "data-rosewash-x-compact";
  const ROOT_CHANGE_EVENT = "rosewash:x-compact-change";
  const RAIL_CONTROL_ATTRIBUTE = "data-rosewash-x-rail-control";
  const RAIL_SELECTOR = [
    "[data-testid='SideNav_NewTweet_Button']",
    "[data-testid='SideNav_AccountSwitcher_Button']"
  ].join(",");
  const compactQuery = window.matchMedia("(min-width: 720px)");

  let timer = 0;
  let watching = false;
  const documentObserver = new MutationObserver(handleMutations);
  const rootObserver = new MutationObserver(handleRootChange);

  function isEnabled() {
    return document.documentElement.hasAttribute(ROOT_ATTRIBUTE)
      && compactQuery.matches;
  }

  function prepareRailControls() {
    for (const control of document.querySelectorAll(RAIL_SELECTOR)) {
      if (control.hasAttribute(RAIL_CONTROL_ATTRIBUTE)) {
        continue;
      }
      control.setAttribute(RAIL_CONTROL_ATTRIBUTE, "");
      control.setAttribute("data-rosewash-ignore", "");
      control.style.setProperty("background-color", "transparent", "important");
      control.style.setProperty("box-shadow", "none", "important");
    }
  }

  function clearRailControls() {
    for (const control of document.querySelectorAll(`[${RAIL_CONTROL_ATTRIBUTE}]`)) {
      control.removeAttribute(RAIL_CONTROL_ATTRIBUTE);
      control.removeAttribute("data-rosewash-ignore");
      control.style.removeProperty("background-color");
      control.style.removeProperty("box-shadow");
    }
  }

  function nodeContainsRail(node) {
    return node.nodeType === Node.ELEMENT_NODE
      && (node.matches(RAIL_SELECTOR) || Boolean(node.querySelector(RAIL_SELECTOR)));
  }

  function handleMutations(mutations) {
    for (const mutation of mutations) {
      if (Array.from(mutation.addedNodes).some(nodeContainsRail)) {
        schedule();
        return;
      }
    }
  }

  function startObserver() {
    if (watching) {
      return;
    }
    documentObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    watching = true;
  }

  function stopObserver() {
    if (!watching) {
      return;
    }
    documentObserver.disconnect();
    watching = false;
  }

  function sync() {
    timer = 0;
    if (!isEnabled()) {
      stopObserver();
      clearRailControls();
      return;
    }
    prepareRailControls();
    startObserver();
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

  document.addEventListener(ROOT_CHANGE_EVENT, handleRootChange);
  compactQuery.addEventListener("change", schedule);
  rootObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [ROOT_ATTRIBUTE]
  });
  sync();
})();
