(function () {
  "use strict";

  const ROOT_ATTRIBUTE = "data-rosewash-x-compact";
  const ROOT_CHANGE_EVENT = "rosewash:x-compact-change";
  const RAIL_CONTROL_ATTRIBUTE = "data-rosewash-x-rail-control";
  const PROFILE_AVATAR_SELECTOR = "[data-testid^='UserAvatar-Container-']";
  const PROFILE_CARD_SELECTOR = "[data-testid='HoverCard']";
  const RAIL_SELECTOR = [
    "[data-testid='SideNav_NewTweet_Button']",
    "[data-testid='SideNav_AccountSwitcher_Button']"
  ].join(",");
  const compactQuery = window.matchMedia("(min-width: 720px)");

  let timer = 0;
  let watching = false;
  let pendingProfileAnchor = null;
  let profileAnchor = null;
  let hoveredProfileCard = null;
  const profileCardAnchors = new WeakMap();
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

  function emitProfileHover(type) {
    if (profileAnchor?.isConnected) {
      profileAnchor.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        relatedTarget: null
      }));
    }
  }

  function clearProfileHover() {
    if (hoveredProfileCard) {
      emitProfileHover("mouseout");
    }
    profileAnchor = null;
    pendingProfileAnchor = null;
    hoveredProfileCard = null;
  }

  function handleProfilePointerOver(event) {
    const target = event.target;
    if (target?.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    const card = target.closest(PROFILE_CARD_SELECTOR);
    if (card) {
      const anchor = profileCardAnchors.get(card);
      if (card !== hoveredProfileCard && anchor?.isConnected) {
        profileAnchor = anchor;
        hoveredProfileCard = card;
        // X polls the avatar's :hover state, which excludes its portaled card.
        // Clear that poll before retaining the native hover state for the card.
        emitProfileHover("mouseout");
        emitProfileHover("mouseover");
      }
      return;
    }
    const anchor = target.closest("a[href]");
    pendingProfileAnchor = anchor?.closest(PROFILE_AVATAR_SELECTOR) ? anchor : null;
  }

  function handleProfilePointerOut(event) {
    if (!hoveredProfileCard || !hoveredProfileCard.contains(event.target)
      || (event.relatedTarget && hoveredProfileCard.contains(event.relatedTarget))) {
      return;
    }
    clearProfileHover();
  }

  function nodeContainsRail(node) {
    return node.nodeType === Node.ELEMENT_NODE
      && (node.matches(RAIL_SELECTOR) || Boolean(node.querySelector(RAIL_SELECTOR)));
  }

  function handleMutations(mutations) {
    for (const mutation of mutations) {
      if (pendingProfileAnchor?.isConnected) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) {
            continue;
          }
          const cards = node.matches(PROFILE_CARD_SELECTOR)
            ? [node] : node.querySelectorAll(PROFILE_CARD_SELECTOR);
          for (const card of cards) {
            if (!profileCardAnchors.has(card)) {
              profileCardAnchors.set(card, pendingProfileAnchor);
            }
          }
        }
      }
      if (Array.from(mutation.addedNodes).some(nodeContainsRail)) {
        schedule();
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
    document.addEventListener("pointerover", handleProfilePointerOver, true);
    document.addEventListener("pointerout", handleProfilePointerOut, true);
  }

  function stopObserver() {
    if (!watching) {
      return;
    }
    documentObserver.disconnect();
    watching = false;
    document.removeEventListener("pointerover", handleProfilePointerOver, true);
    document.removeEventListener("pointerout", handleProfilePointerOut, true);
    clearProfileHover();
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
