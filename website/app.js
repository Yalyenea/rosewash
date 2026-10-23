import { messages } from "./content.js";
import { palettes } from "./palettes.js";

const root = document.documentElement;
const storageKey = "rosewash-website";
const supported = {
  language: ["zh", "en"],
  palette: Object.keys(palettes),
  mode: ["light", "dark"],
  font: ["serif", "sans"],
  preview: ["original", "applied"],
};
const browserLanguage = navigator.languages
  .map((language) => language.split("-")[0])
  .find((language) => supported.language.includes(language)) || "en";
const state = {
  language: browserLanguage,
  palette: "rose-pine",
  mode: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  font: "serif",
  preview: "applied",
};

function reportPreferenceError(error) {
  console.warn("Rosewash website preferences could not be saved or read.", error);
  document.getElementById("preference-error").hidden = false;
}

try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  for (const [key, choices] of Object.entries(supported)) {
    if (choices.includes(stored?.[key])) state[key] = stored[key];
  }
} catch (error) {
  reportPreferenceError(error);
}

// A shared language URL takes priority over this browser's saved preference.
const requestedLanguage = new URL(location.href).searchParams.get("lang");
if (supported.language.includes(requestedLanguage)) state.language = requestedLanguage;

function savePreferences() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (error) {
    reportPreferenceError(error);
  }
}

function renderLanguage() {
  const copy = messages[state.language];
  root.lang = state.language === "zh" ? "zh-CN" : "en";
  document.title = copy.title;
  document.querySelector('meta[name="description"]').content = copy.metaDescription;
  for (const node of document.querySelectorAll("[data-i18n]")) node.textContent = copy[node.dataset.i18n];
  for (const node of document.querySelectorAll("[data-i18n-aria]")) node.setAttribute("aria-label", copy[node.dataset.i18nAria]);
  for (const node of document.querySelectorAll("[data-i18n-alt]")) node.alt = copy[node.dataset.i18nAlt];
  const languageButton = document.getElementById("language-button");
  languageButton.textContent = state.language === "zh" ? "EN" : "中文";
  languageButton.lang = state.language === "zh" ? "en" : "zh-CN";
  languageButton.setAttribute("aria-label", state.language === "zh" ? "Switch to English" : "切换为中文");
  if (document.getElementById("image-dialog").open) {
    const source = document.querySelector(`[data-image="${document.getElementById("image-dialog").dataset.image}"] img`);
    document.getElementById("large-image").alt = source.alt;
  }
}

function renderDemo() {
  const palette = palettes[state.palette][state.mode];
  root.dataset.palette = state.palette;
  root.dataset.mode = state.mode;
  root.dataset.font = state.font;
  root.style.colorScheme = state.mode;
  for (const [key, value] of Object.entries(palette)) root.style.setProperty(`--${key}`, value);
  // Secondary UI colors keep sufficient contrast without changing the actual preview palette.
  root.style.setProperty("--sub", state.palette === "rose-pine"
    ? (state.mode === "light" ? "#716a80" : "#b4aec8")
    : "color-mix(in srgb, var(--text) 88%, var(--base))");
  root.style.setProperty("--line", state.palette === "rose-pine"
    ? (state.mode === "light" ? "#ddd4cc" : "#48425c")
    : "color-mix(in srgb, var(--text) 18%, var(--base))");
  document.querySelector('meta[name="theme-color"]').content = palette.base;
  document.getElementById("specimen").dataset.preview = state.preview;
  document.getElementById("font-select").value = state.font;
  for (const key of ["palette", "mode", "preview"]) {
    for (const button of document.querySelectorAll(`button[data-${key}]`)) {
      button.setAttribute("aria-pressed", String(button.dataset[key] === state[key]));
    }
  }
}

document.getElementById("language-button").addEventListener("click", () => {
  state.language = state.language === "zh" ? "en" : "zh";
  const url = new URL(location.href);
  url.searchParams.set("lang", state.language);
  history.replaceState(null, "", url);
  renderLanguage();
  savePreferences();
});

for (const key of ["palette", "mode", "preview"]) {
  for (const button of document.querySelectorAll(`button[data-${key}]`)) {
    button.addEventListener("click", () => {
      state[key] = button.dataset[key];
      // Choosing a new theme is an explicit request to see it applied.
      if (key === "palette" || key === "mode") state.preview = "applied";
      renderDemo();
      savePreferences();
    });
  }
}

document.getElementById("font-select").addEventListener("change", (event) => {
  state.font = event.target.value;
  state.preview = "applied";
  renderDemo();
  savePreferences();
});

for (const opener of document.querySelectorAll("[data-dialog]")) {
  opener.addEventListener("click", () => document.getElementById(opener.dataset.dialog).showModal());
}
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.querySelector(".close-dialog").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
}
for (const button of document.querySelectorAll("[data-image]")) {
  button.addEventListener("click", () => {
    const source = button.querySelector("img");
    const dialog = document.getElementById("image-dialog");
    dialog.dataset.image = button.dataset.image;
    const image = document.getElementById("large-image");
    image.src = source.src;
    image.alt = source.alt;
    document.getElementById("image-title").textContent = button.closest("figure").querySelector("figcaption").textContent;
    dialog.showModal();
  });
}

const gallery = document.getElementById("gallery");
const figures = Array.from(gallery.querySelectorAll("figure"));
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
function galleryIndex() {
  const distance = figures[1].offsetLeft - figures[0].offsetLeft;
  return Math.max(0, Math.min(figures.length - 1, Math.round(gallery.scrollLeft / distance)));
}
function renderGalleryControls() {
  const index = galleryIndex();
  document.getElementById("gallery-count").textContent = `${index + 1} / ${figures.length}`;
  document.getElementById("previous-image").disabled = index === 0;
  document.getElementById("next-image").disabled = index === figures.length - 1;
}
function moveGallery(offset) {
  const index = Math.max(0, Math.min(figures.length - 1, galleryIndex() + offset));
  gallery.scrollTo({ left: figures[index].offsetLeft - figures[0].offsetLeft, behavior: reducedMotion.matches ? "instant" : "smooth" });
}
document.getElementById("previous-image").addEventListener("click", () => moveGallery(-1));
document.getElementById("next-image").addEventListener("click", () => moveGallery(1));
gallery.addEventListener("scroll", renderGalleryControls, { passive: true });
window.addEventListener("resize", renderGalleryControls);

renderLanguage();
renderDemo();
renderGalleryControls();
