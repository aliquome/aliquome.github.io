// #home
import { setStop } from "../core/lifecycle.js";
import { view, esc, num } from "../core/dom.js";
import { S, need } from "../core/store.js";
import { fieldOf, baseVar } from "../core/catalog.js";
import { armArt } from "../ui/art.js";
import { gel } from "../ui/gel.js";
import { sourceCard, paperCard, boardTable } from "../ui/cards.js";
import { palette } from "../core/search.js";
import { mountLive } from "../visuals/glyph.js";
import { mountCells } from "../visuals/cells.js";

export async function pageHome() {
  const day = Math.floor(Date.now() / 864e5);
  const featured = S.sources[day % S.sources.length];
  const f = fieldOf(featured.field);
  const checked = Object.values(S.status?.sources || {});
  const up = checked.filter((s) => s.state !== "down").length;
  const versions = S.sources.reduce((a, s) => a + s.versions.length, 0);
  const linked = S.sources.reduce((a, s) => a + s.versions.filter((v) => /^(https?|ftp|s3|gs):/.test(v.url)).length, 0);

  view.innerHTML = `<div class="page">
  <section class="section hero">
    <canvas class="cells" id="cells" aria-hidden="true"></canvas>
    <div class="hero-copy">
      <h1>Every release, one link away</h1>
      <p class="lede">Exact versions of ${S.sources.length} databases, ready to paste into your code.</p>
      <button class="search hero-search" type="button" data-open-search>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 12l4.5 4.5" stroke="currentColor" stroke-width="1.6"/></svg>
        <span>Search a database, a release, a dataset or a paper</span>
        <kbd>/</kbd>
      </button>
      <p class="try"><span class="muted">Try</span>${["GRCh38", "Ensembl 116", "gnomAD", "AlphaFold", "ChEMBL"]
        .map((t) => `<button class="tag" type="button" data-search-for="${esc(t)}">${esc(t)}</button>`).join("")}</p>
    </div>
    <div class="stage">
      <canvas id="stage" aria-label="3D figure generated from the name ${esc(featured.name)}"></canvas>
      <div class="stage-tag">
        <span><span class="label">Database of the day</span><br><a href="#source/${esc(featured.id)}">${esc(featured.name)}</a></span>
        <small>Drag to turn</small>
      </div>
    </div>
  </section>

  <section class="section ledger" aria-label="The atlas today">
    <dl class="figures">
      <div><dt>Databases</dt><dd class="num">${num(S.sources.length)}</dd></div>
      <div><dt>Releases tracked</dt><dd class="num">${num(versions)}</dd></div>
      <div><dt>With a direct link</dt><dd class="num">${num(linked)}</dd></div>
      <div><dt>Datasets</dt><dd class="num">${num(S.datasets.length)}</dd></div>
      ${checked.length ? "" : "<!-- status cell appears after the first daily check -->"}<div ${checked.length ? "" : "hidden"}><dt>Sources up today</dt><dd class="num">${up} of ${checked.length}</dd></div>
    </dl>
  </section>

  <section class="section actions">
    <a class="action" href="#sources" style="--dot:var(--base-a)"><b>Pin a database release</b><span>${num(S.sources.length)} databases, every version with its own link</span></a>
    <a class="action" href="#datasets" style="--dot:var(--base-c)"><b>Find a training set</b><span>${num(S.datasets.length)} datasets and benchmarks, with download code</span></a>
    <a class="action" href="#latest" style="--dot:var(--base-g)"><b>Read this month’s methods</b><span>Bioinformatics, NAR, Nature Methods and more</span></a>
    <a class="action" href="#benchmarks" style="--dot:var(--base-t)"><b>Rank protein models</b><span>ProteinGym results as published</span></a>
  </section>

  <section class="section">
    <div class="section-head"><h2>Databases by field</h2><a href="#sources">All databases</a></div>
    ${gel({ id: "home-gel", counts: Object.fromEntries(S.fields.map((x) => [x.id, S.sources.filter((s) => s.field === x.id).length])), unit: "databases", link: (id) => `#sources/${id}` })}
    <ul class="field-index">${S.fields.map((x) => `<li style="--dot:${baseVar(x)}"><h3>${esc(x.label)}</h3><p class="field-links"><a href="#sources/${esc(x.id)}">${S.sources.filter((s) => s.field === x.id).length} databases</a><a href="#datasets/${esc(x.id)}">${S.datasets.filter((d) => d.field === x.id).length} datasets</a><a href="#latest/${esc(x.id)}" data-latest-count="${esc(x.id)}">New papers</a></p></li>`).join("")}</ul>
  </section>

  <section class="section" id="home-latest"></section>

  <section class="section">
    <div class="section-head"><h2>Recently released</h2><a href="#sources">All databases</a></div>
    <ul class="db-list compact">${[...S.sources]
      .filter((s) => /^\d{4}-\d{2}/.test(s.latest_date))
      .sort((a, b) => b.latest_date.localeCompare(a.latest_date))
      .slice(0, 4)
      .map(sourceCard)
      .join("")}</ul>
  </section>

  <section class="section" id="home-board"></section>
  </div>`;

  const stop3d = mountLive(document.getElementById("stage"), featured.name, f.shape);
  const stopCells = mountCells(document.getElementById("cells"));
  setStop(() => { stop3d(); stopCells(); });
  view.querySelectorAll("[data-open-search]").forEach((b) => b.addEventListener("click", () => palette.open()));
  view.querySelectorAll("[data-search-for]").forEach((b) => b.addEventListener("click", () => palette.open(b.dataset.searchFor)));
  armArt();

  const latest = await need("latest");
  const lslot = document.getElementById("home-latest");
  if (latest?.papers?.length && lslot) {
    const counts = {};
    latest.papers.forEach((p) => p.fields?.forEach((fid) => (counts[fid] = (counts[fid] || 0) + 1)));
    document.querySelectorAll("[data-latest-count]").forEach((el) => (el.textContent = `${counts[el.dataset.latestCount] || 0} new papers`));
    const fresh = latest.papers.filter((p) => p.abstract).slice(0, 4);
    lslot.innerHTML = `<div class="section-head"><h2>New in the journals</h2><a href="#latest">${num(latest.papers.length)} papers in the last ${latest.days} days</a></div>
      <div class="paper-list">${fresh.map((p) => paperCard(p, "")).join("")}</div>`;
  }

  const boards = await need("boards");
  const b = boards?.boards?.[0];
  const slot = document.getElementById("home-board");
  if (b && slot) {
    slot.innerHTML = `<div class="section-head"><h2>Top models on ${esc(b.title.split(":")[0])}</h2><a href="#benchmarks/${esc(b.id)}">Full comparison</a></div>
      ${boardTable(b, b.rows.slice(0, 5), false)}`;
  }
}
