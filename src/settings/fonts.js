(function () {
  "use strict";

  function createPicker({ enabledInput, fields, status }) {
    const core = globalThis.RosewashCore;
    let fonts = null;
    let previewFaces = [];

    function values() {
      return Object.fromEntries(fields.map(({ key, input }) => [key, input.value]));
    }

    function fill(input, value) {
      input.replaceChildren(new Option("Page default", ""));
      for (const font of fonts || []) input.add(new Option(font.displayName, font.fontId));
      if (value && !Array.from(input.options).some((option) => option.value === value)) {
        input.add(new Option(`${value} — saved`, value));
      }
      input.value = value;
    }

    function preview() {
      for (const { input } of fields) input.disabled = !enabledInput.checked;
      if (!fields.some((field) => field.preview)) return;
      for (const face of previewFaces) document.fonts.delete(face);
      previewFaces = core.createFontFaces({
        customFontsEnabled: enabledInput.checked,
        ...values()
      }, window);
      const currentFaces = previewFaces;
      for (const field of fields) {
        if (!field.preview) continue;
        field.preview.style.fontFamily = "";
        const face = previewFaces.find((item) => item.family === field.family);
        field.status.textContent = face ? "Loading…" : "";
        if (!face) continue;
        document.fonts.add(face);
        face.load().then(() => {
          if (previewFaces !== currentFaces) return;
          field.preview.style.fontFamily = field.family;
          field.status.textContent = "";
        }).catch(() => {
          if (previewFaces === currentFaces) field.status.textContent = "Font unavailable";
        });
      }
    }

    function render(settings) {
      enabledInput.checked = settings.customFontsEnabled;
      for (const { key, input } of fields) {
        if (input.value !== settings[key] || !input.options.length) fill(input, settings[key]);
      }
      preview();
    }

    async function load() {
      status.textContent = "Loading system fonts…";
      try {
        const list = await chrome.fontSettings.getFontList();
        fonts = Array.from(new Map(list.map((font) => [font.fontId, font])).values())
          .sort((a, b) => a.displayName.localeCompare(b.displayName));
        for (const { input } of fields) fill(input, input.value);
        status.textContent = fonts.length ? `${fonts.length} system fonts` : "No system fonts found.";
        preview();
      } catch (error) {
        status.textContent = `Could not load system fonts: ${error.message}`;
      }
    }

    enabledInput.addEventListener("change", preview);
    for (const { input } of fields) input.addEventListener("change", preview);
    return { values, render, load };
  }

  globalThis.RosewashFonts = Object.freeze({ createPicker });
})();
