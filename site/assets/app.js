// Bioinformatics Data Atlas: reads the JSON files in data/ and draws the pages.
// Routes live in the URL hash: #home, #sources, #source/<id>, #datasets,
// #papers/<field>, #status, #about.
import { sequence, thumb, mountLive, clearThumbs } from "./glyph.js";

const view = document.getElementById("view");
const state = { fields: [], sources: [], datasets: [], papers: null, status: null, build: null };
let stopLive = () => {};

// ---------- small helpers ----------
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (n) => Number(n || 0).toLocaleString("en-US");
const short = (v) => String(v || "").split(" (")[0].split("؛")[0].trim();
const fieldOf = (id) => state.fields.find((f) => f.id === id) || { id, label: id, base: "A", shape: "network" };
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");

function strip(name, length = 28) {
  return `<span class="strip" aria-hidden="true">${sequence(name, length).map((b) => `<i class="b-${b}"></i>`).join("")}</span>`;
}

function licenceClass(text) {
  const t = (text || "").toLowerCase();
  if (/controlled|licence required|commercial licence|paid|academic use only|non-commercial|nc/.test(t)) {
    return /controlled/.test(t) ? "closed" : "limited";
  }
  if (/open|public domain|cc0|cc by|mit/.test(t)) return "open";
  return "";
}

function statusOf(id) {
  return state.status?.sources?.[id] || null;
}

const STATE_LABEL = { ok: "Reachable", blocked: "Up, refuses automated checks", down: "Not reachable" };

function dot(id) {
  const s = statusOf(id);
  const label = s ? STATE_LABEL[s.state] || s.state : "Not checked yet";
  return `<span class="dot ${s ? esc(s.state) : ""}" title="${esc(label)}" role="img" aria-label="${esc(label)}"></span>`;
}

function history(id) {
  const s = statusOf(id);
  if (!s?.history?.length) return `<span class="muted">No checks yet</span>`;
  return `<span class="history" role="img" aria-label="Daily checks, oldest first">${s.history
    .map((h) => `<i class="${esc(h.s)}" title="${esc(h.d)}: ${esc(STATE_LABEL[h.s] || h.s)}"></i>`)
    .join("")}</span>`;
}

// Draw 3D stills only when a card scrolls into view.
const lazy = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const img = e.target;
      lazy.unobserve(img);
      const url = thumb(img.dataset.name, img.dataset.shape);
      if (url) img.src = url;
    }
  },
  { rootMargin: "300px" }
);
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const art = (name, field) =>
  `<img src="${BLANK}" alt="" loading="lazy" data-name="${esc(name)}" data-shape="${esc(fieldOf(field).shape)}">`;
const armArt = () => view.querySelectorAll("img[data-name]").forEach((img) => lazy.observe(img));

function fieldChips(active, counts, hrefBase) {
  const all = `<button class="chip plain" type="button" data-field="" aria-pressed="${active ? "false" : "true"}">All</button>`;
  return (
    all +
    state.fields
      .filter((f) => !counts || counts[f.id])
      .map(
        (f) =>
          `<button class="chip" type="button" data-field="${esc(f.id)}" style="--dot: var(--base-${f.base.toLowerCase()})" aria-pressed="${
            active === f.id
          }">${esc(f.label)}${counts ? ` <span class="muted">${counts[f.id]}</span>` : ""}</button>`
      )
      .join("")
  );
}

// ---------- pages ----------
function sourceCard(s) {
  return `<a class="card" href="#source/${esc(s.id)}">
    <span class="card-art">${art(s.name, s.field)}</span>
    <span class="card-body">
      <h3>${esc(s.name)}</h3>
      ${strip(s.name)}
      <p>${esc(s.summary)}</p>
      <span class="card-meta"><span dir="auto">${dot(s.id)} ${esc(short(s.latest)) || "—"}</span><span>${s.versions.length} releases</span></span>
    </span>
  </a>`;
}

function paperItem(p) {
  const authors = p.authors.length > 150 ? p.authors.slice(0, 150).replace(/,[^,]*$/, "") + ", et al." : p.authors;
  return `<article class="paper">
    <h3><a href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener">${esc(p.title)}</a></h3>
    <p class="who">${esc(authors)}</p>
    <p class="meta"><span>${esc(p.journal || "—")}</span><span>${esc(p.year)}</span><span>cited ${num(p.cited)}×</span></p>
    <details><summary>Abstract</summary><p>${esc(p.abstract)}</p></details>
  </article>`;
}

function pageHome() {
  const day = Math.floor(Date.now() / 864e5);
  const featured = state.sources[day % state.sources.length];
  const f = fieldOf(featured.field);
  const checked = Object.values(state.status?.sources || {});
  const up = checked.filter((s) => s.state !== "down").length;
  const versions = state.sources.reduce((a, s) => a + s.versions.length, 0);
  const papers = (state.papers?.fields || []).reduce((a, x) => a + x.classics.length + x.recent.length, 0);
  const recent = (state.papers?.fields || [])
    .flatMap((x) => x.recent.slice(0, 1))
    .sort((a, b) => b.cited - a.cited)
    .slice(0, 4);

  view.innerHTML = `
  <section class="hero">
    <div class="hero-copy">
      <p class="eyebrow">Databases · Datasets · Papers · Daily status</p>
      <h1>Find the exact release of the data your analysis needs.</h1>
      <p class="lede">Every release of ${state.sources.length} major bioinformatics databases with its archive path and licence, ${state.datasets.length} public datasets and benchmarks, and the most cited open-access papers in each field. Checked every day.</p>
      <label class="search" for="q">
        <input id="q" type="search" autocomplete="off" placeholder="Search: Ensembl, gnomAD v4, single-cell, ZINC…" aria-label="Search databases, datasets and papers">
        <span class="kbd" aria-hidden="true">/</span>
      </label>
      <div id="results" class="results" hidden></div>
      <div class="stats">
        <div class="stat"><b>${num(state.sources.length)}</b><span>databases</span></div>
        <div class="stat"><b>${num(versions)}</b><span>releases tracked</span></div>
        <div class="stat"><b>${num(state.datasets.length)}</b><span>datasets</span></div>
        <div class="stat"><b>${num(papers)}</b><span>papers</span></div>
      </div>
    </div>
    <div class="hero-stage">
      <canvas id="stage" aria-label="3D figure generated from the name ${esc(featured.name)}"></canvas>
      <div class="stage-tag">
        <span><span class="eyebrow">Today's database</span><br><a href="#source/${esc(featured.id)}">${esc(featured.name)} →</a></span>
        <small>${esc(f.label)}<br>shape: ${esc(f.shape)} · drag to turn</small>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="section-head"><h2>Browse by field</h2><a href="#sources">All databases →</a></div>
    <div class="chips">${state.fields
      .map((x) => `<a class="chip" href="#sources/${esc(x.id)}" style="--dot: var(--base-${x.base.toLowerCase()})">${esc(x.label)}</a>`)
      .join("")}</div>
  </section>

  <section class="section">
    <div class="section-head"><h2>Recently updated databases</h2><a href="#status">${
      checked.length ? `${up} of ${checked.length} sources reachable today →` : "Source status →"
    }</a></div>
    <div class="grid">${[...state.sources]
      .filter((s) => /^\d{4}/.test(s.latest_date))
      .sort((a, b) => b.latest_date.localeCompare(a.latest_date))
      .slice(0, 8)
      .map(sourceCard)
      .join("")}</div>
  </section>

  <section class="section">
    <div class="section-head"><h2>Recent papers gaining citations</h2><a href="#papers">All papers by field →</a></div>
    <div class="paper-cols">
      <div class="paper-list">${recent.slice(0, 2).map(paperItem).join("")}</div>
      <div class="paper-list">${recent.slice(2, 4).map(paperItem).join("")}</div>
    </div>
  </section>`;

  stopLive = mountLive(document.getElementById("stage"), featured.name, f.shape);
  const q = document.getElementById("q");
  const box = document.getElementById("results");
  q.addEventListener("input", () => {
    const term = q.value.trim().toLowerCase();
    if (term.length < 2) { box.hidden = true; return; }
    const hit = (t) => String(t || "").toLowerCase().includes(term);
    const rows = [
      ...state.sources
        .filter((s) => hit(s.name) || hit(s.summary) || s.versions.some((v) => hit(v.version)))
        .slice(0, 6)
        .map((s) => [`#source/${s.id}`, s.name, "database"]),
      ...state.datasets
        .filter((d) => hit(d.name) || hit(d.desc))
        .slice(0, 6)
        .map((d) => [`#datasets/${d.field}/${encodeURIComponent(d.name)}`, d.name, "dataset"]),
      ...(state.papers?.fields || [])
        .flatMap((x) => [...x.classics, ...x.recent].map((p) => [x.id, p]))
        .filter(([, p]) => hit(p.title))
        .slice(0, 5)
        .map(([fid, p]) => [`#papers/${fid}`, p.title, "paper"]),
    ];
    box.hidden = false;
    box.innerHTML = rows.length
      ? rows.map(([href, label, kind]) => `<a href="${esc(href)}"><span>${esc(label)}</span><span class="kind">${kind}</span></a>`).join("")
      : `<p class="muted" style="padding:8px 10px">Nothing matches “${esc(q.value)}”. Try a database name or a field.</p>`;
  });
}

function pageSources(field) {
  const counts = {};
  state.sources.forEach((s) => (counts[s.field] = (counts[s.field] || 0) + 1));
  view.innerHTML = `
  <section class="section" style="margin-block-start:8px">
    <h1>Databases</h1>
    <p class="lede">Each card opens the full release history with archive paths. The figure and colour strip are generated from the database name.</p>
    <div class="toolbar">
      <div class="chips" id="chips">${fieldChips(field, counts)}</div>
      <input class="filter" id="filter" type="search" placeholder="Filter by name or release" aria-label="Filter databases">
    </div>
    <div class="grid" id="grid"></div>
  </section>`;
  const grid = document.getElementById("grid");
  const filter = document.getElementById("filter");
  let active = field || "";
  const draw = () => {
    const term = filter.value.trim().toLowerCase();
    const list = state.sources.filter(
      (s) =>
        (!active || s.field === active) &&
        (!term || s.name.toLowerCase().includes(term) || s.versions.some((v) => v.version.toLowerCase().includes(term)))
    );
    grid.innerHTML = list.length ? list.map(sourceCard).join("") : `<p class="note">No database matches this filter.</p>`;
    armArt();
  };
  document.getElementById("chips").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-field]");
    if (!b) return;
    active = b.dataset.field;
    history_replace(active ? `#sources/${active}` : "#sources");
    document.querySelectorAll("#chips button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    draw();
  });
  filter.addEventListener("input", draw);
  draw();
}

function history_replace(hash) {
  try { window.history.replaceState(null, "", hash); } catch (e) { /* file:// or sandbox */ }
}

function pageSource(id) {
  const s = state.sources.find((x) => x.id === id);
  if (!s) return notFound("That database is not in the atlas.");
  const f = fieldOf(s.field);
  const st = statusOf(s.id);
  const related = state.datasets.filter((d) => d.field === s.field).slice(0, 6);
  const rows = [...s.versions].reverse();
  view.innerHTML = `
  <a class="back" href="#sources/${esc(s.field)}">← ${esc(f.label)}</a>
  <section class="detail">
    <div class="hero-stage">
      <canvas id="stage" aria-label="3D figure generated from the name ${esc(s.name)}"></canvas>
      <div class="stage-tag"><span class="eyebrow">shape: ${esc(f.shape)}</span><small>drag to turn</small></div>
    </div>
    <div class="detail-info">
      <p class="eyebrow t-${esc(f.base)}">${esc(f.label)}</p>
      <h1>${esc(s.name)}</h1>
      ${strip(s.name, 40)}
      <p class="lede">${esc(s.summary)}</p>
      <dl class="facts">
        <dt>Latest release</dt><dd dir="auto"><b>${esc(short(s.latest)) || "—"}</b> <span class="muted">${esc(s.latest_date)}</span></dd>
        <dt>Releases tracked</dt><dd>${s.versions.length}</dd>
        <dt>Licence</dt><dd><span class="badge ${licenceClass(s.license)}">${esc(s.license)}</span></dd>
        <dt>Website</dt><dd><a href="${esc(safeUrl(s.homepage))}" target="_blank" rel="noopener">${esc(s.homepage)}</a></dd>
        <dt>Status today</dt><dd>${dot(s.id)} ${st ? `${esc(STATE_LABEL[st.state] || st.state)} <span class="muted mono">HTTP ${st.code || "—"} · ${st.ms} ms</span>` : `<span class="muted">Not checked yet</span>`}</dd>
        <dt>Last 30 checks</dt><dd>${history(s.id)}</dd>
      </dl>
    </div>
  </section>

  <section class="section">
    <div class="section-head"><h2>Release history</h2><span class="muted">newest first · ✓ confirmed against the source, ? from prior knowledge</span></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Release</th><th>Date</th><th>Path or pattern</th><th>Checked</th></tr></thead>
      <tbody>${rows
        .map(
          (v) => `<tr class="${v.latest ? "is-latest" : ""}">
          <td dir="auto">${esc(v.version)}</td><td dir="auto" class="mono">${esc(v.date)}</td>
          <td class="mono" dir="auto">${esc(v.url)}</td><td>${v.verified ? "✓" : "?"}</td></tr>`
        )
        .join("")}</tbody>
    </table></div>
  </section>

  ${
    related.length
      ? `<section class="section"><div class="section-head"><h2>Datasets in this field</h2><a href="#datasets/${esc(s.field)}">All →</a></div>
         <div class="rows">${related.map(datasetRow).join("")}</div></section>`
      : ""
  }
  <section class="section"><a class="chip plain" href="#papers/${esc(s.field)}">Most cited papers in ${esc(f.label)} →</a></section>`;
  stopLive = mountLive(document.getElementById("stage"), s.name, f.shape);
  armArt();
}

function datasetRow(d) {
  const links = [
    ...(safeUrl(d.repo) ? [{ label: "repository", url: d.repo }] : []),
    ...d.links.filter((l) => safeUrl(l.url)).slice(0, 5),
  ];
  return `<article class="row">
    <span class="row-art">${art(d.name, d.field)}</span>
    <div class="row-main">
      <h3>${esc(d.name)}</h3>
      ${d.desc ? `<p dir="auto">${esc(d.desc)}</p>` : ""}
      ${
        links.length
          ? `<div class="row-links">${links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("")}</div>`
          : d.access
          ? `<p class="mono" dir="auto">${esc(d.access)}</p>`
          : ""
      }
    </div>
    <span class="stars">${d.stars != null ? `★ ${num(d.stars)}` : ""}</span>
  </article>`;
}

function pageDatasets(field, preset) {
  const counts = {};
  state.datasets.forEach((d) => (counts[d.field] = (counts[d.field] || 0) + 1));
  view.innerHTML = `
  <section class="section" style="margin-block-start:8px">
    <h1>Datasets and benchmarks</h1>
    <p class="lede">Public datasets from GitHub, papers and challenges, with repository and download links. Descriptions are currently in Persian.</p>
    <div class="toolbar">
      <div class="chips" id="chips">${fieldChips(field, counts)}</div>
      <input class="filter" id="filter" type="search" placeholder="Filter by name" aria-label="Filter datasets" value="${esc(preset || "")}">
    </div>
    <div class="rows" id="rows"></div>
  </section>`;
  const rows = document.getElementById("rows");
  const filter = document.getElementById("filter");
  let active = field || "";
  const draw = () => {
    const term = filter.value.trim().toLowerCase();
    const list = state.datasets
      .filter((d) => (!active || d.field === active) && (!term || d.name.toLowerCase().includes(term) || d.desc.toLowerCase().includes(term)))
      .sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1));
    rows.innerHTML = list.length ? list.map(datasetRow).join("") : `<p class="note">No dataset matches this filter.</p>`;
    armArt();
  };
  document.getElementById("chips").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-field]");
    if (!b) return;
    active = b.dataset.field;
    history_replace(active ? `#datasets/${active}` : "#datasets");
    document.querySelectorAll("#chips button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    draw();
  });
  filter.addEventListener("input", draw);
  draw();
}

function pagePapers(field) {
  const all = state.papers?.fields || [];
  if (!all.length) return (view.innerHTML = `<p class="note">Papers have not been fetched yet. The daily job fills this page.</p>`);
  const current = all.find((x) => x.id === field) || all[0];
  view.innerHTML = `
  <section class="section" style="margin-block-start:8px">
    <h1>Papers by field</h1>
    <p class="lede">Open-access papers ranked by citation count, refreshed daily from Europe PMC. The left column is all-time, the right column is the last 24 months.</p>
    <div class="chips" id="chips">${state.fields
      .filter((f) => all.some((x) => x.id === f.id))
      .map(
        (f) =>
          `<a class="chip" href="#papers/${esc(f.id)}" style="--dot: var(--base-${f.base.toLowerCase()})" aria-pressed="${f.id === current.id}">${esc(f.label)}</a>`
      )
      .join("")}</div>
    <div class="paper-cols">
      <div class="paper-list"><p class="eyebrow">Most cited, all time</p>${current.classics.map(paperItem).join("") || `<p class="note">None found.</p>`}</div>
      <div class="paper-list"><p class="eyebrow">Most cited, last 24 months</p>${current.recent.map(paperItem).join("") || `<p class="note">None found.</p>`}</div>
    </div>
    <p class="note">Selection rule: ${esc(state.papers.rule)}<br><span class="mono">${esc(current.query)}</span><br>Fetched ${esc(state.papers.generated_at)} from ${esc(state.papers.source)}. Only open-access records are shown, so abstracts can be reused.</p>
  </section>`;
}

function pageStatus() {
  const checked = state.status?.checked_at;
  const body = state.sources
    .map((s) => {
      const st = statusOf(s.id);
      return `<tr><td><a href="#source/${esc(s.id)}">${esc(s.name)}</a></td>
        <td>${dot(s.id)} ${st ? esc(STATE_LABEL[st.state] || st.state) : `<span class="muted">Not checked yet</span>`}</td>
        <td class="mono">${st ? st.code || "—" : "—"}</td><td class="mono">${st ? st.ms + " ms" : "—"}</td><td>${history(s.id)}</td></tr>`;
    })
    .join("");
  view.innerHTML = `
  <section class="section" style="margin-block-start:8px">
    <h1>Source status</h1>
    <p class="lede">Once a day the build job requests each source's website and records the answer. A source that refuses automated checks still counts as up.</p>
    ${
      checked
        ? `<p class="muted">Last check: <span class="mono">${esc(checked)}</span></p>`
        : `<p class="note">No check has run yet. The first run of the daily job on GitHub fills this table.</p>`
    }
    <div class="table-wrap"><table>
      <thead><tr><th>Database</th><th>State</th><th>HTTP</th><th>Response</th><th>Last 30 days</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
  </section>`;
}

function pageAbout() {
  const b = state.build || {};
  const inputs = Object.entries(b.inputs || {}).map(([k, v]) => `${v.slice(0, 16)}…  ${k}`).join("\n");
  view.innerHTML = `
  <section class="section" style="margin-block-start:8px">
    <h1>How the atlas is built</h1>
    <div class="prose">
      <p>The site is a set of static pages. A small Rust program, <code>atlas</code>, reads four files kept in the repository and writes the JSON files these pages load. A GitHub Actions job runs it every day, commits the new data and publishes the site.</p>
      <h2>What is checked every day</h2>
      <p><b>Papers.</b> For each field, one Europe PMC query returns open-access papers ranked by citations: all-time and the last 24 months. The query for every field is printed on its page.</p>
      <p><b>Status.</b> Each source's website is requested once. The answer and the response time are kept for 30 days.</p>
      <h2>Reproducing a build</h2>
      <p>Databases, releases and datasets come only from files in the repository, so the same commit always gives the same <code>sources.json</code> and <code>datasets.json</code>. Run <code>atlas build --offline</code> to rebuild them without any network call. Each build records the commit and the SHA-256 of every input:</p>
      <div class="pre">built      ${esc(b.generated_at || "—")}
engine     ${esc(b.engine || "—")}
commit     ${esc(b.commit || "—")}
mode       ${esc(b.mode || "—")}
${esc(inputs)}</div>
      <h2>Adding or fixing an entry</h2>
      <p>Add a block to <code>registry/sources.toml</code> and rows to <code>databases_versions.csv</code>, then open a pull request. No code change is needed.</p>
      <h2>Limits</h2>
      <p>Release rows marked “?” come from prior knowledge and were not confirmed against the source. Licence text is a short indication, not legal advice. The atlas links to data; it does not host or mirror any of it.</p>
    </div>
  </section>`;
}

function notFound(message) {
  view.innerHTML = `<section class="section"><h1>Not found</h1><p class="lede">${esc(message)}</p><a class="chip plain" href="#home">Back to the start</a></section>`;
}

// ---------- router ----------
function route() {
  stopLive();
  stopLive = () => {};
  const [page, a, b] = decodeURIComponent(location.hash.replace(/^#/, "") || "home").split("/");
  const nav = { source: "sources" }[page] || page;
  document.querySelectorAll(".nav a").forEach((x) => {
    if (x.dataset.nav === nav) x.setAttribute("aria-current", "page");
    else x.removeAttribute("aria-current");
  });
  if (page === "home") pageHome();
  else if (page === "sources") pageSources(a);
  else if (page === "source") pageSource(a);
  else if (page === "datasets") pageDatasets(a, b);
  else if (page === "papers") pagePapers(a);
  else if (page === "status") pageStatus();
  else if (page === "about") pageAbout();
  else notFound("That page does not exist.");
  armArt();
  window.scrollTo(0, 0);
}

// ---------- theme ----------
function initTheme() {
  let saved = "";
  try { saved = localStorage.getItem("atlas-theme") || ""; } catch (e) { /* storage blocked */ }
  if (saved) document.documentElement.dataset.theme = saved;
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const dark =
      document.documentElement.dataset.theme === "dark" ||
      (!document.documentElement.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("atlas-theme", next); } catch (e) { /* storage blocked */ }
    clearThumbs();
    route();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !/input|textarea/i.test(document.activeElement.tagName)) {
    const q = document.getElementById("q") || document.getElementById("filter");
    if (q) { e.preventDefault(); q.focus(); }
  }
});

async function load(name) {
  const res = await fetch(`data/${name}.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${name}.json: HTTP ${res.status}`);
  return res.json();
}

async function start() {
  initTheme();
  try {
    const [sources, datasets] = await Promise.all([load("sources"), load("datasets")]);
    state.fields = sources.fields;
    state.sources = sources.sources;
    state.datasets = datasets.datasets;
    const optional = await Promise.allSettled([load("papers"), load("status"), load("build")]);
    state.papers = optional[0].status === "fulfilled" ? optional[0].value : null;
    state.status = optional[1].status === "fulfilled" ? optional[1].value : null;
    state.build = optional[2].status === "fulfilled" ? optional[2].value : null;
  } catch (err) {
    view.innerHTML = `<p class="note">The data files could not be loaded (${esc(err.message)}). If you opened this page from a folder, serve it over HTTP instead, for example with <code>npx serve site</code>.</p>`;
    return;
  }
  if (state.build) {
    document.getElementById("foot-build").textContent = `Data build: ${state.build.generated_at} · ${state.build.engine}`;
  }
  window.addEventListener("hashchange", route);
  route();
}

start();
