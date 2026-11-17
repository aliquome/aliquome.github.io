// #latest[/field] and #papers[/field]
import { view, esc, num, safe, replaceHash } from "../core/dom.js";
import { S, need } from "../core/store.js";
import { fieldOf, baseVar, dsName, dsHref, uniqueByName, taskLabel } from "../core/catalog.js";
import { prettyDate, cut } from "../domain/format.js";
import { gel } from "../ui/gel.js";
import { paperCard } from "../ui/cards.js";

export const paperTabs = (on) => `<nav class="tabbar" aria-label="Paper views"><a href="#latest" ${on === "latest" ? "aria-current=\"page\"" : ""}>New papers <small>last 60 days</small></a><a href="#papers" ${on === "top" ? "aria-current=\"page\"" : ""}>Most cited <small>all time and recent</small></a></nav>`;

export async function pageLatest(fieldId, preset = "") {
  view.innerHTML = `<div class="page"><p class="loading">Loading new papers…</p></div>`;
  const data = await need("latest");
  if (!data?.papers?.length) return (view.innerHTML = `<div class="page"><p class="note">New papers have not been fetched yet. The daily job fills this page.</p></div>`);
  const all = data.papers;
  const counts = {};
  all.forEach((p) => p.fields?.forEach((f) => (counts[f] = (counts[f] || 0) + 1)));
  const journals = [...new Set(all.map((p) => p.journal).filter(Boolean))].sort();
  const st = { field: S.fields.some((f) => f.id === fieldId) ? fieldId : "", days: 0, shown: 30 };

  view.innerHTML = `<div class="page"><section class="section">
    
    <h1>Papers</h1>
    ${paperTabs("latest")}
    <p class="lede">Every paper published in the last ${data.days} days in the leading bioinformatics and computational biology journals, newest first. Each one is sorted into fields and tasks so you can follow only what matters to your work.</p>
    ${gel({ id: "lfields", active: st.field, counts, unit: "papers", total: all.length })}
    <div class="controls">
      <div class="control"><label for="lq">Search</label><input class="input" id="lq" type="search" placeholder="Title, method, keyword, author"></div>
      <div class="control"><label for="ltask">Task</label><select class="input" id="ltask"></select></div>
      <div class="control"><label for="ljour">Journal</label><select class="input" id="ljour"><option value="">All journals</option>${journals.map((j) => `<option>${esc(j)}</option>`).join("")}</select></div>
      <div class="control"><label for="lsort">Sort by</label><select class="input" id="lsort"><option value="date">Newest first</option><option value="cited">Most cited so far</option></select></div>
    </div>
    <div class="toolbar">
      <div class="seg" id="ldays"><button type="button" data-days="0" aria-pressed="true">${data.days} days</button><button type="button" data-days="30" aria-pressed="false">30 days</button><button type="button" data-days="14" aria-pressed="false">14 days</button><button type="button" data-days="7" aria-pressed="false">7 days</button></div>
      <label class="check"><input type="checkbox" id="labs"> Only papers with an open abstract</label>
    </div>
    <p class="count" id="lcount"></p>
    <div id="lout"></div>
    <div class="more-row"><button class="btn" type="button" id="lmore" hidden>Show more papers</button></div>
    <details class="note"><summary>Which journals are included</summary><p>${data.journals.map(esc).join(", ")}.</p><p>${esc(data.rule)}</p></details>
  </section></div>`;

  const $ = (id) => document.getElementById(id);
  const fillTasks = () => {
    const f = st.field ? [fieldOf(st.field)] : S.fields;
    const options = f.flatMap((x) => (x.tasks || []).map((t) => [`${x.id}:${t.id}`, st.field ? t.label : `${x.label}: ${t.label}`]))
      .filter(([id]) => all.some((p) => p.tasks.includes(id)));
    $("ltask").innerHTML = `<option value="">All tasks</option>` + options.map(([id, l]) => `<option value="${esc(id)}">${esc(l)}</option>`).join("");
  };
  const filtered = () => {
    const q = $("lq").value.trim().toLowerCase(), task = $("ltask").value, jour = $("ljour").value;
    const cut = st.days ? Date.now() - st.days * 864e5 : 0;
    const out = all.filter((p) =>
      (!st.field || p.fields?.includes(st.field)) && (!task || p.tasks.includes(task)) && (!jour || p.journal === jour) &&
      (!cut || Date.parse(p.date) >= cut) && (!$("labs").checked || p.abstract) &&
      (!q || p.title.toLowerCase().includes(q) || p.authors.toLowerCase().includes(q) || p.method.toLowerCase().includes(q) || p.keywords.some((k) => k.toLowerCase().includes(q))));
    if ($("lsort").value === "cited") out.sort((a, b) => b.cited - a.cited);
    else out.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return out;
  };
  const draw = (reset = true) => {
    if (reset) st.shown = 30;
    const list = filtered();
    $("lcount").textContent = `${num(list.length)} of ${num(all.length)} papers`;
    const page = list.slice(0, st.shown);
    let html = "", day = "";
    for (const p of page) {
      if ($("lsort").value === "date" && p.date !== day) {
        day = p.date;
        html += `<h3 class="day">${esc(prettyDate(day))}</h3>`;
      }
      html += paperCard(p, "");
    }
    $("lout").innerHTML = page.length ? `<div class="paper-list">${html}</div>` : `<p class="note">No paper matches these filters.</p>`;
    $("lmore").hidden = list.length <= st.shown;
  };
  $("lfields").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-field]");
    if (!b) return;
    st.field = b.dataset.field;
    replaceHash(st.field ? `#latest/${st.field}` : "#latest");
    $("lfields").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    fillTasks();
    draw();
  });
  $("ldays").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    st.days = Number(b.dataset.days);
    $("ldays").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    draw();
  });
  ["lq", "ltask", "ljour", "lsort", "labs"].forEach((id) => $(id).addEventListener("input", () => draw()));
  $("lmore").addEventListener("click", () => { st.shown += 30; draw(false); });
  if (preset) $("lq").value = preset;
  fillTasks();
  draw();
}

export async function pagePapers(fieldId) {
  view.innerHTML = `<div class="page"><p class="loading">Loading papers…</p></div>`;
  const papers = await need("papers");
  if (!papers?.fields?.length) return (view.innerHTML = `<div class="page"><p class="note">Papers have not been fetched yet. The daily job fills this page.</p></div>`);
  const current = papers.fields.find((x) => x.id === fieldId) || papers.fields[0];
  const f = fieldOf(current.id);
  const list = current.papers;
  const taskCount = {}, dsCount = {};
  list.forEach((p) => { p.tasks.forEach((t) => (taskCount[t] = (taskCount[t] || 0) + 1)); p.datasets.forEach((d) => (dsCount[d] = (dsCount[d] || 0) + 1)); });
  const years = [...new Set(list.map((p) => p.year).filter(Boolean))].sort();
  const journals = [...new Set(list.map((p) => p.journal).filter(Boolean))].sort();

  view.innerHTML = `<div class="page"><section class="section">
    <h1>Papers</h1>
    ${paperTabs("top")}
    <p class="lede">Open-access papers ranked by citations, refreshed daily from Europe PMC. Filter by task, dataset, year and venue, then switch to the comparison table to set methods side by side.</p>
    ${gel({ id: "pfields", active: current.id, counts: Object.fromEntries(papers.fields.map((x) => [x.id, x.papers.length])), unit: "papers", link: (id) => `#papers/${id}` })}
    <div class="chips" id="tasks"><button class="chip plain" type="button" data-task="" aria-pressed="true">All tasks</button>${(f.tasks || [])
      .filter((t) => taskCount[t.id])
      .map((t) => `<button class="chip" type="button" style="--dot:${baseVar(f)}" data-task="${esc(t.id)}" aria-pressed="false">${esc(t.label)} <span class="n">${taskCount[t.id]}</span></button>`)
      .join("")}</div>
    <div class="controls">
      <div class="control"><label for="pq">Search</label><input class="input" id="pq" type="search" placeholder="Title, method, keyword"></div>
      <div class="control"><label for="pds">Dataset or database</label><select class="input" id="pds"><option value="">Any</option>${Object.entries(dsCount)
        .sort((a, b) => b[1] - a[1]).map(([k, n]) => `<option value="${esc(k)}">${esc(dsName(k))} (${n})</option>`).join("")}</select></div>
      <div class="control"><label for="pfrom">From year</label><select class="input" id="pfrom"><option value="">Any</option>${years.map((y) => `<option>${y}</option>`).join("")}</select></div>
      <div class="control"><label for="pjour">Venue</label><select class="input" id="pjour"><option value="">Any</option>${journals.map((j) => `<option>${esc(j)}</option>`).join("")}</select></div>
      <div class="control"><label for="pcit">Min. citations</label><input class="input" id="pcit" type="number" min="0" step="10" placeholder="0"></div>
      <div class="control"><label for="psort">Sort by</label><select class="input" id="psort"><option value="cited">Most cited</option><option value="year">Newest</option><option value="title">Title</option></select></div>
    </div>
    <div class="toolbar">
      <div class="seg" id="plist"><button type="button" data-list="" aria-pressed="true">All</button><button type="button" data-list="classic" aria-pressed="false">Most cited ever</button><button type="button" data-list="recent" aria-pressed="false">Last 24 months</button></div>
      <div class="seg" id="pview"><button type="button" data-view="list" aria-pressed="true">Abstracts</button><button type="button" data-view="table" aria-pressed="false">Compare methods</button></div>
    </div>
    <p class="count" id="pcount"></p>
    <div id="pout"></div>
    <p class="note">Tasks are assigned from keyword patterns and datasets are the databases and datasets named in each title, abstract or keyword list, so check the paper before relying on a tag. Query: <span class="mono">${esc(current.query)}</span>. Fetched ${esc(papers.generated_at)}.</p>
  </section></div>`;

  const st = { task: "", list: "", view: "list", sort: "cited", dir: -1 };
  const $ = (id) => document.getElementById(id);
  const draw = () => {
    const q = $("pq").value.trim().toLowerCase();
    const ds = $("pds").value, from = $("pfrom").value, jour = $("pjour").value, min = Number($("pcit").value || 0);
    let out = list.filter((p) =>
      (!st.task || p.tasks.includes(st.task)) && (!st.list || p.lists.includes(st.list)) && (!ds || p.datasets.includes(ds)) &&
      (!from || p.year >= from) && (!jour || p.journal === jour) && p.cited >= min &&
      (!q || p.title.toLowerCase().includes(q) || p.method.toLowerCase().includes(q) || p.keywords.some((k) => k.toLowerCase().includes(q))));
    const key = $("psort").value;
    out.sort((a, b) => key === "year" ? (b.date || b.year).localeCompare(a.date || a.year) : key === "title" ? a.title.localeCompare(b.title) : b.cited - a.cited);
    $("pcount").textContent = `${out.length} of ${list.length} papers`;
    if (!out.length) { $("pout").innerHTML = `<p class="note">No paper matches these filters.</p>`; return; }
    $("pout").innerHTML = st.view === "list"
      ? `<div class="paper-list">${out.map((p) => paperCard(p, current.id)).join("")}</div>`
      : `<div class="table-wrap"><table class="compare"><thead><tr><th>Method</th><th>Paper</th><th>Year</th><th>Venue</th><th>Cited</th><th>Tasks</th><th>Datasets named</th><th>Text</th></tr></thead><tbody>${out
          .map((p) => `<tr><td><b>${esc(p.method || "—")}</b></td><td><a href="${esc(safe(p.url))}" target="_blank" rel="noopener">${esc(p.title)}</a></td>
            <td class="num">${esc(p.year)}</td><td>${esc(p.journal)}</td><td class="num">${num(p.cited)}</td>
            <td><div class="tags">${p.tasks.map((t) => `<span class="tag task">${esc(taskLabel(current.id, t))}</span>`).join("")}</div></td>
            <td><div class="tags">${uniqueByName(p.datasets).map((d) => `<a class="tag ds" href="${esc(dsHref(d))}">${esc(dsName(d))}</a>`).join("") || `<span class="muted">—</span>`}</div></td>
            <td class="nowrap">${safe(p.pdf) ? `<a href="${esc(p.pdf)}" target="_blank" rel="noopener">PDF</a>` : "—"}</td></tr>`)
          .join("")}</tbody></table></div>`;
  };
  $("tasks").addEventListener("click", (e) => {
    const b = e.target.closest("[data-task]"); if (!b) return;
    st.task = b.dataset.task;
    $("tasks").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    draw();
  });
  for (const [id, key] of [["plist", "list"], ["pview", "view"]]) {
    $(id).addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      st[key] = b.dataset[key];
      $(id).querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      draw();
    });
  }
  ["pq", "pds", "pfrom", "pjour", "pcit", "psort"].forEach((id) => $(id).addEventListener("input", draw));
  draw();
}
