// Theme boot: runs before first paint to avoid a wrong-theme flash.
// An explicit ?theme=light|dark query is honored (handy for testing).
// Kept as an external file so the production CSP can keep
// script-src 'self' with no unsafe-inline. /theme-boot.js
(function () {
  try {
    var params = new URLSearchParams(window.location.search);
    var override = params.get("theme");
    var stored = localStorage.getItem("vista-theme");
    var theme =
      override === "light" || override === "dark"
        ? override
        : stored === "light" || stored === "dark"
          ? stored
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    if (theme === "dark") document.documentElement.classList.add("dark");
  } catch (e) {
    /* localStorage unavailable: keep light theme */
  }
})();
