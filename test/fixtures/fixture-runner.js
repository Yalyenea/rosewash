(function () {
  "use strict";

  window.addEventListener("DOMContentLoaded", () => {
    const engine = window.RosewashCore.createEngine({ document, window });
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode") || "dawn";
    const system = params.get("system");
    if (system === "dark" || system === "light") {
      window.matchMedia = (query) => ({
        matches: query === "(prefers-color-scheme: dark)" && system === "dark",
        media: query,
        addEventListener() {},
        removeEventListener() {}
      });
    }

    const sequence = (params.get("sequence") || mode)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    let result = null;
    for (const entry of sequence) {
      result = engine.apply({ enabled: true, mode: entry, disabledHosts: [] });
    }

    document.body.dataset.fixtureReady = "true";
    console.log(`rosewash fixture ${JSON.stringify(result)}`);
  });
})();
