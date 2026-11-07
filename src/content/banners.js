(function () {
  "use strict";

  const HIDDEN = "data-rosewash-banner-hidden";
  const NOTICE_NAME = /(?:announcement|promo|notification[-_]?bar|notice[-_]?bar|alert[-_]?bar|top[-_]?banner|banner[-_]?top|[\s_-]banner(?:[\s_-]|$))/i;
  const PROMOTION = /\b(?:subscribe|newsletter|discount|sale|free trial|try .+free|download .+app|new release|introducing|limited time)\b|订阅|优惠|促销|下载.{0,8}(?:应用|客户端)|限时|新品/i;
  const CRITICAL = /\b(?:maintenance|outage|security|verify|verification|payment failed|account suspended|data loss|unsaved|emergency|deprecated|end.of.life|cookie|consent)\b|维护|故障|安全|验证|付款失败|账户异常|未保存|紧急|停止支持|隐私|同意/i;
  const CONTENT = "main, article, [role='main'], dialog, [role='dialog'], [contenteditable='true'], [data-rosewash-ignore]";
  const NAVIGATION = "nav, [role='navigation']";
  const INTERACTIVE = "nav, [role='navigation'], input, select, textarea, [role='search'], [contenteditable='true']";

  function isBanner({ top, documentTop, width, height, viewportWidth, position, name, text, role, links, buttons, close, protectedContent, insideNavigation }) {
    if (protectedContent || role === "alert" || role === "status" || CRITICAL.test(text)) return false;
    // A named, self-contained bar can sit inside nav. Ordinary navigation
    // links must not qualify just because their copy sounds promotional.
    if (insideNavigation && !NOTICE_NAME.test(name)) return false;
    if (height < 20 || height > 140 || width < viewportWidth * 0.7) return false;
    if (top < -1 || top > 180 || (documentTop > 220 && position !== "fixed" && position !== "sticky")) return false;
    if (!text || text.length > 420 || links > 3 || buttons > 2) return false;
    return NOTICE_NAME.test(name) || (PROMOTION.test(text) && (close || links > 0));
  }

  function createController({ document, window }) {
    const hidden = new Set();
    let enabled = false;
    let timer = 0;
    let observer = null;

    function schedule() {
      if (enabled && !timer) timer = window.setTimeout(scan, 120);
    }

    function scan() {
      timer = 0;
      if (!enabled || !document.body) return;
      for (const element of hidden) if (!element.isConnected) hidden.delete(element);

      // Hit-testing bounds the work to the visible top of the page, even on
      // long feeds. Ancestors catch full-width bars whose text is centered.
      const candidates = new Set();
      for (const x of [0.15, 0.5, 0.85]) {
        for (const y of [8, 32, 64, 112, 176]) {
          for (const hit of document.elementsFromPoint(window.innerWidth * x, y)) {
            const ancestors = [];
            for (let element = hit; element && element !== document.body; element = element.parentElement) {
              if (element === document.documentElement || candidates.size >= 100) break;
              ancestors.push(element);
            }
            // Hide the bar's outer box before its inner text wrapper, so its
            // border and padding leave normal flow as well.
            for (const element of ancestors.reverse()) candidates.add(element);
          }
        }
      }

      let changed = false;
      for (const element of candidates) {
        if (element.matches(NAVIGATION) || element.closest(`[${HIDDEN}], ${CONTENT}`)) continue;
        const rect = element.getBoundingClientRect();
        if (rect.height < 20 || rect.height > 140 || rect.width < window.innerWidth * 0.7) continue;
        const style = window.getComputedStyle(element);
        const buttons = [...element.querySelectorAll("button, [role='button']")];
        const text = (element.textContent || "").replace(/\s+/g, " ").trim();
        const close = buttons.some(button => /^(?:close|dismiss|关闭|关闭通知|×|✕|x)$/i.test(
          (button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent || "").trim()
        ));
        if (!isBanner({
          top: rect.top, documentTop: rect.top + window.scrollY,
          width: rect.width, height: rect.height, viewportWidth: window.innerWidth,
          position: style.position, name: `${element.id} ${element.className}`,
          insideNavigation: Boolean(element.parentElement?.closest(NAVIGATION)),
          text, role: element.getAttribute("role"),
          links: element.querySelectorAll("a").length + Number(element.matches("a")),
          buttons: buttons.length, close,
          protectedContent: Boolean(element.querySelector(INTERACTIVE))
            || Boolean(element.querySelector("[role='alert'], [role='status']"))
        })) continue;
        element.setAttribute(HIDDEN, "");
        hidden.add(element);
        changed = true;
      }
      // A second bar may become visible after the first leaves normal flow.
      if (changed) schedule();
    }

    function disconnect() {
      enabled = false;
      observer?.disconnect();
      observer = null;
      window.clearTimeout(timer);
      timer = 0;
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
      for (const element of hidden) element.removeAttribute(HIDDEN);
      hidden.clear();
    }

    function setEnabled(next) {
      if (enabled === next) return;
      if (!next) { disconnect(); return; }
      enabled = true;
      observer = new window.MutationObserver(schedule);
      observer.observe(document, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ["class", "id", "hidden", "aria-hidden"]
      });
      window.addEventListener("resize", schedule);
      window.addEventListener("scroll", schedule, { passive: true });
      schedule();
    }

    return { setEnabled, disconnect };
  }

  globalThis.RosewashBanners = { createController, isBanner };
})();
