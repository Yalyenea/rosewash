(function () {
  "use strict";

  // The picker belongs to the page the user sees, not to embedded frames.
  if (window.top !== window) return;

  const core = globalThis.RosewashCore;
  const START_MESSAGE = "rosewash:start-picker";
  let session = null;

  function composedParent(element) {
    return element.parentElement || element.parentNode?.host || null;
  }

  function countMatches(element) {
    return (selector) => element.getRootNode().querySelectorAll(selector).length;
  }

  function createOverlay(palette) {
    const host = document.createElement("div");
    host.setAttribute("data-rosewash-ignore", "");
    host.tabIndex = -1;
    // Palette tokens inherit from the host into the shadow tree; `all` leaves custom properties alone.
    for (const token of ["surface", "text", "muted", "link"]) host.style.setProperty(`--${token}`, palette[token]);
    const shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .box, .tip { position: fixed; z-index: 2147483647; pointer-events: none; box-sizing: border-box; }
        .box {
          border: 2px solid var(--link); background: color-mix(in srgb, var(--link) 14%, transparent);
          border-radius: 3px; transition: all 60ms ease-out;
        }
        .tip {
          max-width: min(520px, calc(100vw - 16px)); padding: 6px 9px; border-radius: 6px;
          background: var(--surface); color: var(--text); font: 12px/1.45 ui-sans-serif, system-ui, sans-serif;
          box-shadow: 0 4px 16px rgb(0 0 0 / 0.25);
        }
        .selector { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--link); word-break: break-all; }
        .hint { color: var(--muted); }
      </style>
      <div class="box"></div>
      <div class="tip"><div class="selector"></div><div class="hint">Click to ignore · ↑ parent · ↓ child · Esc cancel</div></div>
    `;
    document.documentElement.append(host);
    return {
      host,
      box: shadow.querySelector(".box"),
      tip: shadow.querySelector(".tip"),
      selector: shadow.querySelector(".selector"),
      hint: shadow.querySelector(".hint")
    };
  }

  function paint() {
    const { overlay, target } = session;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    Object.assign(overlay.box.style, {
      left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`
    });
    overlay.selector.textContent = core.selectorForElement(target, countMatches(target));
    const tipTop = rect.top > 64 ? rect.top - overlay.tip.offsetHeight - 6 : Math.min(rect.bottom + 6, window.innerHeight - overlay.tip.offsetHeight - 8);
    Object.assign(overlay.tip.style, {
      left: `${Math.max(8, Math.min(rect.left, window.innerWidth - overlay.tip.offsetWidth - 8))}px`,
      top: `${Math.max(8, tipTop)}px`
    });
  }

  function select(element) {
    if (!element || element === session.overlay.host || element === document.documentElement) return;
    session.target = element;
    paint();
  }

  function handlePointerMove(event) {
    const element = event.composedPath().find((node) => node.nodeType === 1);
    if (element && element !== session.target && element !== session.overlay.host) {
      session.trail = [];
      select(element);
    }
  }

  function block(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  async function handleClick(event) {
    block(event);
    const current = session;
    const { target, overlay } = current;
    if (!target || session.saving) return;
    session.saving = true;
    const selector = core.selectorForElement(target, countMatches(target));
    try {
      const response = await chrome.runtime.sendMessage({ type: "rosewash:ignore-element", selector });
      if (!response?.ok) throw new Error(response?.error || "Not saved");
      if (session === current) stop();
    } catch (error) {
      if (session !== current) return;
      overlay.hint.textContent = `Could not save: ${error.message}`;
      current.saving = false;
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      block(event);
      stop();
    } else if (event.key === "ArrowUp" && session.target) {
      block(event);
      const parent = composedParent(session.target);
      if (parent && parent !== document.documentElement) {
        session.trail.push(session.target);
        select(parent);
      }
    } else if (event.key === "ArrowDown" && session.trail.length) {
      block(event);
      select(session.trail.pop());
    }
  }

  const listeners = [
    ["pointermove", handlePointerMove],
    ["pointerdown", block], ["mousedown", block], ["mouseup", block], ["pointerup", block],
    ["click", handleClick], ["auxclick", block], ["contextmenu", block],
    ["keydown", handleKeyDown]
  ];

  async function start() {
    if (session) return;
    const current = { overlay: null, target: null, trail: [], saving: false, previousFocus: document.activeElement };
    session = current;
    // Install cancellation before reading storage so Esc also works during startup.
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("pagehide", stop);
    try {
      const settings = core.plainSettings(await chrome.storage.sync.get(null));
      if (session !== current) return;
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      current.overlay = createOverlay(core.PALETTES[core.resolveSettingsThemeKey(settings, dark)]);
      for (const [type, listener] of listeners) window.addEventListener(type, listener, true);
      window.addEventListener("scroll", paint, true);
      window.addEventListener("resize", paint);
      // Keyboard events inside iframes do not reach the top window. Move focus
      // into the picker so Esc works even when an embedded editor had focus.
      window.focus();
      current.overlay.host.focus({ preventScroll: true });
    } catch (error) {
      if (session === current) stop();
      throw error;
    }
  }

  function stop() {
    if (!session) return;
    for (const [type, listener] of listeners) window.removeEventListener(type, listener, true);
    window.removeEventListener("scroll", paint, true);
    window.removeEventListener("resize", paint);
    window.removeEventListener("pagehide", stop);
    session.overlay?.host.remove();
    const previousFocus = session.previousFocus;
    session = null;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only Rosewash's own pages can start the picker.
    if (message?.type !== START_MESSAGE || sender.id !== chrome.runtime.id || sender.tab) return false;
    start().then(() => sendResponse({ ok: true }),
      (error) => sendResponse({ ok: false, error: error.message }));
    return true;
  });
})();
