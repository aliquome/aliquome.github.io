// #datasets[/field[/name]]
import { view, replaceHash } from "../core/dom.js";
import { S } from "../core/store.js";
import { armArt } from "../ui/art.js";
import { gel } from "../ui/gel.js";
import { datasetRow } from "../ui/cards.js";

export function pageDatasets(field, preset) {
  const counts = {};
  S.datasets.forEach((d) => (counts[d.field] = (counts[d.field] || 0) + 1));
  view.innerHTML = `<div class="page"><section class="section">
    <h1>Datasets and benchmarks</h1>
    <p class="lede">Press “code” next to a link to get a download snippet for your language.</p>
    ${gel({ id: "chips", active: field, counts, unit: "datasets", search: { id: "filter", placeholder: "Filter by name or description", value: preset } })}
    <p class="count" id="count"></p>
    <div class="rows" id="rows"></div>
    <div class="more-row"><button class="btn" type="button" id="dsmore" hidden>Show more datasets</button></div>
  </section></div>`;
  let active = field || "";
  let shown = 30;
  const rows = document.getElementById("rows");
  const filter = document.getElementById("filter");
  const draw = () => {
    const term = filter.value.trim().toLowerCase();
    const list = S.datasets
      .filter((d) => (!active || d.field === active) && (!term || d.name.toLowerCase().includes(term) || d.description.toLowerCase().includes(term)))
      .sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1) || (b.paper_count ?? 0) - (a.paper_count ?? 0));
    document.getElementById("count").textContent = `${list.length} of ${S.datasets.length} datasets`;
    rows.innerHTML = list.length ? list.slice(0, shown).map(datasetRow).join("") : `<p class="note">No dataset matches this filter.</p>`;
    document.getElementById("dsmore").hidden = list.length <= shown;
    armArt();
  };
  document.getElementById("dsmore").addEventListener("click", () => { shown += 30; draw(); });
  filter.addEventListener("input", () => { shown = 30; });
  document.getElementById("chips").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-field]");
    if (!b) return;
    active = b.dataset.field;
    replaceHash(active ? `#datasets/${active}` : "#datasets");
    document.querySelectorAll("#chips button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    draw();
  });
  filter.addEventListener("input", draw);
  draw();
}
