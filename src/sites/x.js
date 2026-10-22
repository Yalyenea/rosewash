(function () {
  "use strict";

  const ROOT_ATTRIBUTE = "data-rosewash-x-compact";
  const EXPAND_REPLIES_ATTRIBUTE = "data-rosewash-x-expand-replies";
  const ROOT_CHANGE_EVENT = "rosewash:x-compact-change";
  const RAIL_CONTROL_ATTRIBUTE = "data-rosewash-x-rail-control";
  const PROFILE_AVATAR_SELECTOR = "[data-testid^='UserAvatar-Container-']";
  const PROFILE_CARD_SELECTOR = "[data-testid='HoverCard']";
  const POST_SELECTOR = "[data-testid='primaryColumn'] article[data-testid='tweet']";
  const SHOW_MORE_SELECTOR = "[data-testid='tweet-text-show-more-link']";
  const POST_LINK_SELECTOR = "a[href*='/status/']:has(time)";
  const REPLY_UPDATE_SELECTOR = `article[data-testid='tweet'], ${SHOW_MORE_SELECTOR}, ${POST_LINK_SELECTOR}`;
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
  const expandedButtons = new WeakMap();
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

  function expandReplyText() {
    const currentId = window.location.pathname.match(/^\/[^/]+\/status\/(\d+)\/?$/)?.[1];
    if (!currentId) {
      return;
    }
    let belowCurrentPost = false;
    for (const post of document.querySelectorAll(POST_SELECTOR)) {
      const permalink = Array.from(post.querySelectorAll(POST_LINK_SELECTOR))
        .find(link => !link.parentElement.closest("[role='link']"));
      const postId = permalink?.getAttribute("href").match(/\/status\/(\d+)(?:\/|$)/)?.[1];
      if (postId === currentId) {
        belowCurrentPost = true;
        continue;
      }
      // Wait for the current post to mount: ancestors and stale route content
      // must never be mistaken for replies during X's in-page navigation.
      if (!belowCurrentPost || !postId) {
        continue;
      }
      for (const button of post.querySelectorAll(SHOW_MORE_SELECTOR)) {
        if (button.closest("[role='link']") || expandedButtons.get(button) === postId) {
          continue;
        }
        // Record before clicking; X can leave the button mounted while loading.
        // Virtualized cells may later reuse the same button for a different post.
        expandedButtons.set(button, postId);
        button.click();
      }
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
    if (!isEnabled()) {
      return;
    }
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
      if (Array.from(mutation.addedNodes).some(node => node.nodeType === Node.ELEMENT_NODE
        && (node.matches(REPLY_UPDATE_SELECTOR) || node.querySelector(REPLY_UPDATE_SELECTOR)))) {
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
    const compact = isEnabled();
    const expandReplies = document.documentElement.hasAttribute(EXPAND_REPLIES_ATTRIBUTE);
    if (!compact) {
      clearRailControls();
      clearProfileHover();
    }
    if (!compact && !expandReplies) {
      stopObserver();
      return;
    }
    if (compact) prepareRailControls();
    if (expandReplies) expandReplyText();
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
  window.navigation.addEventListener("currententrychange", schedule);
  compactQuery.addEventListener("change", schedule);
  rootObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [ROOT_ATTRIBUTE, EXPAND_REPLIES_ATTRIBUTE]
  });
  sync();
})();
