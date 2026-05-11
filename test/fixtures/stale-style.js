(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  if (params.get("stale") !== "dawn") {
    return;
  }

  const staleStyle = "background-color: rgb(250, 244, 237); color: rgb(87, 82, 121);";
  for (const element of [document.documentElement, document.body]) {
    element.setAttribute("style", staleStyle);
    element.setAttribute("data-rosewash-tinted", "dawn");
    element.setAttribute("data-rosewash-had-style", "false");
    element.setAttribute("data-rosewash-original-style", "");
  }
})();

