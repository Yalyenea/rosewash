(function () {
  "use strict";

  const ROOT_ATTRIBUTE = "data-rosewash-x-compact";
  const ROOT_CHANGE_EVENT = "rosewash:x-compact-change";
  const HOME_ATTRIBUTE = "data-rosewash-x-home";
  const DETAIL_ATTRIBUTE = "data-rosewash-x-detail";
  const TIMELINE_ATTRIBUTE = "data-rosewash-x-timeline";
  const DETAIL_TIMELINE_ATTRIBUTE = "data-rosewash-x-detail-timeline";
  const CELL_ATTRIBUTE = "data-rosewash-x-cell";
  const DETAIL_MAIN_ATTRIBUTE = "data-rosewash-x-detail-main";
  const DETAIL_REPLY_ATTRIBUTE = "data-rosewash-x-detail-reply";
  const DETAIL_REPLIES_ATTRIBUTE = "data-rosewash-x-detail-has-replies";
  const RAIL_CONTROL_ATTRIBUTE = "data-rosewash-x-rail-control";
  const CELL_SELECTOR = "[data-testid='cellInnerDiv']";
  const LAYOUT_TARGET_SELECTOR = [
    "[data-testid='primaryColumn']",
    "[data-testid='cellInnerDiv']",
    "[data-testid='tweetTextarea_0']",
    "[data-testid='SideNav_NewTweet_Button']",
    "[data-testid='SideNav_AccountSwitcher_Button']"
  ].join(",");
  const GAP = 12;
  const MAX_RECORDS = 400;
  const {
    compactOffsetAt,
    computeLayout,
    computeStack,
    reconcileRecords
  } = globalThis.RosewashXCore;

  let timeline = null;
  let timer = 0;
  let timelineTop = 0;
  let documentWatching = false;
  let layoutMode = null;
  let layoutRoute = null;
  let layoutAnchor = null;
  let scrollPoints = [];
  const observedCells = new Set();
  const records = new Map();

  const resizeObserver = new ResizeObserver(scheduleLayout);
  const documentObserver = new MutationObserver(handleDocumentMutations);
  const rootObserver = new MutationObserver(handleRootChange);

  function isEnabled() {
    return document.documentElement.hasAttribute(ROOT_ATTRIBUTE)
      && window.matchMedia("(min-width: 1280px)").matches;
  }

  function isHome() {
    return window.location.pathname === "/home"
      && Boolean(document.querySelector(
        "[data-testid='primaryColumn'] [data-testid='tweetTextarea_0']"
      ));
  }

  function isDetail() {
    return /^\/[^/]+\/status\/\d+/.test(window.location.pathname)
      && Boolean(document.querySelector(
        "[data-testid='primaryColumn'] article[data-testid='tweet']"
      ));
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

  function placeCell(cell, x, y, width) {
    cell.setAttribute(CELL_ATTRIBUTE, "");
    setProperty(cell, "--rosewash-x-cell-x", x);
    setProperty(cell, "--rosewash-x-cell-y", `${y}px`);
    setProperty(cell, "--rosewash-x-cell-width", width);
  }

  function clearCell(cell) {
    cell.removeAttribute(CELL_ATTRIBUTE);
    cell.removeAttribute(DETAIL_MAIN_ATTRIBUTE);
    cell.removeAttribute(DETAIL_REPLY_ATTRIBUTE);
    cell.style.removeProperty("--rosewash-x-cell-x");
    cell.style.removeProperty("--rosewash-x-cell-y");
    cell.style.removeProperty("--rosewash-x-cell-width");
    cell.style.removeProperty("--rosewash-x-detail-y");
  }

  function clearLayout() {
    resizeObserver.disconnect();
    for (const cell of observedCells) {
      clearCell(cell);
    }
    observedCells.clear();
    records.clear();
    layoutAnchor = null;
    scrollPoints = [];
    if (timeline) {
      timeline.removeAttribute(TIMELINE_ATTRIBUTE);
      timeline.removeAttribute(DETAIL_TIMELINE_ATTRIBUTE);
      timeline.removeAttribute(DETAIL_REPLIES_ATTRIBUTE);
      timeline.style.removeProperty("--rosewash-x-scroll-shift");
      const markedCells = [
        `[${CELL_ATTRIBUTE}]`,
        `[${DETAIL_MAIN_ATTRIBUTE}]`,
        `[${DETAIL_REPLY_ATTRIBUTE}]`
      ].join(",");
      for (const cell of timeline.querySelectorAll(markedCells)) {
        clearCell(cell);
      }
    }
    timeline = null;
    layoutMode = null;
    layoutRoute = null;
  }

  function nodeContainsLayoutTarget(node) {
    return node.nodeType === Node.ELEMENT_NODE
      && (node.matches(LAYOUT_TARGET_SELECTOR)
        || Boolean(node.querySelector(LAYOUT_TARGET_SELECTOR)));
  }

  function handleDocumentMutations(mutations) {
    if (layoutRoute && layoutRoute !== currentRouteKey(layoutMode)) {
      scheduleLayout();
      return;
    }
    for (const mutation of mutations) {
      const target = mutation.target.nodeType === Node.ELEMENT_NODE
        ? mutation.target
        : mutation.target.parentElement;
      if (mutation.target === timeline
        || (mutation.type === "attributes" && target?.matches(CELL_SELECTOR))
        || (mutation.type === "childList" && Boolean(target?.closest(CELL_SELECTOR)))
        || Array.from(mutation.addedNodes).some(nodeContainsLayoutTarget)
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
      attributeFilter: ["style"],
      attributes: true,
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

  function updateScrollShift() {
    if (!timeline) {
      return;
    }
    if (scrollPoints.length === 0) {
      setProperty(timeline, "--rosewash-x-scroll-shift", "0px");
      return;
    }

    const relativeScroll = Math.max(0, window.scrollY - timelineTop);
    const compactScroll = compactOffsetAt(relativeScroll, scrollPoints);
    setProperty(
      timeline,
      "--rosewash-x-scroll-shift",
      `${relativeScroll - compactScroll}px`
    );
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

  function computeCurrentLayout(cells) {
    const sorted = Array.from(records.values()).sort((left, right) => {
      return left.originalY - right.originalY || left.key.localeCompare(right.key);
    });
    if (layoutAnchor?.key !== sorted[0]?.key) {
      layoutAnchor = null;
    }

    let result = computeLayout(sorted, GAP, layoutAnchor);
    syncColumns(result);
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
    let start = Math.max(0, Math.min(firstCurrent - 80, sorted.length - MAX_RECORDS));
    if (lastCurrent >= start + MAX_RECORDS) {
      start = lastCurrent - MAX_RECORDS + 1;
    }

    const checkpoints = new Map(result.checkpoints.map((entry) => [entry.key, entry]));
    const end = Math.max(start + MAX_RECORDS, lastCurrent + 1);
    const retained = sorted.slice(start, end);
    const first = retained[0];
    const checkpoint = checkpoints.get(first.key);
    layoutAnchor = start === 0 ? null : {
      compactY: checkpoint.compactY,
      key: first.key,
      leftY: checkpoint.leftY,
      rightY: checkpoint.rightY
    };
    records.clear();
    for (const record of retained) {
      records.set(record.key, record);
    }
    result = computeLayout(retained, GAP, layoutAnchor);
    syncColumns(result);
    return result;
  }

  function syncColumns(result) {
    for (const placement of result.placements) {
      if (placement.column === "full") {
        continue;
      }
      const record = records.get(placement.key);
      if (record && !record.column) {
        record.column = placement.column;
      }
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
      compactY: checkpoint.compactY,
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

  function currentRouteKey(mode) {
    if (mode === "detail") {
      const match = window.location.pathname.match(/^\/[^/]+\/status\/(\d+)/);
      return match ? `status:${match[1]}` : null;
    }
    return mode === "home" && window.location.pathname === "/home" ? "/home" : null;
  }

  function prepareTimeline(nextTimeline, mode) {
    const nextRoute = currentRouteKey(mode);
    if ((timeline && timeline !== nextTimeline)
      || layoutMode !== mode
      || (layoutRoute && layoutRoute !== nextRoute)) {
      clearLayout();
    }
    timeline = nextTimeline;
    layoutMode = mode;
    layoutRoute = nextRoute;
    timelineTop = timeline.getBoundingClientRect().top + window.scrollY;
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

  function layoutHome() {
    const nextTimeline = findTimeline();
    if (!nextTimeline) {
      clearLayout();
      return;
    }

    prepareTimeline(nextTimeline, "home");
    timeline.setAttribute(TIMELINE_ATTRIBUTE, "");

    const cells = collectCells();
    syncCells(cells);
    const result = computeCurrentLayout(cells);
    scrollPoints = result.scrollPoints;
    const placements = new Map(result.placements.map((entry) => [entry.key, entry]));
    const halfWidth = `calc((100% - ${GAP * 3}px) / 2)`;
    const fullWidth = `calc(100% - ${GAP * 2}px)`;
    for (const { cell, key } of cells) {
      const placement = placements.get(key);
      if (placement.column === "full") {
        placeCell(cell, `${GAP}px`, placement.y, fullWidth);
      } else {
        const x = placement.column === "right"
          ? `calc(100% + ${GAP * 2}px)`
          : `${GAP}px`;
        placeCell(cell, x, placement.y, halfWidth);
      }
    }
    updateScrollShift();
  }

  function layoutDetail() {
    const nextTimeline = findTimeline();
    if (!nextTimeline) {
      clearLayout();
      return;
    }

    prepareTimeline(nextTimeline, "detail");
    timeline.setAttribute(DETAIL_TIMELINE_ATTRIBUTE, "");
    const cells = collectCells();
    const route = currentRouteKey("detail");
    const main = cells.find(({ cell }) => statusPath(cell) === route);
    if (!main) {
      clearLayout();
      return;
    }

    const replies = cells.filter((entry) => entry !== main);
    syncCells(replies);
    clearCell(main.cell);
    main.cell.setAttribute(DETAIL_MAIN_ATTRIBUTE, "");
    timeline.toggleAttribute(DETAIL_REPLIES_ATTRIBUTE, replies.length > 0);
    const result = computeCurrentStack(replies);
    scrollPoints = result.scrollPoints;
    const placements = new Map(result.placements.map((entry) => [entry.key, entry]));
    for (const { cell, key } of replies) {
      cell.setAttribute(DETAIL_REPLY_ATTRIBUTE, "");
      setProperty(cell, "--rosewash-x-detail-y", `${placements.get(key).y}px`);
    }
    updateScrollShift();
  }

  function layout() {
    timer = 0;
    if (!isEnabled()) {
      document.documentElement.removeAttribute(HOME_ATTRIBUTE);
      document.documentElement.removeAttribute(DETAIL_ATTRIBUTE);
      stopDocumentObserver();
      clearLayout();
      clearRailControls();
      return;
    }

    startDocumentObserver();
    prepareRailControls();
    const home = isHome();
    const detail = !home && isDetail();
    document.documentElement.toggleAttribute(HOME_ATTRIBUTE, home);
    document.documentElement.toggleAttribute(DETAIL_ATTRIBUTE, detail);
    if (home) {
      layoutHome();
    } else if (detail) {
      layoutDetail();
    } else {
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

  window.addEventListener("scroll", () => {
    updateScrollShift();
  }, { passive: true });
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
