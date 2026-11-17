// #sources[/field] and #source/<id>
import { setStop } from "../core/lifecycle.js";
import { view, esc, safe, copy, replaceHash } from "../core/dom.js";
import { S } from "../core/store.js";
import { fieldOf, baseVar, STATE_LABEL, statusOf } from "../core/catalog.js";
import { licenceClass } from "../domain/format.js";
import { typeOf } from "../domain/links.js";
import { dot, history } from "../ui/status.js";
import { armArt } from "../ui/art.js";
import { loaderPanel, codePanel } from "../ui/code-panel.js";
import { gel } from "../ui/gel.js";
import { saveBtn } from "../ui/save.js";
import { sourceCard, datasetRow } from "../ui/cards.js";
import { notFound } from "./not-found.js";
import { trace, mountLive } from "../visuals/glyph.js";

export function pageSources(field) {
  const counts = {};
  S.sources.forEach((s) => (counts[s.field] = (counts[s.field] || 0) + 1));
  view.innerHTML = `<div class="page"><section class="section">
    <h1>Databases</h1>
    <p class="lede">Open a database to see every release with a direct link and ready-to-run download code. Each figure and trace is generated from the database name.</p>
    ${gel({ id: "chips", active: field, counts, unit: "databases", search: { id: "filter", placeholder: "Filter by name or release" } })}
    <ul class="db-list" id="grid"></ul>
  </section></div>`;
  let active = field || "";
  const grid = document.getElementById("grid");
  const filter = document.getElementById("filter");
  const draw = () => {
    const term = filter.value.trim().toLowerCase();
    const list = S.sources.filter((s) => (!active || s.field === active) &&
      (!term || s.name.toLowerCase().includes(term) || s.versions.some((v) => v.version.toLowerCase().includes(term))));
    grid.innerHTML = list.length ? list.map(sourceCard).join("") : `<li class="note">No database matches this filter.</li>`;
    armArt();
  };
  document.getElementById("chips").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-field]");
    if (!b) return;
    active = b.dataset.field;
    replaceHash(active ? `#sources/${active}` : "#sources");
    document.querySelectorAll("#chips button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    draw();
  });
  filter.addEventListener("input", draw);
  draw();
}

export function pageSource(id) {
  const s = S.sources.find((x) => x.id === id);
  if (!s) return notFound("That database is not in the atlas.");
  const f = fieldOf(s.field);
  const st = statusOf(s.id);
  const link = S.status?.links?.[s.id];
  const rows = [...s.versions].reverse();
  const related = S.datasets.filter((d) => d.field === s.field).slice(0, 5);
  view.innerHTML = `<div class="page">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="#sources">Databases</a><span aria-hidden="true">/</span><a href="#sources/${esc(s.field)}">${esc(f.label)}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(s.name)}</span></nav>
  <section class="detail">
    <div class="stage"><canvas id="stage" aria-label="3D figure generated from the name ${esc(s.name)}"></canvas>
      <div class="stage-tag"><small>Drag to turn the model</small></div></div>
    <div class="detail-info">
      <p class="field-name" style="--dot:${baseVar(f)}">${esc(f.label)}</p>
      <h1>${esc(s.name)}</h1>
      ${trace(s.name, 44)}
      <p class="lede">${esc(s.summary)}</p>
      <div class="detail-actions">${s.latest_url ? `<a class="btn solid" href="#get-current">Get the current release</a>` : ""}<a class="btn" href="#all-releases">All ${s.versions.length} releases</a>${saveBtn("db", s.id, "Save")}</div>
      <dl class="facts">
        <dt>Current release</dt><dd><b>${esc(s.latest) || "—"}</b> <span class="muted">${esc(s.latest_date)}</span></dd>
        <dt>Releases tracked</dt><dd>${s.versions.length}</dd>
        <dt>Licence</dt><dd><span class="badge ${licenceClass(s.license)}">${esc(s.license)}</span></dd>
        <dt>Website</dt><dd><a href="${esc(safe(s.homepage))}" target="_blank" rel="noopener">${esc(s.homepage)}</a></dd>
        <dt>Status today</dt><dd>${dot(s.id)} ${st ? `${esc(STATE_LABEL[st.state] || st.state)} <span class="muted">HTTP ${st.code || "—"}, ${st.ms} ms</span>` : `<span class="muted">Not checked yet</span>`}</dd>
        <dt>Download link</dt><dd>${link ? `${dot("")} ${link.state === "ok" ? "Answered today" : esc(STATE_LABEL[link.state] || link.state)} <span class="muted mono">HTTP ${link.code || "—"}</span>` : `<span class="muted">Not checked yet</span>`}</dd>
        <dt>Last 30 checks</dt><dd>${history(s.id)}</dd>
      </dl>
    </div>
  </section>

  ${s.latest_url ? `<section class="section" data-anchor="get-current"><h2>Get the current release</h2>${codePanel(s.latest_url, typeOf(s.latest_url, s.latest_url_type), `Release ${s.latest}`)}</section>` : ""}
  ${s.loaders?.length ? `<section class="section" data-anchor="get-code"><h2>Access in code</h2>${s.loaders.map((l) => loaderPanel(l, l.label)).join("")}</section>` : ""}

  <section class="section" data-anchor="all-releases">
    <div class="section-head"><h2>All releases</h2><span class="hint">Newest first. ✓ confirmed against the source; ? from prior knowledge.</span></div>
    <div class="toolbar">
      <label class="gel-search" for="relq"><svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true"><circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 12l4.5 4.5" stroke="currentColor" stroke-width="1.6"/></svg><input id="relq" type="search" placeholder="Find a release, e.g. ${esc(s.versions[0]?.version || "")}"></label>
      <label class="check"><input type="checkbox" id="rellinked"> Only releases with a direct link</label>
    </div>
    <div class="table-wrap"><table class="releases">
      <thead><tr><th>Release</th><th>Date</th><th>Status</th><th>Direct link</th><th></th><th>Checked</th></tr></thead>
      <tbody>${rows
        .map((v, i) => {
          const usable = /^(https?|ftp|s3|gs):/.test(v.url);
          return `<tr data-relrow="${i}" data-linked="${usable}" data-text="${esc(`${v.version} ${v.date} ${v.note}`.toLowerCase())}">
            <td><b>${esc(v.version)}</b>${v.note ? `<br><span class="hint">${esc(v.note)}</span>` : ""}</td>
            <td class="mono nowrap">${esc(v.date) || "—"}</td>
            <td><span class="status ${esc(v.status)}">${esc(v.status || "—")}</span></td>
            <td class="url">${v.url ? esc(v.url) : `<span class="muted">—</span>`}</td>
            <td class="nowrap">${usable ? `<button class="btn small" type="button" data-copy="${esc(v.url)}">Copy</button> <button class="btn small" type="button" data-rel="${i}">Code</button>` : ""}</td>
            <td>${v.verified ? "✓" : "?"}</td></tr>
            <tr data-relpanel="${i}" hidden><td colspan="6"></td></tr>`;
        })
        .join("")}</tbody>
    </table></div>
  </section>

  ${related.length ? `<section class="section"><div class="section-head"><h2>Datasets in ${esc(f.label.toLowerCase())}</h2><a href="#datasets/${esc(s.field)}">All datasets in this field</a></div>
     <div class="rows">${related.map(datasetRow).join("")}</div></section>` : ""}
  <section class="section"><div class="chips"><a class="chip" style="--dot:${baseVar(f)}" href="#papers/${esc(s.field)}">Papers in ${esc(f.label)}</a></div></section>
  </div>`;
  const filterReleases = () => {
    const q = document.getElementById("relq").value.trim().toLowerCase();
    const linkedOnly = document.getElementById("rellinked").checked;
    view.querySelectorAll("[data-relrow]").forEach((tr) => {
      const show = (!q || tr.dataset.text.includes(q)) && (!linkedOnly || tr.dataset.linked === "true");
      tr.hidden = !show;
      if (!show) view.querySelector(`[data-relpanel="${tr.dataset.relrow}"]`).hidden = true;
    });
  };
  ["relq", "rellinked"].forEach((x) => document.getElementById(x).addEventListener("input", filterReleases));
  // In-page jumps without changing the route.
  view.querySelectorAll('a[href="#get-current"], a[href="#all-releases"]').forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      view.querySelector(`[data-anchor="${a.getAttribute("href").slice(1)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    })
  );
  view.querySelectorAll("[data-rel]").forEach((b) =>
    b.addEventListener("click", () => {
      const i = Number(b.dataset.rel);
      const row = view.querySelector(`[data-relpanel="${i}"]`);
      if (!row.hidden) { row.hidden = true; return; }
      const v = rows[i];
      row.firstElementChild.innerHTML = codePanel(v.url, typeOf(v.url, v.url_type), `${s.name} ${v.version}`);
      row.hidden = false;
    })
  );
  setStop(mountLive(document.getElementById("stage"), s.name, f.shape));
  armArt();
}
