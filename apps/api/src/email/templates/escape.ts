// HTML-escapes a value for interpolation into template markup. Escapes both
// text and double-quoted attribute contexts (& < > " '). Every user-controlled
// or server-supplied value interpolated into templates/* must pass through this
// so a display name like `<img onerror=...>` never becomes live markup.
export function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}