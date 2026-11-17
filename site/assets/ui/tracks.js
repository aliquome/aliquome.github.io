// "The atlas today" as a genome-browser panel: one track per figure, with a
// coordinate ruler, and reads piled up to the share a reader can fetch from code.
import { esc, num } from "../core/dom.js";
import { pileup } from "../domain/coverage.js";

export function browserPanel(figures) {
  const ruler = [0, 25, 50, 75, 100].map((p) => `<span style="left:${p}%">${p}${p === 100 ? "%" : ""}</span>`).join("");
  return `<div class="browser">
    <div class="br-row br-ruler-row" aria-hidden="true"><span></span><span></span><span class="br-ruler">${ruler}</span><span></span></div>
    <ul class="br-tracks">${figures.map((f, i) => {
      const pct = Math.round(f.share * 100);
      const reads = pileup(f.share, i + 1).map((r) => `<i class="${r.reverse ? "rev" : ""}" style="left:${r.x.toFixed(2)}%;width:${r.w.toFixed(2)}%;--row:${r.row};--at:${(r.x / 100).toFixed(3)}"></i>`).join("");
      return `<li><a class="br-row br-track" href="${esc(f.href)}">
        <span class="br-value">${num(f.value)}</span>
        <span class="br-label">${esc(f.label)}</span>
        <span class="br-lane" role="img" aria-label="${pct}% ${esc(f.note)}">${reads}<span class="br-end" style="left:${pct}%"></span></span>
        <span class="br-note"><b>${pct}%</b> ${esc(f.note)}</span>
      </a></li>`;
    }).join("")}</ul>
  </div>`;
}
