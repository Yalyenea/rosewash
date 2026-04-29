(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const initialSystem = params.get("system") || "light";
  const settings = {
    enabled: true,
    mode: params.get("mode") || "auto",
    disabledHosts: []
  };

  const listeners = new Set();
  const mediaQueryList = {
    matches: initialSystem === "dark",
    media: "(prefers-color-scheme: dark)",
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
    dispatch(matches) {
      this.matches = matches;
      const event = { matches, media: this.media };
      for (const listener of listeners) {
        listener(event);
      }
    }
  };

  window.matchMedia = (query) => {
    if (query === "(prefers-color-scheme: dark)") {
      return mediaQueryList;
    }

    return {
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {}
    };
  };

  window.chrome = {
    runtime: {
      onMessage: {
        addListener() {}
      }
    },
    storage: {
      onChanged: {
        addListener() {}
      },
      sync: {
        get(defaults, callback) {
          callback({ ...defaults, ...settings });
        }
      }
    }
  };

  window.__rosewashMediaQuery = mediaQueryList;
})();

