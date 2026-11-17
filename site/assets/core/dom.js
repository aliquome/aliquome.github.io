// DOM helpers shared by every layer: the main view, escaping, copy and toast.
export const view = document.getElementById("view");

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const num = (n) => Number(n || 0).toLocaleString("en-US");

export const safe = (u) => (/^(https?|ftp):\/\//i.test(u || "") ? u : "");

export const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

export function toast(text, ms = 1600) {
  const t = document.getElementById("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), ms);
}

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied");
  } catch (e) {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    try { document.execCommand("copy"); toast("Copied"); } catch (err) { toast("Select the text and copy it"); }
    area.remove();
  }
}

export function replaceHash(hash) {
  try { window.history.replaceState(null, "", hash); } catch (e) { /* sandboxed */ }
}
