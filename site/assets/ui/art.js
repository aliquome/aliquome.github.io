// Generated 3D stills, drawn lazily when they scroll near the viewport.
import { view, esc, BLANK } from "../core/dom.js";
import { fieldOf } from "../core/catalog.js";
import { requestThumb } from "../visuals/glyph.js";

// 3D stills are drawn only when they scroll near the viewport, one per idle slot.
export const lazy = new IntersectionObserver(
  (entries) => entries.forEach((e) => { if (e.isIntersecting) { lazy.unobserve(e.target); requestThumb(e.target); } }),
  { rootMargin: "400px" }
);

export const art = (name, field) =>
  `<img src="${BLANK}" alt="" data-name="${esc(name)}" data-shape="${esc(fieldOf(field).shape)}">`;

export const armArt = () => view.querySelectorAll("img[data-name]:not(.ready)").forEach((img) => lazy.observe(img));
