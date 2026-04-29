(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const initialSystem = params.get("system") || "light";
  const storageDelayFrames = Number(params.get("storageDelayFrames") || "0");
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
      id: "rosewash-test",
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
          const result = { ...defaults, ...settings };
          const resolve = () => {
            if (callback) {
              callback(result);
              return undefined;
            }

            return result;
          };

          if (storageDelayFrames > 0) {
            if (callback) {
              waitFrames(storageDelayFrames, resolve);
              return undefined;
            }

            return new Promise((resolvePromise) => {
              waitFrames(storageDelayFrames, () => {
                resolvePromise(resolve());
              });
            });
          }

          if (callback) {
            resolve();
            return undefined;
          }

          return Promise.resolve(resolve());
        }
      }
    }
  };

  function waitFrames(count, callback) {
    if (count <= 0) {
      callback();
      return;
    }

    window.requestAnimationFrame(() => waitFrames(count - 1, callback));
  }

  window.__rosewashMediaQuery = mediaQueryList;
  window.__rosewashInvalidateExtension = () => {
    window.chrome.runtime.id = "";
    window.chrome.storage.sync.get = () => {
      throw new Error("Extension context invalidated.");
    };
  };
})();
