// Light and dark theme, remembered in this browser.
import { route } from "./router.js";
import { clearThumbs } from "../visuals/glyph.js";

export function initTheme() {
  let saved = "";
  try { saved = localStorage.getItem("atlas-theme") || ""; } catch (e) { /* storage blocked */ }
  if (saved) document.documentElement.dataset.theme = saved;
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const root = document.documentElement;
    const dark = root.dataset.theme === "dark" || (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("atlas-theme", root.dataset.theme); } catch (e) { /* storage blocked */ }
    clearThumbs();
    route();
  });
}
