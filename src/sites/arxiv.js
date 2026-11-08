(function () {
  "use strict";

  const LAYOUT_ATTRIBUTE = "data-rosewash-arxiv-layout";
  const PAGE_ATTRIBUTE = "data-rosewash-arxiv-page";
  const FOLD_CLASS = "rosewash-arxiv-fold";
  const root = document.documentElement;
  const undo = [];
  let appliedKind = "";

  function pageKind() {
    const path = window.location.pathname;
    if (path === "/") return "home";
    if (/^\/abs\/[^/]+/.test(path)) return "abs";
    if (/^\/html\/[^/]+/.test(path)) return "html";
    return "";
  }

  function move(node, parent, before = null) {
    // Move the original nodes so links, page listeners, and third-party tools
    // keep working. A marker restores each node to its exact position.
    const marker = document.createComment("rosewash-arxiv");
    node.before(marker);
    parent.insertBefore(node, before);
    undo.push(() => marker.replaceWith(node));
  }

  function fold(nodes, label, anchor, kind) {
    const details = document.createElement("details");
    details.className = FOLD_CLASS;
    details.dataset.section = kind;
    const summary = document.createElement("summary");
    summary.textContent = label;
    details.appendChild(summary);
    anchor.before(details);
    undo.push(() => details.remove());
    for (const node of nodes) move(node, details);
    return summary;
  }

  function enhanceHome() {
    const subjects = document.createElement("nav");
    subjects.className = "rosewash-arxiv-subject-nav";
    subjects.setAttribute("aria-label", "Subjects");
    let index = 0;
    for (const heading of document.querySelectorAll("#content > h2")) {
      const list = heading.nextElementSibling;
      if (list?.tagName !== "UL" || !list.querySelector("a[href^='/list/']")) continue;
      const section = document.createElement("section");
      section.className = "rosewash-arxiv-subject";
      section.id = `rosewash-arxiv-subject-${index++}`;
      heading.before(section);
      undo.push(() => section.remove());
      if (!subjects.isConnected) {
        section.before(subjects);
        undo.push(() => subjects.remove());
      }
      const jump = document.createElement("a");
      jump.href = `#${section.id}`;
      jump.textContent = heading.textContent;
      // Jump immediately even when fragment scrolling is waiting for a paint.
      jump.addEventListener("click", () => section.scrollIntoView({ block: "start", behavior: "instant" }));
      subjects.appendChild(jump);
      move(heading, section);
      move(list, section);

      for (const item of list.children) {
        // A native li can contain dozens of subcategories (notably Math and
        // CS). Lay out those links individually, preserving their IDs/listeners.
        const topics = [...item.querySelectorAll("a[href^='/list/'][href$='/recent']")]
          .filter((link) => link.textContent.trim() !== "recent");
        if (!topics.length) continue;
        const grid = document.createElement("div");
        grid.className = "rosewash-arxiv-topics";
        item.appendChild(grid);
        undo.push(() => grid.remove());
        for (const topic of topics) move(topic, grid);
      }
    }
  }

  function enhanceAbstract() {
    const fullText = document.querySelector(".extra-services .full-text");
    const abstract = document.querySelector("#abs .abstract");
    if (fullText && abstract) move(fullText, abstract.parentNode, abstract);
    const history = document.querySelector(".submission-history");
    if (history) fold([history], "Submission history", history, "history");
  }

  function enhanceHtml() {
    const nav = document.querySelector(".ltx_page_navbar");
    const content = document.querySelector(".ltx_page_content");
    if (nav && content) fold([nav], "Contents", content, "toc");
    const authors = document.querySelector(".ltx_document > .ltx_authors");
    if (authors) fold([authors], "Authors", authors, "authors");
  }

  function sync() {
    const kind = root.hasAttribute(LAYOUT_ATTRIBUTE) ? pageKind() : "";
    if (root.getAttribute(PAGE_ATTRIBUTE) !== (kind || null)) {
      if (kind) root.setAttribute(PAGE_ATTRIBUTE, kind);
      else root.removeAttribute(PAGE_ATTRIBUTE);
    }
    if (kind === appliedKind) return;
    for (const restore of undo.splice(0).reverse()) restore();
    appliedKind = "";
    // At document_start, CSS can clean the shell immediately; moving page
    // content waits until the native document has finished parsing.
    if (!kind || document.readyState === "loading") return;
    if (kind === "home") enhanceHome();
    if (kind === "abs") enhanceAbstract();
    if (kind === "html") enhanceHtml();
    appliedKind = kind;
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const details = event.target.closest?.(`details.${FOLD_CLASS}[open]`);
    if (!details) return;
    details.open = false;
    details.querySelector("summary").focus();
    event.preventDefault();
  });
  document.addEventListener("DOMContentLoaded", sync);
  document.addEventListener("rosewash:arxiv-layout-change", sync);
  window.addEventListener("pageshow", sync);
  new MutationObserver(sync).observe(root, {
    attributes: true,
    attributeFilter: [LAYOUT_ATTRIBUTE]
  });
  sync();
})();
