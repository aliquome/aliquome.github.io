// #benchmarks: tables, models, papers, one table, one board.
import { view, esc, num, safe, replaceHash } from "../core/dom.js";
import { S, need, needTables } from "../core/store.js";
import { fieldOf, baseVar, taskLabel } from "../core/catalog.js";
import { approvedView, rankRows } from "../domain/ranking.js";
import { benchIdx, paperName, buildBenchIndex, modelHref, paperHref, datasetHref, entryHref, placeText, summarize } from "../domain/bench-index.js";
import { gel } from "../ui/gel.js";
import { boardTable } from "../ui/cards.js";
import { mountSuggest } from "../features/suggest.js";

// The repository that takes proposals: a <meta name="atlas-repo"> override,
// otherwise derived from the GitHub Pages address.
export function repoUrl() {
  const meta = document.querySelector('meta[name="atlas-repo"]')?.content?.trim();
  if (meta) return meta.replace(/\/$/, "");
  const m = location.hostname.match(/^([\w-]+)\.github\.io$/i);
  if (!m) return "";
  const first = location.pathname.split("/").filter(Boolean)[0];
  return `https://github.com/${m[1]}/${first || `${m[1]}.github.io`}`;
}

export const benchTabs = (on, idx, nTables) => `<nav class="tabbar" aria-label="Benchmark views">
  <a href="#benchmarks" ${on === "tables" ? 'aria-current="page"' : ""}>Tables <small>${nTables} results tables</small></a>
  <a href="#benchmarks/models" ${on === "models" ? 'aria-current="page"' : ""}>Models <small>${num(idx.byModel.size)} models</small></a>
  <a href="#benchmarks/papers" ${on === "papers" ? 'aria-current="page"' : ""}>Papers <small>${num(idx.byPaper.size)} papers</small></a>
</nav>`;

export async function pageBenchmarks(a, b) {
  view.innerHTML = `<div class="page"><p class="loading">Loading benchmarks…</p></div>`;
  const [data, tables] = await Promise.all([need("boards"), needTables()]);
  const boards = data?.boards || [];
  const idx = buildBenchIndex(tables, boards);
  if (a === "models" || a === "papers") return pageBenchList(a, tables, b || "");
  if (a === "model" && idx.modelByKey.has(b)) return pageBenchProfile("model", idx.modelByKey.get(b));
  if (a === "paper" && idx.paperByKey.has(b)) return pageBenchProfile("paper", idx.paperByKey.get(b));
  if (a === "dataset" && idx.datasetByKey.has(b)) return pageBenchIndex(boards, tables, "", "", idx.datasetByKey.get(b));
  if (a && boards.some((x) => x.id === a)) return pageBoard(boards, a);
  const t = tables.find((x) => x.id === a);
  if (t) return pageTable(t);
  return pageBenchIndex(boards, tables, S.fields.some((f) => f.id === a) ? a : "", b || "", "");
}

export function pageBenchIndex(boards, tables, field, preset, dataset) {
  const counts = {};
  tables.forEach((t) => (counts[t.field] = (counts[t.field] || 0) + 1));
  view.innerHTML = `<div class="page"><section class="section">
    <h1>Benchmarks</h1>
    <p class="lede">Published results, ranked. Open a table to rank it by another metric, or a model or paper to see every ranking it appears in. Anyone can propose a different ranking, and it goes live once a maintainer approves it.</p>
    ${benchTabs("tables", benchIdx, tables.length)}
    ${boards.length ? `<div class="section-head"><h2>Maintained boards</h2><span class="hint">Copied daily from the benchmark maintainers</span></div>
    <ul class="board-list">${boards.map((x) => `<li><a href="#benchmarks/${esc(x.id)}"><b>${esc(x.title)}</b><span class="hint">${x.rows.length} models, ranked by ${esc(x.metric_label)}</span></a></li>`).join("")}</ul>` : ""}
    <div class="section-head"><h2>Results tables</h2><span class="hint">${tables.length} tables from the Papers with Code archive</span></div>
    ${gel({ id: "bgel", active: field, counts, unit: "tables", search: { id: "bq", placeholder: "Filter by task, dataset, metric or model", value: preset } })}
    <div class="controls bench-filters">
      <div class="control"><label for="btask">Task</label><select class="input" id="btask"></select></div>
      <div class="control"><label for="bds">Dataset</label><select class="input" id="bds"></select></div>
    </div>
    <p class="count" id="bcount"></p>
    <div class="table-wrap"><table class="bench-index">
      <thead><tr><th>Task</th><th>Dataset</th><th>Ranked by</th><th>Models</th><th>Leader</th></tr></thead>
      <tbody id="brows"></tbody>
    </table></div>
    <div class="more-row"><button class="btn" type="button" id="bmore" hidden>Show more tables</button></div>
  </section></div>`;
  let active = field, task = "", ds = dataset, shown = 40;
  const q = document.getElementById("bq");
  const options = (el, label, values, current) => {
    const c = {};
    values.forEach((x) => (c[x] = (c[x] || 0) + 1));
    el.innerHTML = `<option value="">${label}</option>` + Object.keys(c).sort((x, y) => x.localeCompare(y))
      .map((x) => `<option value="${esc(x)}" ${x === current ? "selected" : ""}>${esc(x)} (${c[x]})</option>`).join("");
  };
  const draw = () => {
    const term = q.value.trim().toLowerCase();
    const inField = tables.filter((t) => !active || t.field === active);
    if (task && !inField.some((t) => t.task === task)) task = "";
    if (ds && !inField.some((t) => t.dataset === ds && (!task || t.task === task))) ds = "";
    options(document.getElementById("btask"), "All tasks", inField.filter((t) => !ds || t.dataset === ds).map((t) => t.task), task);
    options(document.getElementById("bds"), "All datasets", inField.filter((t) => !task || t.task === task).map((t) => t.dataset), ds);
    const list = inField.filter((t) => (!task || t.task === task) && (!ds || t.dataset === ds) && (!term ||
      `${t.task} ${t.dataset} ${t.path.join(" ")} ${t.metrics.map((m) => m.name).join(" ")} ${t.rows.map((r) => r.model).join(" ")}`.toLowerCase().includes(term)));
    document.getElementById("bcount").textContent = `${list.length} of ${tables.length} tables`;
    document.getElementById("brows").innerHTML = list.slice(0, shown).map((t) => {
      const v = approvedView(t);
      const top = rankRows(t, v).filter((x) => x.rank === 1);
      return `<tr><td><a href="#benchmarks/${esc(t.id)}"><b>${esc(t.task)}</b></a></td>
        <td><a href="${datasetHref(t.dataset)}">${esc(t.dataset)}</a></td>
        <td>${esc(v.metric)} <span class="hint">${v.higher ? "higher is better" : "lower is better"}</span></td><td class="num">${t.rows.length}</td>
        <td>${top.length ? top.map((x) => `<a href="${modelHref(x.r.model)}">${esc(x.r.model)}</a> <span class="mono hint">${esc(x.r.values[v.metric])}</span>`).join("<br>") : "—"}</td></tr>`;
    }).join("") || `<tr><td colspan="5" class="note">No table matches this filter.</td></tr>`;
    document.getElementById("bmore").hidden = list.length <= shown;
  };
  q.addEventListener("input", () => { shown = 40; draw(); });
  document.getElementById("btask").addEventListener("change", (e) => { task = e.target.value; shown = 40; draw(); });
  document.getElementById("bds").addEventListener("change", (e) => {
    ds = e.target.value;
    replaceHash(ds ? datasetHref(ds) : active ? `#benchmarks/${active}` : "#benchmarks");
    shown = 40;
    draw();
  });
  document.getElementById("bmore").addEventListener("click", () => { shown += 40; draw(); });
  document.getElementById("bgel").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-field]");
    if (!btn) return;
    active = btn.dataset.field;
    replaceHash(active ? `#benchmarks/${active}` : "#benchmarks");
    document.querySelectorAll("#bgel button").forEach((x) => x.setAttribute("aria-pressed", String(x === btn)));
    shown = 40;
    draw();
  });
  draw();
}

// Models or papers, with how many tables they appear in and how many they lead.
export function pageBenchList(kind, tables, preset) {
  const idx = benchIdx;
  const groups = kind === "models" ? idx.byModel : idx.byPaper;
  const items = [...groups].map(([name, list]) => ({ name, list, ...summarize(list), models: new Set(list.map((e) => e.model)).size }));
  const counts = {};
  items.forEach((it) => it.fields.forEach((f) => (counts[f] = (counts[f] || 0) + 1)));
  const label = kind === "models" ? "models" : "papers";
  view.innerHTML = `<div class="page"><section class="section">
    <h1>Benchmarks</h1>
    <p class="lede">${kind === "models" ? "Every model in the results tables. Open one to see each ranking it appears in and its result on every metric." : "Every paper behind a published result. Open one to see the rankings its models reach on every metric."}</p>
    ${benchTabs(kind, idx, tables.length)}
    ${gel({ id: "lgel", active: "", counts, unit: label, search: { id: "lq", placeholder: kind === "models" ? "Filter models" : "Filter papers by title or model", value: preset } })}
    <div class="controls bench-filters">
      <div class="control"><label for="lsort">Sort</label><select class="input" id="lsort">
        <option value="first">Most first places</option><option value="tables">Most tables</option><option value="name">Name</option>${kind === "papers" ? '<option value="year">Newest</option>' : ""}
      </select></div>
    </div>
    <p class="count" id="lcount"></p>
    <div class="table-wrap"><table class="bench-index">
      <thead><tr><th>${kind === "models" ? "Model" : "Paper"}</th>${kind === "papers" ? "<th>Year</th><th>Models</th>" : "<th>Papers</th>"}<th>Tables</th><th>First places</th><th>Best rank</th><th>Fields</th></tr></thead>
      <tbody id="lrows"></tbody>
    </table></div>
    <div class="more-row"><button class="btn" type="button" id="lmore" hidden>Show more ${label}</button></div>
  </section></div>`;
  let active = "", shown = 50;
  const q = document.getElementById("lq");
  const href = kind === "models" ? modelHref : paperHref;
  const draw = () => {
    const term = q.value.trim().toLowerCase();
    const sort = document.getElementById("lsort").value;
    const list = items.filter((it) => (!active || it.fields.includes(active)) &&
      (!term || `${it.name} ${it.list.map((e) => `${e.model} ${e.paper}`).join(" ")}`.toLowerCase().includes(term)));
    // when searching, the exact name first, then names that start with the term
    const fit = (it) => (!term ? 0 : it.name.toLowerCase() === term ? 0 : it.name.toLowerCase().startsWith(term) ? 1 : it.name.toLowerCase().includes(term) ? 2 : 3);
    list.sort((x, y) => fit(x) - fit(y) || (sort === "name" ? x.name.localeCompare(y.name) : sort === "tables" ? y.tables - x.tables || y.first - x.first
      : sort === "year" ? (y.year || "0").localeCompare(x.year || "0") || y.first - x.first : y.first - x.first || y.tables - x.tables || x.name.localeCompare(y.name)));
    document.getElementById("lcount").textContent = `${list.length} of ${items.length} ${label}`;
    document.getElementById("lrows").innerHTML = list.slice(0, shown).map((it) => `<tr>
      <td><a href="${href(it.name)}"><b>${esc(it.name.length > 120 ? it.name.slice(0, 120) + "…" : it.name)}</b></a></td>
      ${kind === "papers" ? `<td class="num">${esc(it.year || "—")}</td><td class="num">${it.models}</td>` : `<td class="num">${new Set(it.list.map((e) => e.paper).filter(Boolean)).size}</td>`}
      <td class="num">${it.tables}</td><td class="num">${it.first || "—"}</td><td class="num">${it.best ?? "—"}</td>
      <td>${it.fields.map((f) => `<span class="tag field" style="--dot:${baseVar(fieldOf(f))}">${esc(fieldOf(f).label)}</span>`).join(" ")}</td></tr>`).join("")
      || `<tr><td colspan="7" class="note">Nothing matches this filter.</td></tr>`;
    document.getElementById("lmore").hidden = list.length <= shown;
  };
  q.addEventListener("input", () => { shown = 50; draw(); });
  document.getElementById("lsort").addEventListener("change", () => { shown = 50; draw(); });
  document.getElementById("lmore").addEventListener("click", () => { shown += 50; draw(); });
  document.getElementById("lgel").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-field]");
    if (!btn) return;
    active = btn.dataset.field;
    document.querySelectorAll("#lgel button").forEach((x) => x.setAttribute("aria-pressed", String(x === btn)));
    shown = 50;
    draw();
  });
  draw();
}

// One model or one paper: every ranking it appears in, and its result and
// rank on every metric of each table.
export function pageBenchProfile(kind, name) {
  const idx = benchIdx;
  const list = [...(kind === "model" ? idx.byModel : idx.byPaper).get(name)]
    .sort((x, y) => (x.rank ?? 1e9) / (x.total || 1) - (y.rank ?? 1e9) / (y.total || 1) || x.task.localeCompare(y.task));
  const s = summarize(list);
  const papers = [...new Map(list.filter((e) => e.paper).map((e) => [e.paper, e])).values()];
  const models = [...new Set(list.map((e) => e.model))];
  const links = list.find((e) => safe(e.url));
  const codes = [...new Set(list.map((e) => e.code).filter((c) => safe(c)))];
  const metricCell = (e) => `<ul class="metric-list">${e.metrics.map((m) => `<li${m.name === e.metric ? ' class="main"' : ""}>
      <span>${esc(m.name)}</span> <b class="mono">${esc(m.value)}</b>
      <span class="hint">${m.rank != null ? `${m.rank} of ${m.of}` : "not ranked"}${m.rank === 1 ? " (best)" : ""}</span></li>`).join("")}</ul>`;
  view.innerHTML = `<div class="page"><section class="section">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#benchmarks">Benchmarks</a><span aria-hidden="true">/</span><a href="#benchmarks/${kind}s">${kind === "model" ? "Models" : "Papers"}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(name.length > 60 ? name.slice(0, 60) + "…" : name)}</span></nav>
    <h1 class="${kind === "paper" ? "paper-title" : ""}">${esc(name)}</h1>
    <p class="lede">In ${s.tables} ${s.tables === 1 ? "ranking" : "rankings"}${s.first ? `, first in ${s.first}` : ""}${s.best && s.best > 1 ? `, best place ${s.best}` : ""}.</p>
    <div class="profile-facts">
      ${kind === "model"
        ? `<div><b>Reported in</b>${papers.map((e) => `<a href="${paperHref(e.paper)}">${esc(e.paper)}</a>`).join("") || '<span class="muted">No paper listed</span>'}</div>`
        : `<div><b>Models</b>${models.map((m) => `<a href="${modelHref(m)}">${esc(m)}</a>`).join("")}</div>
           <div><b>Paper</b>${links ? `<a href="${esc(links.url)}" target="_blank" rel="noopener">Read the paper</a>` : '<span class="muted">No link</span>'}${s.year ? `<span class="hint">Published ${esc(s.year)}</span>` : ""}</div>`}
      ${codes.length ? `<div><b>Code</b>${codes.map((c) => `<a href="${esc(c)}" target="_blank" rel="noopener">${esc(c.replace(/^https?:\/\/(www\.)?/, ""))}</a>`).join("")}</div>` : ""}
      <div><b>Fields</b>${s.fields.map((f) => `<a href="#benchmarks/${esc(f)}">${esc(fieldOf(f).label)}</a>`).join("")}</div>
    </div>
    <div class="controls bench-filters"><div class="control"><label for="pq">Filter</label><input class="input" id="pq" type="search" placeholder="Task, dataset or metric"></div></div>
    <p class="count" id="pcount"></p>
    <div class="table-wrap"><table class="bench-index profile">
      <thead><tr><th>Ranking</th><th>Dataset</th>${kind === "paper" ? "<th>Model</th>" : "<th>Paper</th>"}<th>Place</th><th>Result on every metric</th></tr></thead>
      <tbody id="prows"></tbody>
    </table></div>
    <p class="note">Place is the rank under the approved ranking of each table. Each metric shows the value as published and its rank among the results that report that metric.</p>
  </section></div>`;
  const draw = () => {
    const term = document.getElementById("pq").value.trim().toLowerCase();
    const rows = list.filter((e) => !term || `${e.task} ${e.dataset} ${e.metrics.map((m) => m.name).join(" ")}`.toLowerCase().includes(term));
    document.getElementById("pcount").textContent = `${rows.length} of ${list.length} results`;
    document.getElementById("prows").innerHTML = rows.map((e) => `<tr class="${e.out ? "out" : ""}">
      <td><a href="${entryHref(e)}"><b>${esc(e.task)}</b></a><br><span class="hint">ranked by ${esc(e.metric)}</span></td>
      <td>${e.kind === "table" ? `<a href="${datasetHref(e.dataset)}">${esc(e.dataset)}</a>` : esc(e.dataset)}</td>
      <td>${kind === "paper" ? `<a href="${modelHref(e.model)}">${esc(e.model)}</a>` : e.paper ? `<a href="${paperHref(e.paper)}">${esc(e.paper.length > 70 ? e.paper.slice(0, 70) + "…" : e.paper)}</a>` : "—"}${e.extra ? ' <span class="tag">extra data</span>' : ""}</td>
      <td class="num nowrap">${e.rank === 1 ? `<span class="tag leader">1st</span> of ${e.total}` : esc(placeText(e))}</td>
      <td>${metricCell(e)}</td></tr>`).join("") || `<tr><td colspan="5" class="note">Nothing matches this filter.</td></tr>`;
  };
  document.getElementById("pq").addEventListener("input", draw);
  draw();
}

export function pageTable(t) {
  const f = fieldOf(t.field);
  const base = approvedView(t);
  const v = { metric: base.metric, higher: base.higher, exclude: new Set(base.exclude) };
  const ds = t.dataset_id ? S.datasets.find((d) => d.id === t.dataset_id) : null;
  const shownMetrics = () => t.metrics.map((m) => m.name).filter((m) => m !== v.metric).slice(0, 6);
  view.innerHTML = `<div class="page"><section class="section">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#benchmarks">Benchmarks</a><span aria-hidden="true">/</span><a href="#benchmarks/${esc(t.field)}">${esc(f.label)}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(t.task)}</span></nav>
    <h1>${esc(t.task)}</h1>
    <p class="lede">On <a href="${datasetHref(t.dataset)}">${esc(t.dataset)}</a>. ${t.rows.length} published results.${ds ? ` About the data and how to download it: <a href="#datasets/${esc(ds.field)}/${encodeURIComponent(ds.name)}">${esc(ds.name)}</a>.` : ""}</p>
    ${t.path.length > 1 ? `<p class="hint">${esc(t.path.join(" / "))}</p>` : ""}
    <div class="controls">
      <div class="control"><label for="tm">Rank by</label><select class="input" id="tm">${t.metrics.filter((m) => m.parsed >= 2 || m.name === v.metric).map((m) => `<option ${m.name === v.metric ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></div>
      <div class="control"><label for="th">Order</label><select class="input" id="th"><option value="1">Higher is better</option><option value="0">Lower is better</option></select></div>
      <div class="control"><label for="tq">Model</label><input class="input" id="tq" type="search" placeholder="Filter models"></div>
      <div class="control"><label class="check"><input type="checkbox" id="tedit"> Choose rows to leave out</label></div>
    </div>
    <div class="bench-status" id="tstatus" aria-live="polite"></div>
    <div id="tout"></div>
    <section class="proposal suggest" id="suggest" aria-label="Suggest a change"></section>
    <p class="note">Results as published in the papers, from the ${esc(t.source_name)} (snapshot ${esc(t.snapshot)}, ${esc(t.license)}). Rows marked “extra data” were trained with additional data; “added” and “corrected” rows come from approved reader suggestions.${t.approved?.note ? ` Approved note: ${esc(t.approved.note)}` : ""}</p>
  </section></div>`;
  document.getElementById("th").value = v.higher ? "1" : "0";
  const repo = repoUrl();
  const differs = () => v.metric !== base.metric || v.higher !== base.higher || v.exclude.size !== base.exclude.size || [...v.exclude].some((m) => !base.exclude.has(m));
  const draw = () => {
    const q = document.getElementById("tq").value.trim().toLowerCase();
    const edit = document.getElementById("tedit").checked;
    const ranked = rankRows(t, v).filter((x) => !q || x.r.model.toLowerCase().includes(q));
    const vals = ranked.map((x) => x.s).filter((s) => s != null);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const bar = (s) => (s == null || hi === lo ? 45 : 8 + 82 * (v.higher ? (s - lo) / (hi - lo) : (hi - s) / (hi - lo)));
    const others = shownMetrics();
    document.getElementById("tout").innerHTML = `<div class="table-wrap"><table class="bench">
      <thead><tr>${edit ? "<th>Leave out</th>" : ""}<th>#</th><th>Model</th><th>${esc(v.metric)}</th>${others.map((m) => `<th>${esc(m)}</th>`).join("")}<th>Paper</th><th>Code</th></tr></thead>
      <tbody>${ranked.map((x) => `<tr class="${x.out ? "out" : ""}">
        ${edit ? `<td><input type="checkbox" data-out="${esc(x.r.model)}" ${x.out ? "checked" : ""} aria-label="Leave out ${esc(x.r.model)}"></td>` : ""}
        <td class="num">${x.out ? "out" : x.rank ?? "—"}</td>
        <td><a href="${modelHref(x.r.model)}"><b>${esc(x.r.model)}</b></a>${x.r.extra ? ' <span class="tag">extra data</span>' : ""}${x.r.added ? ' <span class="tag">added</span>' : ""}${x.r.fixed ? ` <a class="tag" href="${esc(x.r.fixed)}" target="_blank" rel="noopener" title="Source of the corrected values">corrected</a>` : ""}</td>
        <td class="num">${x.s == null ? `<span class="muted">${esc(x.r.values[v.metric] || "—")}</span>` : `<span class="bar"><i style="width:${bar(x.s).toFixed(0)}px"></i>${esc(x.r.values[v.metric])}</span>`}</td>
        ${others.map((m) => `<td class="num">${esc(x.r.values[m] ?? "—")}</td>`).join("")}
        <td>${paperName(x.r.paper) ? `<a href="${paperHref(paperName(x.r.paper))}" title="${esc(x.r.paper)}">${esc(x.r.paper.slice(0, 60))}${x.r.paper.length > 60 ? "…" : ""}</a>` : "—"}${x.r.date ? ` <span class="hint">${esc(x.r.date.slice(0, 4))}</span>` : ""}</td>
        <td>${safe(x.r.code) ? `<a href="${esc(x.r.code)}" target="_blank" rel="noopener">Code</a>` : ""}</td></tr>`).join("")}</tbody>
    </table></div>`;
    const a = t.approved;
    document.getElementById("tstatus").innerHTML = differs()
      ? `<p><b>Your view differs from the approved ranking</b> (${esc(base.metric)}, ${base.higher ? "higher" : "lower"} is better${base.exclude.size ? `, ${base.exclude.size} left out` : ""}).</p>
         <div class="export-actions"><button class="btn solid" type="button" id="tpropose">Propose this ranking</button><button class="btn" type="button" id="treset">Back to the approved ranking</button></div>`
      : `<p>${a?.approved ? `Last change approved in ${esc([].concat(a.approved).at(-1))}.` : "Ranked by the table’s main metric, as published."} Change the metric, the order or the rows to propose a different ranking.</p>`;
    document.getElementById("tpropose")?.addEventListener("click", () => suggest.open("ranking"));
    document.getElementById("treset")?.addEventListener("click", () => {
      v.metric = base.metric; v.higher = base.higher; v.exclude = new Set(base.exclude);
      document.getElementById("tm").value = v.metric; document.getElementById("th").value = v.higher ? "1" : "0";
      draw();
    });
    suggest?.refresh();
  };
  let suggest = null;
  document.getElementById("tm").addEventListener("change", (e) => {
    v.metric = e.target.value;
    v.higher = t.metrics.find((m) => m.name === v.metric)?.higher ?? true;
    document.getElementById("th").value = v.higher ? "1" : "0";
    draw();
  });
  document.getElementById("th").addEventListener("change", (e) => { v.higher = e.target.value === "1"; draw(); });
  document.getElementById("tq").addEventListener("input", draw);
  document.getElementById("tedit").addEventListener("change", draw);
  document.getElementById("tout").addEventListener("change", (e) => {
    const c = e.target.closest("[data-out]");
    if (!c) return;
    c.checked ? v.exclude.add(c.dataset.out) : v.exclude.delete(c.dataset.out);
    draw();
  });
  suggest = mountSuggest(document.getElementById("suggest"), { t, view: v, base, repo, esc });
  draw();
}

export function pageBoard(boards, id) {
  const b = boards.find((x) => x.id === id);
  const kinds = [...new Set(b.rows.map((r) => r.kind).filter(Boolean))].sort();
  view.innerHTML = `<div class="page"><section class="section">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#benchmarks">Benchmarks</a><span aria-hidden="true">/</span><span aria-current="page">${esc(b.title)}</span></nav>
    <h1>${esc(b.title)}</h1>
    <p class="lede">Copied daily from the results table the benchmark maintainers publish, and shown exactly as published.</p>
    <div class="chips">${boards.map((x) => `<a class="chip" style="--dot:${baseVar(fieldOf(x.field))}" href="#benchmarks/${esc(x.id)}" aria-pressed="${x.id === b.id}">${esc(x.title.replace(/^[^:]+:\s*/, ""))}</a>`).join("")}</div>
    <div class="section-head"><h2>Ranking</h2><span class="hint">${b.rows.length} models, ${b.higher ? "higher is better" : "lower is better"}</span></div>
    <div class="controls">
      <div class="control"><label for="bq">Model</label><input class="input" id="bq" type="search" placeholder="Filter models"></div>
      <div class="control"><label for="bk">Family</label><select class="input" id="bk"><option value="">All families</option>${kinds.map((k) => `<option>${esc(k)}</option>`).join("")}</select></div>
    </div>
    <div id="bout"></div>
    <p class="note">Source: <a href="${esc(safe(b.source))}" target="_blank" rel="noopener">${esc(b.source)}</a> . CSV: <span class="mono">${esc(b.csv)}</span>. Fetched ${esc(b.fetched_at)}. Task: ${esc(taskLabel(b.field, b.task))}.</p>
  </section></div>`;
  const draw = () => {
    const q = document.getElementById("bq").value.trim().toLowerCase();
    const k = document.getElementById("bk").value;
    const rows = b.rows.filter((r) => (!k || r.kind === k) && (!q || r.model.toLowerCase().includes(q)));
    document.getElementById("bout").innerHTML = rows.length ? boardTable(b, rows) : `<p class="note">No model matches.</p>`;
  };
  ["bq", "bk"].forEach((x) => document.getElementById(x).addEventListener("input", draw));
  draw();
}
