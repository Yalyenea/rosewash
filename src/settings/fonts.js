(function () {
  "use strict";

  function createPicker({ enabledInput, fields, status }) {
    const core = globalThis.RosewashCore;
    const canListFonts = Boolean(chrome.fontSettings);
    let fonts = null;
    let previewFaces = [];
    const pickers = new Map();

    function createSearchPicker(input) {
      const name = input.getAttribute("aria-label");
      const wrapper = document.createElement("div");
      wrapper.className = "font-picker";
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.id = `${input.id}-trigger`;
      trigger.className = "font-trigger";
      trigger.setAttribute("aria-haspopup", "listbox");
      trigger.setAttribute("aria-expanded", "false");
      const panel = document.createElement("div");
      panel.className = "font-menu";
      panel.hidden = true;
      const search = document.createElement("input");
      search.type = "search";
      search.placeholder = "Search fonts…";
      search.autocomplete = "off";
      search.setAttribute("role", "combobox");
      search.setAttribute("aria-label", `Search ${name} fonts`);
      search.setAttribute("aria-autocomplete", "list");
      search.setAttribute("aria-expanded", "false");
      const list = document.createElement("div");
      list.id = `${input.id}-list`;
      list.className = "font-results";
      list.setAttribute("role", "listbox");
      list.setAttribute("aria-label", `${name} fonts`);
      search.setAttribute("aria-controls", list.id);
      trigger.setAttribute("aria-controls", list.id);
      const empty = document.createElement("p");
      empty.className = "font-empty";
      empty.textContent = "No matching fonts";
      empty.setAttribute("role", "status");
      panel.appendChild(search);
      panel.appendChild(list);
      panel.appendChild(empty);
      input.hidden = true;
      input.tabIndex = -1;
      input.replaceWith(wrapper);
      wrapper.appendChild(input);
      wrapper.appendChild(trigger);
      wrapper.appendChild(panel);
      document.querySelector(`label[for='${input.id}']`).htmlFor = trigger.id;
      let matches = [];
      let active = -1;

      function close(returnFocus = false) {
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
        search.setAttribute("aria-expanded", "false");
        search.removeAttribute("aria-activedescendant");
        if (returnFocus) trigger.focus();
      }

      function highlight(index) {
        active = index;
        Array.from(list.children).forEach((option, i) => option.classList.toggle("is-active", i === active));
        if (active >= 0) {
          search.setAttribute("aria-activedescendant", list.children[active].id);
          list.children[active].scrollIntoView({ block: "nearest" });
        } else search.removeAttribute("aria-activedescendant");
      }

      function choose(index) {
        if (!matches[index]) return;
        input.value = matches[index].value;
        update();
        close(true);
        // Only a committed choice reaches settings; search text never saves.
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }

      function filter() {
        const query = search.value.trim().toLocaleLowerCase();
        matches = Array.from(input.options).filter((option) =>
          `${option.text} ${option.value}`.toLocaleLowerCase().includes(query));
        list.replaceChildren();
        matches.forEach((option, index) => {
          const row = document.createElement("div");
          row.id = `${input.id}-option-${index}`;
          row.className = "font-option";
          row.textContent = option.text;
          row.title = option.text;
          row.setAttribute("role", "option");
          row.setAttribute("aria-selected", String(option.value === input.value));
          // Keep keyboard focus in the search field while choosing by pointer.
          row.addEventListener("mousedown", (event) => event.preventDefault());
          row.addEventListener("click", () => choose(index));
          list.appendChild(row);
        });
        empty.hidden = matches.length > 0;
        highlight(query ? (matches.length ? 0 : -1) : matches.findIndex((option) => option.value === input.value));
      }

      function open() {
        for (const picker of pickers.values()) picker.close();
        panel.hidden = false;
        panel.classList.remove("opens-up");
        // Flip above the field when a full menu would run below the viewport.
        const rect = trigger.getBoundingClientRect();
        const below = window.innerHeight - rect.bottom - 12;
        const above = rect.top - 12;
        const opensUp = below < 280 && above > below;
        panel.classList.toggle("opens-up", opensUp);
        panel.style.maxHeight = `${Math.max(0, Math.min(280, opensUp ? above : below))}px`;
        search.value = "";
        trigger.setAttribute("aria-expanded", "true");
        search.setAttribute("aria-expanded", "true");
        filter();
        search.focus();
      }

      function update() {
        const selected = Array.from(input.options).find((option) => option.value === input.value);
        trigger.textContent = selected?.text || "Page default";
        trigger.title = trigger.textContent;
        trigger.setAttribute("aria-label", `${name} font: ${trigger.textContent}`);
        trigger.disabled = input.disabled;
        if (input.disabled) close();
        else if (!panel.hidden) filter();
      }

      trigger.addEventListener("click", () => panel.hidden ? open() : close());
      trigger.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          open();
        }
      });
      search.addEventListener("input", filter);
      search.addEventListener("keydown", (event) => {
        if (event.key === "Escape") { event.preventDefault(); close(true); }
        if (event.key === "Enter") { event.preventDefault(); choose(active); }
        if ((event.key === "ArrowDown" || event.key === "ArrowUp") && matches.length) {
          event.preventDefault();
          highlight((active + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length);
        }
      });
      wrapper.addEventListener("focusout", (event) => {
        if (!wrapper.contains(event.relatedTarget)) close();
      });
      document.addEventListener("click", (event) => {
        if (!wrapper.contains(event.target)) close();
      });
      return { update, close };
    }

    // Firefox has no fontSettings API; accept installed font names directly.
    if (!canListFonts) {
      for (const field of fields) {
        const input = document.createElement("input");
        input.type = "text";
        input.id = field.input.id;
        input.setAttribute("aria-label", field.input.getAttribute("aria-label"));
        input.placeholder = "Page default";
        input.autocomplete = "off";
        field.input.replaceWith(input);
        field.input = input;
      }
    } else {
      for (const { input } of fields) pickers.set(input, createSearchPicker(input));
    }

    function values() {
      return Object.fromEntries(fields.map(({ key, input }) => [key, input.value]));
    }

    function fill(input, value) {
      if (!canListFonts) {
        input.value = value;
        return;
      }
      input.replaceChildren(new Option("Page default", ""));
      for (const font of fonts || []) input.add(new Option(font.displayName, font.fontId));
      if (value && !Array.from(input.options).some((option) => option.value === value)) {
        input.add(new Option(`${value} — saved`, value));
      }
      input.value = value;
      pickers.get(input).update();
    }

    function preview() {
      for (const { input } of fields) {
        input.disabled = !enabledInput.checked;
        if (canListFonts) pickers.get(input).update();
      }
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
        if (!canListFonts || input.value !== settings[key] || !input.options.length) fill(input, settings[key]);
      }
      preview();
    }

    async function load() {
      if (!canListFonts) {
        status.textContent = "Enter an installed font name. Leave blank to use the page font.";
        return;
      }
      status.textContent = "Loading system fonts…";
      try {
        const list = await chrome.fontSettings.getFontList();
        fonts = Array.from(new Map(list.map((font) => [font.fontId, font])).values())
          .sort((a, b) => a.displayName.localeCompare(b.displayName));
        for (const { input } of fields) fill(input, input.value);
        status.textContent = fonts.length ? "" : "No system fonts found.";
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
