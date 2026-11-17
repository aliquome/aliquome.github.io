// Rows and cards for sources, datasets, papers and board tables.
import { esc, num, safe, copy } from "../core/dom.js";
import { fieldOf, baseVar, paperIndex, dsName, dsHref, uniqueByName, taskLabel } from "../core/catalog.js";
import { prettyDate, cut, shortCite } from "../domain/format.js";
import { inferType } from "../domain/links.js";
import { benchIdx, modelHref } from "../domain/bench-index.js";
import { art } from "./art.js";
import { loaderLink } from "./code-panel.js";
import { saveBtn } from "./save.js";
import { trace } from "../visuals/glyph.js";
import { bibtex } from "../services/library.js";
import { towardBest } from "../domain/ranking.js";
import { stripHead, stripCell } from "./strip.js";

export function sourceCard(s) {
  return `<li class="db-row">
    <a class="db-link" href="#source/${esc(s.id)}">
      <span class="db-art">${art(s.name, s.field)}</span>
      <span class="db-main"><h3 class="db-name">${esc(s.name)}</h3>${trace(s.name)}<span class="db-sum">${esc(s.summary)}</span></span>
      <span class="db-rel"><span class="label">Current</span><span class="mono">${esc(s.latest) || "—"}</span></span>
      <span class="db-count"><span class="label">Releases</span><span class="num">${s.versions.length}</span></span>
    </a>${saveBtn("db", s.id)}</li>`;
}

export function paperCard(p, field, open = false) {
  paperIndex.set(p.id, p);
  const authors = p.authors.length > 170 ? p.authors.slice(0, 170).replace(/,[^,]*$/, "") + ", et al." : p.authors;
  const fieldTags = (p.fields || []).map((id) => {
    const f = fieldOf(id);
    return `<a class="tag field" style="--dot:${baseVar(f)}" href="#latest/${esc(id)}">${esc(f.label)}</a>`;
  }).join("");
  return `<article class="paper"><div class="paper-text">
    <h3><a href="${esc(safe(p.url))}" target="_blank" rel="noopener">${esc(p.title)}</a></h3>
    <p class="who">${esc(authors)}</p>
    ${p.abstract
      ? `<p class="abstract" lang="en" data-paper="${esc(p.id)}">${esc(open || p.abstract.length <= 420 ? p.abstract : cut(p.abstract))}</p>
    ${p.abstract.length > 420 ? `<button class="more" type="button" data-more>${open ? "Show less" : "Read the full abstract"}</button>` : ""}`
      : `<p class="hint">The abstract of this paper is not openly licensed. Read it on the publisher’s page.</p>`}
    </div><div class="paper-side">
    <p class="meta"><span class="journal">${esc(p.journal || "—")}</span><span>${esc(p.fields ? prettyDate(p.date) : p.year)}</span>${
      p.cited ? `<span>cited ${num(p.cited)}×</span>` : ""}${
      p.license ? `<span>${esc(p.license.toUpperCase())}</span>` : ""
    }${p.lists?.includes("recent") ? `<span class="status latest">recent</span>` : ""}</p>
    ${
      fieldTags || p.tasks?.length || p.datasets?.length
        ? `<div class="tags">${fieldTags}${(p.tasks || []).map((t) => `<span class="tag task">${esc(taskLabel(field, t))}</span>`).join("")}${uniqueByName(p.datasets || [])
            .map((d) => `<a class="tag ds" href="${esc(dsHref(d))}">${esc(dsName(d))}</a>`)
            .join("")}</div>`
        : ""
    }
    <div class="links">${safe(p.url) ? `<a class="btn small" href="${esc(p.url)}" target="_blank" rel="noopener">Article</a>` : ""}${
      safe(p.pdf) ? `<a class="btn small" href="${esc(p.pdf)}" target="_blank" rel="noopener">PDF</a>` : ""
    }<button class="btn small" type="button" data-cite="${esc(p.id)}">Cite (BibTeX)</button>${saveBtn("pp", p.id, "Save")}</div>
  </div></article>`;
}

document.addEventListener("click", (e) => {
  const c = e.target.closest("[data-cite]");
  if (c && paperIndex.has(c.dataset.cite)) copy(bibtex(paperIndex.get(c.dataset.cite)));
});

document.addEventListener("click", (e) => {
  const more = e.target.closest("[data-more]");
  if (!more) return;
  const abs = more.parentElement.querySelector(".abstract");
  const p = paperIndex.get(abs.dataset.paper);
  if (!p) return;
  const opened = more.textContent.startsWith("Read");
  abs.textContent = opened ? p.abstract : cut(p.abstract);
  more.textContent = opened ? "Show less" : "Read the full abstract";
});

export function datasetRow(d) {
  const links = [...(safe(d.repo) ? [{ label: "Repository", url: d.repo }] : []), ...d.links.filter((l) => safe(l.url))];
  const facts = [d.versions && `Versions: ${d.versions}`, d.license && `Licence: ${d.license}`, d.paper_count && `Used by ${d.paper_count} papers`]
    .filter(Boolean).join(". ");
  return `<article class="row">
    <span class="row-art">${art(d.name, d.field)}</span>
    <div class="row-main">
      <h3>${esc(d.name)}</h3>
      ${d.description ? `<p>${esc(d.description)}</p>` : ""}
      ${facts ? `<p class="hint">${esc(facts)}</p>` : ""}
      ${d.access ? `<p class="mono hint">${esc(d.access)}</p>` : ""}
      ${links.length || d.loaders?.length ? `<div class="row-links">${(d.loaders || []).map((l, i) => loaderLink(l, `ds:${d.id}:${i}`, d.name)).join("")}${links.slice(0, 8).map((l) => {
        const type = inferType(l.url);
        return `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>${
          type !== "portal" ? `<button type="button" data-code="${esc(l.url)}" data-type="${type}" data-label="${esc(d.name + ", " + l.label)}">code</button>` : ""}`;
      }).join("")}</div>` : ""}
    </div>
    <div class="row-side"><span class="stars">${d.stars != null ? `★ ${num(d.stars)}` : ""}</span>${saveBtn("ds", d.id)}</div>
  </article>`;
}

export function boardTable(b, rows, full = true) {
  const scores = b.rows.map((r) => r.score);
  const lo = Math.min(...scores), hi = Math.max(...scores);
  return `<div class="table-wrap"><table class="board">
    <thead><tr><th class="num">#</th><th>Model</th><th>Family</th><th class="num">${esc(b.metric_label)}</th>${stripHead()}${full ? b.columns.map((c) => `<th class="num">${esc(c)}</th>`).join("") + "<th>Paper</th>" : ""}</tr></thead>
    <tbody>${rows.map((r) => `<tr><td class="num">${r.rank}</td><td>${benchIdx?.modelKey.has(r.model) ? `<a href="${modelHref(r.model)}"><b>${esc(r.model)}</b></a>` : `<b>${esc(r.model)}</b>`}</td><td class="muted">${esc(r.kind)}</td>
      <td class="num score">${r.score.toFixed(3)}</td>${stripCell(towardBest(r.score, lo, hi, b.higher), r.rank === 1)}
      ${full ? r.values.map((v) => `<td class="num">${v == null ? "—" : v.toFixed(3)}</td>`).join("") +
        `<td class="nowrap">${safe(r.paper_url) ? `<a href="${esc(r.paper_url)}" target="_blank" rel="noopener" title="${esc(r.paper)}">${esc(shortCite(r.paper))}</a>` : "—"}</td>` : ""}</tr>`).join("")}</tbody>
  </table></div>`;
}
