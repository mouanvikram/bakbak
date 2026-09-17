// Apply the persisted theme before first paint to avoid a flash. Loaded as a
// blocking script from <head> — an external file rather than inline, so the
// Content-Security-Policy can forbid inline scripts.
(function () {
  try {
    // These two keys are the ones declared in src/lib/storage.ts. This script
    // runs before the bundle to avoid a flash of the wrong theme, so it can't
    // import them — renaming either one means editing both files.
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
