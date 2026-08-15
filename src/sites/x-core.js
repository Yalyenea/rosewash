(function (root) {
  "use strict";

  function reconcileRecords(previous, current) {
    if (current.length === 0) {
      return previous.slice();
    }

    const currentKeys = new Set(current.map(({ key }) => key));
    const currentOffsets = new Set(
      current.map(({ originalY }) => Math.round(originalY))
    );
    const firstY = Math.min(...current.map(({ originalY }) => originalY));
    const lastY = Math.max(...current.map(({ originalY }) => originalY));
    const retained = previous.filter((record) => {
      return !currentKeys.has(record.key)
        && !currentOffsets.has(Math.round(record.originalY))
        && (record.originalY < firstY || record.originalY > lastY);
    });
    return retained.concat(current);
  }

  function computeStack(entries, gap, anchor = null) {
    const sorted = entries.slice().sort((left, right) => {
      return left.originalY - right.originalY || left.key.localeCompare(right.key);
    });
    const checkpoints = [];
    const placements = [];
    if (sorted.length === 0) {
      return { checkpoints, placements };
    }

    const anchored = anchor?.key === sorted[0].key;
    let cursor = anchored ? anchor.y : gap;
    for (const current of sorted) {
      checkpoints.push({ key: current.key, y: cursor });
      placements.push({ key: current.key, y: cursor });
      cursor += current.height + gap;
    }
    return { checkpoints, placements };
  }

  root.RosewashXCore = Object.freeze({
    computeStack,
    reconcileRecords
  });
})(globalThis);
