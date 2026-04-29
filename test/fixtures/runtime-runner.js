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
      const next = params.get("next");
      if (next === "dark" || next === "light") {
        window.__rosewashMediaQuery.dispatch(next === "dark");
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            logState("after-change");
          });
        });
      }
    });
  });
})();

