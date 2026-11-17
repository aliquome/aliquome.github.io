// Reachability dots and the 30-day history strip of a source.
import { esc } from "../core/dom.js";
import { STATE_LABEL, statusOf } from "../core/catalog.js";

export function dot(id) {
  const s = statusOf(id);
  const label = s ? STATE_LABEL[s.state] || s.state : "Not checked yet";
  return `<span class="dot ${s ? esc(s.state) : ""}" title="${esc(label)}" role="img" aria-label="${esc(label)}"></span>`;
}

export function history(id) {
  const s = statusOf(id);
  if (!s?.history?.length) return `<span class="muted">No checks yet</span>`;
  return `<span class="history" role="img" aria-label="Recent checks, oldest first">${s.history
    .map((h) => `<i class="${esc(h.s)}" title="${esc(h.d)}: ${esc(STATE_LABEL[h.s] || h.s)}"></i>`)
    .join("")}</span>`;
}
