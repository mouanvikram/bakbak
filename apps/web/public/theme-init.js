// Apply the persisted theme before first paint to avoid a flash. Loaded as a
// blocking script from <head> — an external file rather than inline, so the
// Content-Security-Policy can forbid inline scripts.
(function () {
  try {
    var stored = localStorage.getItem("bakbak.theme") || "light";
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var dark = stored === "dark" || (stored === "system" && prefersDark);
    document.documentElement.classList.toggle("dark", dark);
    var size = localStorage.getItem("bakbak.fontSize") || "small";
    document.documentElement.dataset.fontSize = size;
  } catch {
    // Storage blocked — fall back to the default light theme.
  }
})();
