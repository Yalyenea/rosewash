(function () {
  "use strict";

  function logState(label) {
    const root = document.documentElement;
    console.log(`rosewash runtime ${label} ${JSON.stringify({
      theme: root.dataset.rosewashTheme,
      bodyColor: getComputedStyle(document.body).color,
      bodyBackground: getComputedStyle(document.body).backgroundColor
    })}`);
  }

  window.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    window.requestAnimationFrame(() => {
      logState("initial");
      const storageDelayFrames = Number(params.get("storageDelayFrames") || "0");
      if (storageDelayFrames > 0) {
        waitFrames(storageDelayFrames + 1, () => logState("after-storage"));
      }

      const next = params.get("next");
      if (next === "dark" || next === "light") {
        if (params.get("invalidate") === "before-change") {
          window.__rosewashInvalidateExtension();
        }

        window.__rosewashMediaQuery.dispatch(next === "dark");
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            logState("after-change");
          });
        });
      }
    });
  });

  function waitFrames(count, callback) {
    if (count <= 0) {
      callback();
      return;
    }

    window.requestAnimationFrame(() => waitFrames(count - 1, callback));
  }
})();
