import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({});
vm.runInContext(readFileSync(new URL("../src/content/banners.js", import.meta.url), "utf8"), context);
const { isBanner, createController } = context.RosewashBanners;
const promo = {
  top: 0, documentTop: 0, width: 1200, height: 38, viewportWidth: 1200,
  position: "static", name: "promo", text: "Turn any lesson into a live trading bot with one prompt",
  role: null, links: 1, buttons: 0, close: false, protectedContent: false
};

test("recognizes independent promotions and announcements with or without close buttons", () => {
  assert.equal(isBanner(promo), true);
  assert.equal(isBanner({ ...promo, name: "announcement-bar", links: 0, buttons: 1, close: true }), true);
  assert.equal(isBanner({ ...promo, name: "css-1a2b", text: "Subscribe to our newsletter", close: true }), true);
  assert.equal(isBanner({ ...promo, name: "", text: "限时优惠，立即订阅" }), true);
});

test("preserves navigation, warnings, content, and narrow or offscreen elements", () => {
  for (const overrides of [
    { protectedContent: true }, { role: "alert" }, { role: "status" },
    { text: "Scheduled maintenance tomorrow" }, { text: "Security verification required" },
    { text: "Cookie consent" }, { text: "账户异常，请验证" },
    { width: 400 }, { height: 180 }, { top: -40 }, { top: 300 },
    { documentTop: 900 }, { links: 6 }, { name: "nav", text: "Home Courses Resources" }
  ]) assert.equal(isBanner({ ...promo, ...overrides }), false, JSON.stringify(overrides));
  assert.equal(isBanner({ ...promo, position: "fixed", documentTop: 900 }), true);
});

test("recognizes named bars inside navigation without hiding promotional navigation links", () => {
  const nested = {
    ...promo, insideNavigation: true, name: " styles-module__CrkzSa__banner",
    text: "Try Calligraph — A Fluid Text Morphing Library for React", height: 40.8
  };
  assert.equal(isBanner(nested), true);
  assert.equal(isBanner({ ...nested, name: "nav-link", text: "Subscribe to our newsletter" }), false);
  assert.equal(isBanner({ ...nested, protectedContent: true }), false);
  assert.equal(isBanner({ ...nested, role: "alert" }), false);
});

test("delayed bars inside navigation hide independently and restore when disabled", () => {
  const hidden = new Set();
  const listeners = new Map();
  let callback;
  let pending;
  let disconnected = false;
  let visible = false;
  const body = { closest: () => null };
  const nav = {
    parentElement: body,
    matches: selector => selector === "nav, [role='navigation']",
    closest: selector => selector === "nav, [role='navigation']" ? nav : null,
    setAttribute() { assert.fail("keep the navigation container visible"); }
  };
  const banner = {
    id: "", className: "promo", textContent: promo.text, parentElement: nav, isConnected: true,
    hasAttribute: name => hidden.has(name),
    setAttribute: name => hidden.add(name), removeAttribute: name => hidden.delete(name),
    closest: selector => hidden.size ? banner : selector.split(",").some(part => part.trim() === "nav") ? nav : null,
    getBoundingClientRect: () => ({ top: 0, width: 1200, height: 38 }),
    querySelectorAll: () => [], querySelector: () => null,
    getAttribute: () => null, matches: selector => selector === "a"
  };
  const inner = Object.assign(Object.create(banner), {
    className: "promo-in", parentElement: banner,
    setAttribute() { assert.fail("hide the outer bar, including its border and padding"); }
  });
  const document = { body, documentElement: {}, elementsFromPoint: () => visible && !hidden.size ? [inner, banner] : [] };
  const window = {
    innerWidth: 1200, scrollY: 0,
    setTimeout(fn) { pending = fn; return 1; }, clearTimeout() { pending = null; },
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
    getComputedStyle: () => ({ position: "static" }),
    MutationObserver: class {
      constructor(fn) { callback = fn; }
      observe() {} disconnect() { disconnected = true; }
    }
  };
  const controller = createController({ document, window });
  controller.setEnabled(true);
  pending();
  assert.equal(hidden.size, 0);
  visible = true;
  callback();
  pending();
  assert.equal(hidden.size, 1);
  controller.setEnabled(false);
  assert.equal(hidden.size, 0);
  assert.equal(disconnected, true);
  assert.equal(pending, null);
  assert.equal(listeners.size, 0);
  controller.setEnabled(true);
  pending();
  assert.equal(hidden.size, 1);
  controller.disconnect();
  assert.equal(hidden.size, 0);
});
