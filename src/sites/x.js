(function () {
  "use strict";

  const ROOT_ATTRIBUTE = "data-rosewash-x-compact";
  const ROOT_CHANGE_EVENT = "rosewash:x-compact-change";
  const DETAIL_ATTRIBUTE = "data-rosewash-x-detail";
  const DETAIL_TIMELINE_ATTRIBUTE = "data-rosewash-x-detail-timeline";
  const DETAIL_MAIN_ATTRIBUTE = "data-rosewash-x-detail-main";
  const DETAIL_SNAPSHOT_ATTRIBUTE = "data-rosewash-x-detail-snapshot";
  const DETAIL_REPLY_ATTRIBUTE = "data-rosewash-x-detail-reply";
  const DETAIL_REPLIES_ATTRIBUTE = "data-rosewash-x-detail-has-replies";
  const RAIL_CONTROL_ATTRIBUTE = "data-rosewash-x-rail-control";
  const CELL_SELECTOR = "[data-testid='cellInnerDiv']";
  const LAYOUT_TARGET_SELECTOR = [
    "[data-testid='primaryColumn']",
    "[data-testid='cellInnerDiv']",
    "[data-testid='SideNav_NewTweet_Button']",
    "[data-testid='SideNav_AccountSwitcher_Button']"
  ].join(",");
  const GAP = 12;
  const MAX_RECORDS = 400;
  const {
    computeStack,
    reconcileRecords
  } = globalThis.RosewashXCore;

  let timeline = null;
  let timer = 0;
  let documentWatching = false;
  let layoutRoute = null;
  let layoutAnchor = null;
  let detailMainCell = null;
  let detailMainTemplate = null;
  let detailMainSnapshot = null;
  let snapshotTimer = 0;
  const observedCells = new Set();
  const records = new Map();

  const resizeObserver = new ResizeObserver(scheduleLayout);
  const documentObserver = new MutationObserver(handleDocumentMutations);
  const rootObserver = new MutationObserver(handleRootChange);

  function isEnabled() {
    return document.documentElement.hasAttribute(ROOT_ATTRIBUTE)
      && window.matchMedia("(min-width: 1280px)").matches;
  }

  function isDetail() {
    return /^\/[^/]+\/status\/\d+/.test(window.location.pathname);
  }

  function parseTranslateY(cell) {
    const match = cell.style.transform.match(/translateY\((-?[\d.]+)px\)/);
    return match ? Number(match[1]) : null;
  }

  function setProperty(element, property, value) {
    if (element.style.getPropertyValue(property) !== value) {
      element.style.setProperty(property, value);
    }
  }

  function prepareRailControls() {
    const selector = [
      "[data-testid='SideNav_NewTweet_Button']",
      "[data-testid='SideNav_AccountSwitcher_Button']"
    ].join(",");
    for (const control of document.querySelectorAll(selector)) {
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

  function clearCell(cell) {
    cell.removeAttribute(DETAIL_MAIN_ATTRIBUTE);
    cell.removeAttribute(DETAIL_REPLY_ATTRIBUTE);
    cell.style.removeProperty("--rosewash-x-detail-height");
    cell.style.removeProperty("--rosewash-x-detail-y");
  }

  function clearLayout() {
    if (snapshotTimer) {
      window.clearTimeout(snapshotTimer);
      snapshotTimer = 0;
    }
    resizeObserver.disconnect();
    for (const cell of observedCells) {
      clearCell(cell);
    }
    observedCells.clear();
    records.clear();
    layoutAnchor = null;
    if (timeline) {
      timeline.removeAttribute(DETAIL_TIMELINE_ATTRIBUTE);
      timeline.removeAttribute(DETAIL_REPLIES_ATTRIBUTE);
      timeline.style.removeProperty("transform");
      const markedCells = [
        `[${DETAIL_MAIN_ATTRIBUTE}]`,
        `[${DETAIL_REPLY_ATTRIBUTE}]`
      ].join(",");
      for (const cell of timeline.querySelectorAll(markedCells)) {
        clearCell(cell);
      }
    }
    detailMainSnapshot?.remove();
    timeline = null;
    layoutRoute = null;
    detailMainCell = null;
    detailMainTemplate = null;
    detailMainSnapshot = null;
  }

  function nodeContainsLayoutTarget(node) {
    return node.nodeType === Node.ELEMENT_NODE
      && (node.matches(LAYOUT_TARGET_SELECTOR)
        || Boolean(node.querySelector(LAYOUT_TARGET_SELECTOR)));
  }

  function handleDocumentMutations(mutations) {
    if (layoutRoute && layoutRoute !== currentRouteKey()) {
      scheduleLayout();
      return;
    }
    for (const mutation of mutations) {
      const target = mutation.target.nodeType === Node.ELEMENT_NODE
        ? mutation.target
        : mutation.target.parentElement;
      if (mutation.target === timeline) {
        scheduleLayout();
        return;
      }
      const cell = target?.closest(CELL_SELECTOR);
      if (cell === detailMainCell) {
        scheduleMainSnapshot();
        continue;
      }
      if (target?.matches(CELL_SELECTOR)) {
        scheduleLayout();
        return;
      }
      if (cell) {
        continue;
      }
      if (Array.from(mutation.addedNodes).some(nodeContainsLayoutTarget)
        || Array.from(mutation.removedNodes).some(nodeContainsLayoutTarget)) {
        scheduleLayout();
        return;
      }
    }
  }

  function startDocumentObserver() {
    if (documentWatching) {
      return;
    }
    documentObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    documentWatching = true;
  }

  function stopDocumentObserver() {
    if (!documentWatching) {
      return;
    }
    documentObserver.disconnect();
    documentWatching = false;
  }

  function cellKey(cell, originalY, tweet) {
    const time = cell.querySelector("article[data-testid='tweet'] time");
    const statusLink = time?.closest("a[href*='/status/']");
    if (statusLink) {
      return `status:${new URL(statusLink.href, window.location.href).pathname}`;
    }
    return `native:${tweet ? "tweet" : "module"}:${Math.round(originalY)}`;
  }

  function collectCells() {
    return Array.from(timeline.children)
      .filter((element) => element.matches(CELL_SELECTOR))
      .map((cell) => {
        const originalY = parseTranslateY(cell);
        const tweet = Boolean(cell.querySelector("article[data-testid='tweet']"));
        return originalY === null ? null : {
          cell,
          height: cell.offsetHeight,
          key: cellKey(cell, originalY, tweet),
          originalY,
          tweet
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.originalY - right.originalY);
  }

  function syncCells(cells) {
    const currentCells = new Set(cells.map(({ cell }) => cell));
    for (const cell of observedCells) {
      if (!currentCells.has(cell)) {
        resizeObserver.unobserve(cell);
        clearCell(cell);
        observedCells.delete(cell);
      }
    }
    for (const { cell } of cells) {
      if (!observedCells.has(cell)) {
        resizeObserver.observe(cell);
        observedCells.add(cell);
      }
    }

    const current = cells.map((entry) => ({
      height: entry.height,
      key: entry.key,
      originalY: entry.originalY,
      tweet: entry.tweet
    }));
    const merged = reconcileRecords(Array.from(records.values()), current);
    records.clear();
    for (const record of merged) {
      records.set(record.key, record);
    }
  }

  function computeCurrentStack(cells) {
    const sorted = Array.from(records.values()).sort((left, right) => {
      return left.originalY - right.originalY || left.key.localeCompare(right.key);
    });
    if (layoutAnchor?.key !== sorted[0]?.key) {
      layoutAnchor = null;
    }

    let result = computeStack(sorted, GAP, layoutAnchor);
    if (sorted.length <= MAX_RECORDS) {
      return result;
    }

    const currentKeys = new Set(cells.map(({ key }) => key));
    const currentIndexes = sorted.flatMap((record, index) => {
      return currentKeys.has(record.key) ? [index] : [];
    });
    if (currentIndexes.length === 0) {
      return result;
    }
    const firstCurrent = Math.min(...currentIndexes);
    const lastCurrent = Math.max(...currentIndexes);
    const start = Math.max(
      0,
      Math.min(firstCurrent - 80, sorted.length - MAX_RECORDS)
    );
    const end = Math.max(start + MAX_RECORDS, lastCurrent + 1);
    const retained = sorted.slice(start, end);
    const checkpoint = new Map(
      result.checkpoints.map((entry) => [entry.key, entry])
    ).get(retained[0].key);
    layoutAnchor = start === 0 ? null : {
      key: checkpoint.key,
      y: checkpoint.y
    };
    records.clear();
    for (const record of retained) {
      records.set(record.key, record);
    }
    result = computeStack(retained, GAP, layoutAnchor);
    return result;
  }

  function findTimeline() {
    return document.querySelector(
      "[data-testid='primaryColumn'] div:has(> [data-testid='cellInnerDiv'])"
    );
  }

  function currentRouteKey() {
    const match = window.location.pathname.match(/^\/[^/]+\/status\/(\d+)/);
    return match ? `status:${match[1]}` : null;
  }

  function prepareTimeline(nextTimeline) {
    const nextRoute = currentRouteKey();
    const changed = timeline !== nextTimeline
      || layoutRoute !== nextRoute;
    if (changed) {
      clearLayout();
    }
    timeline = nextTimeline;
    layoutRoute = nextRoute;
  }

  function statusPath(cell) {
    for (const link of cell.querySelectorAll("article[data-testid='tweet'] a[href*='/status/']")) {
      const path = new URL(link.href, window.location.href).pathname;
      const match = path.match(/^\/[^/]+\/status\/(\d+)/);
      if (match) {
        return `status:${match[1]}`;
      }
    }
    return null;
  }

  function captureMainCell(cell) {
    detailMainTemplate = {
      className: cell.className,
      dir: cell.getAttribute("dir"),
      html: cell.innerHTML,
      scrollTop: cell.scrollTop,
      tagName: cell.tagName.toLowerCase()
    };
  }

  function createMainSnapshot() {
    if (!detailMainTemplate) {
      return null;
    }
    const snapshot = document.createElement(detailMainTemplate.tagName);
    snapshot.className = detailMainTemplate.className;
    snapshot.innerHTML = detailMainTemplate.html;
    if (detailMainTemplate.dir) {
      snapshot.setAttribute("dir", detailMainTemplate.dir);
    }
    snapshot.removeAttribute("data-testid");
    clearCell(snapshot);
    snapshot.setAttribute(DETAIL_MAIN_ATTRIBUTE, "");
    snapshot.setAttribute(DETAIL_SNAPSHOT_ATTRIBUTE, "");
    for (const frame of snapshot.querySelectorAll("iframe")) {
      frame.remove();
    }
    for (const video of snapshot.querySelectorAll("video")) {
      const media = document.createElement(video.poster ? "img" : "div");
      if (video.poster) {
        media.src = video.poster;
        media.alt = "";
      }
      media.style.cssText = [
        "background:var(--rosewash-overlay)",
        "display:block",
        "height:100%",
        "object-fit:cover",
        "width:100%"
      ].join(";");
      video.replaceWith(media);
    }
    snapshot.scrollTop = detailMainTemplate.scrollTop;
    return snapshot;
  }

  function scheduleMainSnapshot() {
    if (snapshotTimer || !detailMainCell?.isConnected) {
      return;
    }
    snapshotTimer = window.setTimeout(() => {
      snapshotTimer = 0;
      if (!detailMainCell?.isConnected) {
        return;
      }
      captureMainCell(detailMainCell);
    }, 300);
  }

  function layoutDetail() {
    const nextTimeline = findTimeline() || (timeline?.isConnected ? timeline : null);
    if (!nextTimeline) {
      return;
    }

    prepareTimeline(nextTimeline);
    timeline.setAttribute(DETAIL_TIMELINE_ATTRIBUTE, "");
    const cells = collectCells();
    const route = currentRouteKey();
    const main = cells.find(({ cell }) => statusPath(cell) === route);
    if (main && detailMainCell !== main.cell) {
      if (detailMainCell?.isConnected) {
        clearCell(detailMainCell);
      }
      detailMainCell = main.cell;
      captureMainCell(detailMainCell);
      scheduleMainSnapshot();
    }
    if (!detailMainCell && !detailMainTemplate) {
      return;
    }

    const activeMain = detailMainCell?.isConnected
      && timeline.contains(detailMainCell)
      ? detailMainCell
      : null;
    const replies = cells.filter(({ cell }) => cell !== activeMain);
    syncCells(replies);
    if (activeMain) {
      detailMainSnapshot?.remove();
      detailMainSnapshot = null;
      clearCell(activeMain);
      activeMain.setAttribute(DETAIL_MAIN_ATTRIBUTE, "");
    } else {
      detailMainCell = null;
      detailMainSnapshot ||= createMainSnapshot();
      if (detailMainSnapshot && !detailMainSnapshot.isConnected) {
        timeline.append(detailMainSnapshot);
      }
    }
    timeline.toggleAttribute(DETAIL_REPLIES_ATTRIBUTE, replies.length > 0);
    const result = computeCurrentStack(replies);
    const placements = new Map(result.placements.map((entry) => [entry.key, entry]));
    for (const { cell, height, key } of replies) {
      cell.setAttribute(DETAIL_REPLY_ATTRIBUTE, "");
      setProperty(cell, "--rosewash-x-detail-height", `${height}px`);
      setProperty(cell, "--rosewash-x-detail-y", `${placements.get(key).y}px`);
    }
    timeline.style.removeProperty("transform");
  }

  function layout() {
    timer = 0;
    if (!isEnabled()) {
      document.documentElement.removeAttribute(DETAIL_ATTRIBUTE);
      stopDocumentObserver();
      clearLayout();
      clearRailControls();
      return;
    }

    prepareRailControls();
    const detail = isDetail();
    document.documentElement.toggleAttribute(DETAIL_ATTRIBUTE, detail);
    if (detail) {
      startDocumentObserver();
      layoutDetail();
    } else {
      stopDocumentObserver();
      clearLayout();
    }
  }

  function scheduleLayout() {
    if (timer) {
      return;
    }
    timer = window.setTimeout(layout, 16);
  }

  function handleRootChange() {
    if (timer) {
      window.clearTimeout(timer);
    }
    timer = 0;
    layout();
  }

  window.addEventListener("resize", scheduleLayout, { passive: true });
  window.addEventListener("popstate", scheduleLayout, { passive: true });
  document.addEventListener(ROOT_CHANGE_EVENT, handleRootChange);
  window.matchMedia("(min-width: 1280px)").addEventListener("change", scheduleLayout);
  rootObserver.disconnect();
  rootObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [ROOT_ATTRIBUTE]
  });
  layout();
})();
