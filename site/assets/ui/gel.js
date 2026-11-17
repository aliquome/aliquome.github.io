// The field filter, drawn as an electrophoresis gel.
import { esc, num } from "../core/dom.js";
import { S } from "../core/store.js";
import { baseVar } from "../core/catalog.js";

// The field filter is drawn as an electrophoresis gel: one lane per field,
// a marker ladder for "All", and a glowing band whose thickness and
// migration follow how many entries the field holds.
//   gel({ id, active, counts, unit, search, link })
//   link: optional (fieldId) => href, turns lanes into links instead of buttons
export function gel({ id, active = "", counts, unit = "entries", search, link, total: given }) {
  const fields = S.fields.filter((f) => counts[f.id]);
  // Papers can sit in several fields, so the caller may pass the real total.
  const total = given ?? Object.values(counts).reduce((a, n) => a + n, 0);
  const max = Math.max(1, ...fields.map((f) => counts[f.id]));
  const lane = (f) => {
    const n = counts[f.id];
    const pos = 14 + (1 - Math.log(n + 1) / Math.log(max + 1)) * 58;
    const thick = 4 + Math.round((n / max) * 9);
    const tag = link ? "a" : "button";
    const attrs = link
      ? `href="${esc(link(f.id))}" ${active === f.id ? 'aria-current="true"' : ""}`
      : `type="button" data-field="${esc(f.id)}" aria-pressed="${active === f.id}"`;
    return `<${tag} class="lane" ${attrs} data-label="${esc(f.label)}" data-n="${n}" style="--dot:${baseVar(f)};--pos:${pos.toFixed(1)}%;--thick:${thick}px">
      <span class="well" aria-hidden="true"></span>
      <span class="track" aria-hidden="true"><i class="band"></i></span>
      <span class="lane-label">${esc(f.label)}</span><span class="lane-n">${num(n)}</span>
    </${tag}>`;
  };
  const ladder = link
    ? ""
    : `<button class="lane ladder" type="button" data-field="" aria-pressed="${!active}" data-label="All fields" data-n="${total}">
      <span class="well" aria-hidden="true"></span>
      <span class="track" aria-hidden="true">${[12, 22, 30, 38, 47, 58, 70, 82].map((p) => `<i class="band" style="--pos:${p}%"></i>`).join("")}</span>
      <span class="lane-label">All fields</span><span class="lane-n">${num(total)}</span>
    </button>`;
  const current = active ? fields.find((f) => f.id === active) : null;
  return `<div class="gel">
    <div class="gel-head">
      <p class="gel-readout"><span class="label">Field</span> <b data-readout>${esc(current ? current.label : "All fields")}</b> <span class="muted" data-readout-n>${num(current ? counts[current.id] : total)} ${esc(unit)}</span></p>
      ${search ? `<label class="gel-search" for="${esc(search.id)}"><svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true"><circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 12l4.5 4.5" stroke="currentColor" stroke-width="1.6"/></svg><input id="${esc(search.id)}" type="search" placeholder="${esc(search.placeholder)}" value="${esc(search.value || "")}" aria-label="${esc(search.placeholder)}"></label>` : ""}
    </div>
    <div class="gel-slab" id="${esc(id)}" role="group" aria-label="Filter by field">${ladder}${fields.map(lane).join("")}</div>
  </div>`;
}

// Keep the gel's readout in step with the selected lane.
document.addEventListener("click", (e) => {
  const lane = e.target.closest(".gel .lane");
  if (!lane || lane.tagName === "A") return;
  const g = lane.closest(".gel");
  g.querySelector("[data-readout]").textContent = lane.dataset.label;
  const unit = g.querySelector("[data-readout-n]").textContent.replace(/^[\d,]+\s*/, "");
  g.querySelector("[data-readout-n]").textContent = `${num(lane.dataset.n)} ${unit}`;
});
