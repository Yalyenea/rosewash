(function (root) {
  "use strict";

  function computeLayout(entries, gap, anchor = null) {
    const sorted = entries.slice().sort((left, right) => {
      return left.originalY - right.originalY || left.key.localeCompare(right.key);
    });
    const placements = [];
    const scrollPoints = [];
    const checkpoints = [];
    if (sorted.length === 0) {
      return { checkpoints, placements, scrollPoints };
    }

    const anchored = anchor?.key === sorted[0].key;
    const initialY = sorted[0].originalY / 2 + gap;
    let leftY = anchored ? anchor.leftY : initialY;
    let rightY = anchored ? anchor.rightY : initialY;
    const scrollGap = (leftY + rightY) / 2
      - (anchored ? anchor.compactY : sorted[0].originalY / 2);

    for (const current of sorted) {
      const compactY = (leftY + rightY) / 2 - scrollGap;
      checkpoints.push({
        compactY,
        key: current.key,
        leftY,
        rightY
      });
      scrollPoints.push({ nativeY: current.originalY, compactY });

      if (!current.tweet) {
        const y = Math.max(leftY, rightY);
        placements.push({ key: current.key, column: "full", y });
        leftY = y + current.height + gap;
        rightY = leftY;
      } else {
        const column = current.column
          || (leftY <= rightY ? "left" : "right");
        const y = column === "left" ? leftY : rightY;
        placements.push({ key: current.key, column, y });
        if (column === "left") {
          leftY = y + current.height + gap;
        } else {
          rightY = y + current.height + gap;
        }
      }
    }

    const last = sorted[sorted.length - 1];
    scrollPoints.push({
      nativeY: Math.max(last.originalY + last.height, scrollPoints.at(-1).nativeY + 1),
      compactY: (leftY + rightY) / 2 - scrollGap
    });
    return { checkpoints, placements, scrollPoints };
  }

  function reconcileRecords(previous, current) {
    if (current.length === 0) {
      return previous.slice();
    }

    const previousByKey = new Map(previous.map((record) => [record.key, record]));
    const mergedCurrent = current.map((record) => ({
      ...record,
      column: record.column || previousByKey.get(record.key)?.column
    }));
    const currentKeys = new Set(mergedCurrent.map(({ key }) => key));
    const currentOffsets = new Set(
      mergedCurrent.map(({ originalY }) => Math.round(originalY))
    );
    const firstY = Math.min(...mergedCurrent.map(({ originalY }) => originalY));
    const lastY = Math.max(...mergedCurrent.map(({ originalY }) => originalY));
    const retained = previous.filter((record) => {
      return !currentKeys.has(record.key)
        && !currentOffsets.has(Math.round(record.originalY))
        && (record.originalY < firstY || record.originalY > lastY);
    });
    return retained.concat(mergedCurrent);
  }

  function computeStack(entries, gap, anchor = null) {
    const sorted = entries.slice().sort((left, right) => {
      return left.originalY - right.originalY || left.key.localeCompare(right.key);
    });
    const checkpoints = [];
    const placements = [];
    const scrollPoints = [];
    if (sorted.length === 0) {
      return { checkpoints, placements, scrollPoints };
    }

    const anchored = anchor?.key === sorted[0].key;
    let cursor = anchored ? anchor.y : gap;
    const initialCursor = cursor;
    const compactBase = anchored ? anchor.compactY : sorted[0].originalY;
    if (!anchored && sorted[0].originalY > 0) {
      scrollPoints.push({ nativeY: 0, compactY: 0 });
    }
    for (const current of sorted) {
      const compactY = compactBase + cursor - initialCursor;
      checkpoints.push({ compactY, key: current.key, y: cursor });
      placements.push({ key: current.key, y: cursor });
      scrollPoints.push({ nativeY: current.originalY, compactY });
      cursor += current.height + gap;
    }

    const last = sorted[sorted.length - 1];
    scrollPoints.push({
      nativeY: Math.max(last.originalY + last.height, scrollPoints.at(-1).nativeY + 1),
      compactY: compactBase + cursor - initialCursor
    });
    return { checkpoints, placements, scrollPoints };
  }

  function compactOffsetAt(nativeY, points) {
    if (points.length === 0) {
      return nativeY / 2;
    }
    if (points.length === 1) {
      return points[0].compactY + (nativeY - points[0].nativeY) / 2;
    }
    if (nativeY <= points[0].nativeY) {
      return points[0].compactY + (nativeY - points[0].nativeY) / 2;
    }

    let low = 1;
    let high = points.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (nativeY <= points[middle].nativeY) {
        high = middle;
      } else {
        low = middle + 1;
      }
    }

    const upper = points[low];
    if (nativeY <= upper.nativeY) {
      const lower = points[low - 1];
      const ratio = (nativeY - lower.nativeY) / (upper.nativeY - lower.nativeY);
      return lower.compactY + (upper.compactY - lower.compactY) * ratio;
    }

    const last = points[points.length - 1];
    return last.compactY + (nativeY - last.nativeY) / 2;
  }

  root.RosewashXCore = Object.freeze({
    compactOffsetAt,
    computeLayout,
    computeStack,
    reconcileRecords
  });
})(globalThis);
