// Bioinformatics Data Atlas: reads the JSON files in data/ and draws the pages.
// Routes live in the URL hash: #home, #sources[/field], #source/<id>,
// #datasets[/field[/name]], #papers[/field], #benchmarks[/board], #status, #about.
import { trace, requestThumb, mountLive, clearThumbs } from "./glyph.js";
import { mountCells } from "./cells.js";

const view = document.getElementById("view");
const S = { fields: [], sources: [], datasets: [], papers: null, boards: null, status: null, build: null };
let stopLive = () => {};

// ---------- helpers ----------
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (n) => Number(n || 0).toLocaleString("en-US");
const safe = (u) => (/^(https?|ftp):\/\//i.test(u || "") ? u : "");
const fieldOf = (id) => S.fields.find((f) => f.id === id) || { id, label: id, base: "A", shape: "network", tasks: [] };
const baseVar = (f) => `var(--base-${(f.base || "A").toLowerCase()})`;
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const STATE_LABEL = { ok: "Reachable", blocked: "Up, refuses automated checks", down: "Not reachable" };

function toast(text) {
  const t = document.getElementById("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 1600);
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied");
  } catch (e) {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    try { document.execCommand("copy"); toast("Copied"); } catch (err) { toast("Select the text and copy it"); }
    area.remove();
  }
}

function licenceClass(text) {
  const t = (text || "").toLowerCase();
  if (/controlled/.test(t)) return "closed";
  if (/licen[cs]e required|commercial|paid|academic use only|non-commercial|-nc|by-nc|registration/.test(t)) return "limited";
  if (/open|public domain|cc0|cc by|mit/.test(t)) return "open";
  return "";
}

const statusOf = (id) => S.status?.sources?.[id] || null;
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

// 3D stills are drawn only when they scroll near the viewport, one per idle slot.
const lazy = new IntersectionObserver(
  (entries) => entries.forEach((e) => { if (e.isIntersecting) { lazy.unobserve(e.target); requestThumb(e.target); } }),
  { rootMargin: "400px" }
);
const art = (name, field) =>
  `<img src="${BLANK}" alt="" data-name="${esc(name)}" data-shape="${esc(fieldOf(field).shape)}">`;
const armArt = () => view.querySelectorAll("img[data-name]:not(.ready)").forEach((img) => lazy.observe(img));

// ---------- download code ----------
const fileName = (url) => {
  const last = url.split("?")[0].replace(/\/+$/, "").split("/").pop() || "download";
  return last.includes("{") ? "download" : last;
};

function inferType(url) {
  if (/huggingface\.co\/datasets\//.test(url)) return "hf";
  if (/^https?:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(url)) return "git";
  if (/\.(gz|zip|tar|tgz|bz2|xz|zst|h5|h5ad|csv|tsv|json|pkl|parquet|fasta|fa|faa|pdb|cif|txt|sdf|smi|npz|pt|obo|owl|gaf|vcf|bed|gtf|gff3?)(\?|$)/i.test(url)) return "file";
  return "portal";
}

function snippets(url, type) {
  if (!url) return [];
  const f = fileName(url);
  const q = JSON.stringify(url);
  if (url.startsWith("s3://")) {
    const key = url.replace(/^s3:\/\/[^/]+\/?/, "");
    const b = url.replace(/^s3:\/\/([^/]+).*/, "$1");
    const isFile = type === "file";
    return [
      ["AWS CLI", isFile ? `aws s3 cp --no-sign-request ${q} .` : `aws s3 sync --no-sign-request ${q} ./${fileName(url)}`],
      ["Python", isFile
        ? `import boto3\nfrom botocore import UNSIGNED\nfrom botocore.config import Config\n\ns3 = boto3.client("s3", config=Config(signature_version=UNSIGNED))\ns3.download_file(${JSON.stringify(b)}, ${JSON.stringify(key)}, ${JSON.stringify(f)})`
        : `import boto3\nfrom botocore import UNSIGNED\nfrom botocore.config import Config\n\ns3 = boto3.client("s3", config=Config(signature_version=UNSIGNED))\npages = s3.get_paginator("list_objects_v2").paginate(Bucket=${JSON.stringify(b)}, Prefix=${JSON.stringify(key)})\nfor page in pages:\n    for obj in page.get("Contents", []):\n        print(obj["Key"], obj["Size"])`],
    ];
  }
  if (url.startsWith("gs://")) {
    return [
      ["gcloud", `gcloud storage cp --recursive ${q} .`],
      ["Python", `from google.cloud import storage\n\nclient = storage.Client.create_anonymous_client()\nbucket, _, prefix = ${q}[5:].partition("/")\nfor blob in client.list_blobs(bucket, prefix=prefix):\n    print(blob.name, blob.size)`],
    ];
  }
  if (type === "hf") {
    const repo = url.replace(/^https?:\/\/huggingface\.co\/datasets\//, "").split("/").slice(0, 2).join("/");
    return [
      ["hf CLI", `hf download ${repo} --repo-type dataset --local-dir ${repo.split("/")[1]}`],
      ["Python", `from huggingface_hub import snapshot_download\n\npath = snapshot_download(repo_id=${JSON.stringify(repo)}, repo_type="dataset")`],
      ["datasets", `from datasets import load_dataset\n\nds = load_dataset(${JSON.stringify(repo)})`],
    ];
  }
  if (type === "git") return [["git", `git clone --depth 1 ${url}`]];
  if (type === "api") {
    return [
      ["curl", `curl -s ${q}`],
      ["Python", `import requests\n\ndata = requests.get(${q}, timeout=60).json()`],
      ["R", `data <- jsonlite::fromJSON(${q})`],
    ];
  }
  if (type === "directory") {
    return [
      ["wget", `wget -r -np -nd -c -R "index.html*" ${q}`],
      ["curl", `# list the folder, then fetch the files you need\ncurl -s ${q}`],
      ["Python", `import re, urllib.request\n\nbase = ${q}\nhtml = urllib.request.urlopen(base).read().decode()\nfiles = sorted(set(re.findall(r'href="([^"?/][^"]*)"', html)))\nprint(files)`],
    ];
  }
  if (type === "file" || type === "pattern") {
    return [
      ["curl", `curl -L -C - -O ${q}`],
      ["wget", `wget -c ${q}`],
      ["Python", `import urllib.request\n\nurllib.request.urlretrieve(${q}, ${JSON.stringify(f)})`],
      ["pooch", `# downloads once, caches, and records the SHA-256 for reproducibility\nimport pooch\n\npath = pooch.retrieve(url=${q}, known_hash=None, progressbar=True)\nprint(pooch.file_hash(path))`],
      ["R", `download.file(${q}, destfile = ${JSON.stringify(f)}, mode = "wb")`],
    ];
  }
  return [];
}

let panelSeq = 0;
function codePanel(url, type, title) {
  const tabs = snippets(url, type);
  const id = `p${++panelSeq}`;
  const open = safe(url) ? `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Open</a>` : "";
  const isPattern = type === "pattern" || url.includes("{");
  return `<div class="get" data-panel="${id}">
    <div class="get-head"><span class="eyebrow">${esc(title || "Direct link")}</span><span class="hint">${
      isPattern ? "Replace the {placeholder} with the release you need." : type === "portal" ? "This source is a web portal; open it to choose files." : "Use this link in your code to fetch exactly this release."
    }</span></div>
    <div class="url-line"><code>${esc(url)}</code><button class="btn solid" type="button" data-copy="${esc(url)}">Copy link</button>${open}</div>
    ${
      tabs.length
        ? `<div class="tabs" role="tablist">${tabs
            .map((t, i) => `<button type="button" role="tab" aria-selected="${i === 0}" data-tab="${id}-${i}">${esc(t[0])}</button>`)
            .join("")}</div>
           ${tabs
             .map(
               (t, i) => `<div class="code" data-pane="${id}-${i}" ${i ? "hidden" : ""}><pre>${esc(t[1])}</pre><button class="btn small" type="button" data-copy-pre>Copy</button></div>`
             )
             .join("")}`
        : ""
    }
  </div>`;
}

// One listener for every copy button, tab and code toggle on every page.
document.addEventListener("click", (e) => {
  const c = e.target.closest("[data-copy]");
  if (c) return copy(c.dataset.copy);
  const pre = e.target.closest("[data-copy-pre]");
  if (pre) return copy(pre.parentElement.querySelector("pre").textContent);
  const tab = e.target.closest("[data-tab]");
  if (tab) {
    const panel = tab.closest(".get");
    panel.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b === tab)));
    panel.querySelectorAll("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== tab.dataset.tab));
    return;
  }
  const toggle = e.target.closest("[data-code]");
  if (toggle) {
    const host = toggle.closest(".row-main");
    const existing = host.querySelector(".get");
    if (existing && existing.dataset.for === toggle.dataset.code) { existing.remove(); return; }
    existing?.remove();
    host.insertAdjacentHTML("beforeend", codePanel(toggle.dataset.code, toggle.dataset.type, toggle.dataset.label));
    host.lastElementChild.dataset.for = toggle.dataset.code;
  }
});

// ---------- shared pieces ----------
// The field filter is drawn as an electrophoresis gel: one lane per field,
// a marker ladder for "All", and a glowing band whose thickness and
// migration follow how many entries the field holds.
//   gel({ id, active, counts, unit, search, link })
//   link: optional (fieldId) => href, turns lanes into links instead of buttons
function gel({ id, active = "", counts, unit = "entries", search, link, total: given }) {
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
      <p class="gel-readout"><span class="eyebrow">Field</span> <b data-readout>${esc(current ? current.label : "All fields")}</b> <span class="muted" data-readout-n>${num(current ? counts[current.id] : total)} ${esc(unit)}</span></p>
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

function replaceHash(hash) {
  try { window.history.replaceState(null, "", hash); } catch (e) { /* sandboxed */ }
}

function sourceCard(s) {
  return `<a class="card" href="#source/${esc(s.id)}">
    <span class="card-art">${art(s.name, s.field)}</span>
    <span class="card-body">
      <h3>${esc(s.name)}</h3>
      ${trace(s.name)}
      <p>${esc(s.summary)}</p>
      <span class="card-meta"><span>${dot(s.id)} ${esc(s.latest) || "—"}</span><span>${s.versions.length} releases</span></span>
    </span>
  </a>`;
}

const dsName = (key) => {
  const [kind, id] = key.split(":");
  if (kind === "db") return S.sources.find((s) => s.id === id)?.name || id;
  return S.datasets.find((d) => d.id === id)?.name || id;
};
const dsHref = (key) => {
  const [kind, id] = key.split(":");
  if (kind === "db") return `#source/${id}`;
  const d = S.datasets.find((x) => x.id === id);
  return d ? `#datasets/${d.field}/${encodeURIComponent(d.name)}` : "#datasets";
};
// One tag per visible name: a database and a dataset can share a name.
const uniqueByName = (keys) => {
  const seen = new Set();
  return keys.filter((k) => { const n = dsName(k).toLowerCase(); if (seen.has(n)) return false; seen.add(n); return true; });
};
// Task ids are "task" inside a field list, or "field:task" in the latest feed.
const taskLabel = (field, id) => {
  const [f, t] = id.includes(":") ? id.split(":") : [field, id];
  return fieldOf(f).tasks?.find((x) => x.id === t)?.label || t;
};
const prettyDate = (d) => {
  const t = Date.parse(d);
  return Number.isNaN(t) ? d : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

function paperCard(p, field, open = false) {
  const authors = p.authors.length > 170 ? p.authors.slice(0, 170).replace(/,[^,]*$/, "") + ", et al." : p.authors;
  const fieldTags = (p.fields || []).map((id) => {
    const f = fieldOf(id);
    return `<a class="tag field" style="--dot:${baseVar(f)}" href="#latest/${esc(id)}">${esc(f.label)}</a>`;
  }).join("");
  return `<article class="paper">
    <h3><a href="${esc(safe(p.url))}" target="_blank" rel="noopener">${esc(p.title)}</a></h3>
    <p class="who">${esc(authors)}</p>
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
    ${p.abstract
      ? `<p class="abstract ${open ? "" : "clamp"}" lang="en">${esc(p.abstract)}</p>
    <button class="more" type="button" data-more>${open ? "Show less" : "Read the full abstract"}</button>`
      : `<p class="hint">The abstract of this paper is not openly licensed. Read it on the publisher's page.</p>`}
    <div class="links">${safe(p.url) ? `<a class="btn small" href="${esc(p.url)}" target="_blank" rel="noopener">Article</a>` : ""}${
      safe(p.pdf) ? `<a class="btn small" href="${esc(p.pdf)}" target="_blank" rel="noopener">PDF</a>` : ""
    }${p.doi ? `<button class="btn small" type="button" data-copy="${esc(p.doi)}">Copy DOI</button>` : ""}</div>
  </article>`;
}
document.addEventListener("click", (e) => {
  const more = e.target.closest("[data-more]");
  if (!more) return;
  const abs = more.parentElement.querySelector(".abstract");
  const opened = abs.classList.toggle("clamp") === false;
  more.textContent = opened ? "Show less" : "Read the full abstract";
});

async function need(name) {
  if (S[name]) return S[name];
  const file = name === "boards" ? "leaderboards" : name;
  try { S[name] = await load(file); } catch (e) { S[name] = null; }
  return S[name];
}

// ---------- pages ----------
async function pageHome() {
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
      <p class="eyebrow">Databases · Datasets · Papers · Benchmarks</p>
      <h1>Find the exact release of the data your analysis needs.</h1>
      <p class="lede">Every release of ${S.sources.length} core bioinformatics databases with a direct link you can paste into code, ${num(
        S.datasets.length
      )} public datasets, open-access papers by field and task, and published model comparisons. Rebuilt and checked every day.</p>
      <label class="search" for="q">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 12l4.5 4.5" stroke="currentColor" stroke-width="1.6"/></svg>
        <input id="q" type="search" autocomplete="off" placeholder="Search Ensembl 116, gnomAD v4.1, ChEMBL, single-cell…" aria-label="Search databases, releases, datasets and papers">
        <span class="kbd" aria-hidden="true">/</span>
      </label>
      <div id="results" class="results" hidden></div>
      <div class="stats">
        <div class="stat"><b>${num(S.sources.length)}</b><span>databases</span></div>
        <div class="stat"><b>${num(versions)}</b><span>releases, ${num(linked)} linked</span></div>
        <div class="stat"><b>${num(S.datasets.length)}</b><span>datasets</span></div>
        <div class="stat"><b>${checked.length ? `${up}/${checked.length}` : "—"}</b><span>sources up today</span></div>
      </div>
    </div>
    <div class="stage">
      <canvas id="stage" aria-label="3D figure generated from the name ${esc(featured.name)}"></canvas>
      <div class="stage-tag">
        <span><span class="eyebrow">Database of the day</span><br><a href="#source/${esc(featured.id)}">${esc(featured.name)} →</a></span>
        <small>${esc(f.label)}<br>drag to rotate</small>
      </div>
    </div>
  </section>

  <section class="section actions">
    <a class="action" href="#sources" style="--dot:var(--base-a)"><b>Get a database release</b><span>Every version with a link and download code</span></a>
    <a class="action" href="#datasets" style="--dot:var(--base-c)"><b>Find a dataset</b><span>Benchmarks and training data for your task</span></a>
    <a class="action" href="#latest" style="--dot:var(--base-g)"><b>Read new papers</b><span>The last 60 days in the leading journals</span></a>
    <a class="action" href="#benchmarks" style="--dot:var(--base-t)"><b>Compare models</b><span>Published results tables, side by side</span></a>
  </section>

  <section class="section">
    <div class="section-head"><h2>Explore by field</h2><a href="#sources">All databases →</a></div>
    <div class="fields" id="field-tiles">${S.fields.map((x) => {
      const nDb = S.sources.filter((s) => s.field === x.id).length;
      const nDs = S.datasets.filter((d) => d.field === x.id).length;
      return `<div class="field-tile" style="--dot:${baseVar(x)}">
        <span class="field-art">${art(x.label, x.id)}</span>
        <div class="field-body"><h3>${esc(x.label)}</h3>
          <p class="field-links"><a href="#sources/${esc(x.id)}">${nDb} databases</a><a href="#datasets/${esc(x.id)}">${nDs} datasets</a><a href="#latest/${esc(x.id)}" data-latest-count="${esc(x.id)}">New papers</a></p></div>
      </div>`;
    }).join("")}</div>
  </section>

  <section class="section" id="home-latest"></section>

  <section class="section">
    <div class="section-head"><h2>Recently released</h2><a href="#status">Source status →</a></div>
    <div class="grid">${[...S.sources]
      .filter((s) => /^\d{4}-\d{2}/.test(s.latest_date))
      .sort((a, b) => b.latest_date.localeCompare(a.latest_date))
      .slice(0, 8)
      .map(sourceCard)
      .join("")}</div>
  </section>

  <section class="section" id="home-board"></section>
  <section class="section" id="home-papers"></section>
  </div>`;

  const stop3d = mountLive(document.getElementById("stage"), featured.name, f.shape);
  const stopCells = mountCells(document.getElementById("cells"));
  stopLive = () => { stop3d(); stopCells(); };
  wireSearch();
  armArt();

  const latest = await need("latest");
  const lslot = document.getElementById("home-latest");
  if (latest?.papers?.length && lslot) {
    const counts = {};
    latest.papers.forEach((p) => p.fields?.forEach((fid) => (counts[fid] = (counts[fid] || 0) + 1)));
    document.querySelectorAll("[data-latest-count]").forEach((a) => (a.textContent = `${counts[a.dataset.latestCount] || 0} new papers`));
    const fresh = latest.papers.filter((p) => p.abstract).slice(0, 4);
    lslot.innerHTML = `<div class="section-head"><h2>New in the journals</h2><a href="#latest">${num(latest.papers.length)} papers in the last ${latest.days} days →</a></div>
      <div class="paper-list">${fresh.map((p) => paperCard(p, "")).join("")}</div>`;
  }

  const boards = await need("boards");
  const b = boards?.boards?.[0];
  const slot = document.getElementById("home-board");
  if (b && slot) {
    slot.innerHTML = `<div class="section-head"><h2>Top models on ${esc(b.title.split(":")[0])}</h2><a href="#benchmarks/${esc(b.id)}">Full comparison →</a></div>
      ${boardTable(b, b.rows.slice(0, 5), false)}`;
  }
  const papers = await need("papers");
  const pslot = document.getElementById("home-papers");
  if (papers && pslot) {
    const recent = papers.fields
      .flatMap((x) => x.papers.filter((p) => p.lists.includes("recent")).slice(0, 1).map((p) => [x.id, p]))
      .sort((a, b2) => b2[1].cited - a[1].cited)
      .slice(0, 3);
    pslot.innerHTML = `<div class="section-head"><h2>Recent papers gaining citations</h2><a href="#papers">All papers →</a></div>
      <div class="paper-list">${recent.map(([fid, p]) => paperCard(p, fid)).join("")}</div>`;
  }
}

function wireSearch() {
  const q = document.getElementById("q");
  const box = document.getElementById("results");
  let timer = 0;
  q.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const term = q.value.trim().toLowerCase();
      if (term.length < 2) { box.hidden = true; return; }
      const hit = (t) => String(t || "").toLowerCase().includes(term);
      const papers = S.papers || (await need("papers"));
      const rows = [
        ...S.sources
          .filter((s) => hit(s.name) || hit(s.summary) || s.versions.some((v) => hit(v.version)))
          .slice(0, 6)
          .map((s) => [`#source/${s.id}`, s.name, `database · ${s.latest || ""}`]),
        ...S.datasets.filter((d) => hit(d.name) || hit(d.description)).slice(0, 6)
          .map((d) => [`#datasets/${d.field}/${encodeURIComponent(d.name)}`, d.name, "dataset"]),
        ...(papers?.fields || []).flatMap((x) => x.papers.map((p) => [x.id, p])).filter(([, p]) => hit(p.title) || hit(p.method))
          .slice(0, 5).map(([fid, p]) => [`#papers/${fid}`, p.title, `paper · ${p.year}`]),
      ];
      box.hidden = false;
      box.innerHTML = rows.length
        ? rows.map(([href, label, kind]) => `<a href="${esc(href)}"><span>${esc(label)}</span><span class="kind">${esc(kind)}</span></a>`).join("")
        : `<p class="muted" style="padding:8px 10px">Nothing matches “${esc(q.value)}”. Try a database name, a release or a field.</p>`;
    }, 120);
  });
}

function pageSources(field) {
  const counts = {};
  S.sources.forEach((s) => (counts[s.field] = (counts[s.field] || 0) + 1));
  view.innerHTML = `<div class="page"><section class="section">
    <h1>Databases</h1>
    <p class="lede">Open a database to see every release with a direct link and ready-to-run download code. Each figure and trace is generated from the database name.</p>
    ${gel({ id: "chips", active: field, counts, unit: "databases", search: { id: "filter", placeholder: "Filter by name or release" } })}
    <div class="grid" id="grid"></div>
  </section></div>`;
  let active = field || "";
  const grid = document.getElementById("grid");
  const filter = document.getElementById("filter");
  const draw = () => {
    const term = filter.value.trim().toLowerCase();
    const list = S.sources.filter((s) => (!active || s.field === active) &&
      (!term || s.name.toLowerCase().includes(term) || s.versions.some((v) => v.version.toLowerCase().includes(term))));
    grid.innerHTML = list.length ? list.map(sourceCard).join("") : `<p class="note">No database matches this filter.</p>`;
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

function pageSource(id) {
  const s = S.sources.find((x) => x.id === id);
  if (!s) return notFound("That database is not in the atlas.");
  const f = fieldOf(s.field);
  const st = statusOf(s.id);
  const link = S.status?.links?.[s.id];
  const rows = [...s.versions].reverse();
  const related = S.datasets.filter((d) => d.field === s.field).slice(0, 5);
  view.innerHTML = `<div class="page">
  <a class="back" href="#sources/${esc(s.field)}">← ${esc(f.label)}</a>
  <section class="detail">
    <div class="stage"><canvas id="stage" aria-label="3D figure generated from the name ${esc(s.name)}"></canvas>
      <div class="stage-tag"><span class="eyebrow">${esc(f.shape)}</span><small>drag to rotate</small></div></div>
    <div class="detail-info">
      <p class="eyebrow" style="color:${baseVar(f)}">${esc(f.label)}</p>
      <h1>${esc(s.name)}</h1>
      ${trace(s.name, 44)}
      <p class="lede">${esc(s.summary)}</p>
      <dl class="facts">
        <dt>Current release</dt><dd><b>${esc(s.latest) || "—"}</b> <span class="muted">${esc(s.latest_date)}</span></dd>
        <dt>Releases tracked</dt><dd>${s.versions.length}</dd>
        <dt>Licence</dt><dd><span class="badge ${licenceClass(s.license)}">${esc(s.license)}</span></dd>
        <dt>Website</dt><dd><a href="${esc(safe(s.homepage))}" target="_blank" rel="noopener">${esc(s.homepage)}</a></dd>
        <dt>Status today</dt><dd>${dot(s.id)} ${st ? `${esc(STATE_LABEL[st.state] || st.state)} <span class="muted mono">HTTP ${st.code || "—"} · ${st.ms} ms</span>` : `<span class="muted">Not checked yet</span>`}</dd>
        <dt>Download link</dt><dd>${link ? `${dot("")} ${link.state === "ok" ? "Answered today" : esc(STATE_LABEL[link.state] || link.state)} <span class="muted mono">HTTP ${link.code || "—"}</span>` : `<span class="muted">Not checked yet</span>`}</dd>
        <dt>Last 30 checks</dt><dd>${history(s.id)}</dd>
      </dl>
    </div>
  </section>

  ${s.latest_url ? `<section class="section">${codePanel(s.latest_url, s.latest_url_type, `Current release · ${s.latest}`)}</section>` : ""}

  <section class="section">
    <div class="section-head"><h2>All releases</h2><span class="hint">Newest first. ✓ confirmed against the source; ? from prior knowledge.</span></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Release</th><th>Date</th><th>Status</th><th>Direct link</th><th></th><th>Checked</th></tr></thead>
      <tbody>${rows
        .map((v, i) => {
          const usable = /^(https?|ftp|s3|gs):/.test(v.url);
          return `<tr>
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

  ${related.length ? `<section class="section"><div class="section-head"><h2>Datasets in ${esc(f.label.toLowerCase())}</h2><a href="#datasets/${esc(s.field)}">All →</a></div>
     <div class="rows">${related.map(datasetRow).join("")}</div></section>` : ""}
  <section class="section"><div class="chips"><a class="chip" style="--dot:${baseVar(f)}" href="#papers/${esc(s.field)}">Papers in ${esc(f.label)} →</a></div></section>
  </div>`;
  view.querySelectorAll("[data-rel]").forEach((b) =>
    b.addEventListener("click", () => {
      const i = Number(b.dataset.rel);
      const row = view.querySelector(`[data-relpanel="${i}"]`);
      if (!row.hidden) { row.hidden = true; return; }
      const v = rows[i];
      row.firstElementChild.innerHTML = codePanel(v.url, v.url_type || inferType(v.url), `${s.name} ${v.version}`);
      row.hidden = false;
    })
  );
  stopLive = mountLive(document.getElementById("stage"), s.name, f.shape);
  armArt();
}

function datasetRow(d) {
  const links = [...(safe(d.repo) ? [{ label: "Repository", url: d.repo }] : []), ...d.links.filter((l) => safe(l.url))];
  const facts = [d.versions && `Versions: ${d.versions}`, d.license && `Licence: ${d.license}`, d.paper_count && `Used by ${d.paper_count} papers`]
    .filter(Boolean).join(" · ");
  return `<article class="row">
    <span class="row-art">${art(d.name, d.field)}</span>
    <div class="row-main">
      <h3>${esc(d.name)}</h3>
      ${d.description ? `<p>${esc(d.description)}</p>` : ""}
      ${facts ? `<p class="hint">${esc(facts)}</p>` : ""}
      ${d.access ? `<p class="mono hint">${esc(d.access)}</p>` : ""}
      ${links.length ? `<div class="row-links">${links.slice(0, 8).map((l) => {
        const type = inferType(l.url);
        return `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>${
          type !== "portal" ? `<button type="button" data-code="${esc(l.url)}" data-type="${type}" data-label="${esc(d.name + " · " + l.label)}">code</button>` : ""}`;
      }).join("")}</div>` : ""}
    </div>
    <span class="stars">${d.stars != null ? `★ ${num(d.stars)}` : ""}</span>
  </article>`;
}

function pageDatasets(field, preset) {
  const counts = {};
  S.datasets.forEach((d) => (counts[d.field] = (counts[d.field] || 0) + 1));
  view.innerHTML = `<div class="page"><section class="section">
    <h1>Datasets and benchmarks</h1>
    <p class="lede">Public datasets from repositories, papers and challenges. Press “code” next to a link to get a download snippet for your language.</p>
    ${gel({ id: "chips", active: field, counts, unit: "datasets", search: { id: "filter", placeholder: "Filter by name or description", value: preset } })}
    <p class="count" id="count"></p>
    <div class="rows" id="rows"></div>
  </section></div>`;
  let active = field || "";
  const rows = document.getElementById("rows");
  const filter = document.getElementById("filter");
  const draw = () => {
    const term = filter.value.trim().toLowerCase();
    const list = S.datasets
      .filter((d) => (!active || d.field === active) && (!term || d.name.toLowerCase().includes(term) || d.description.toLowerCase().includes(term)))
      .sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1) || (b.paper_count ?? 0) - (a.paper_count ?? 0));
    document.getElementById("count").textContent = `${list.length} of ${S.datasets.length} datasets`;
    rows.innerHTML = list.length ? list.map(datasetRow).join("") : `<p class="note">No dataset matches this filter.</p>`;
    armArt();
  };
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

async function pageLatest(fieldId) {
  view.innerHTML = `<div class="page"><p class="loading">Loading new papers…</p></div>`;
  const data = await need("latest");
  if (!data?.papers?.length) return (view.innerHTML = `<div class="page"><p class="note">New papers have not been fetched yet. The daily job fills this page.</p></div>`);
  const all = data.papers;
  const counts = {};
  all.forEach((p) => p.fields?.forEach((f) => (counts[f] = (counts[f] || 0) + 1)));
  const journals = [...new Set(all.map((p) => p.journal).filter(Boolean))].sort();
  const st = { field: S.fields.some((f) => f.id === fieldId) ? fieldId : "", days: 0, shown: 30 };

  view.innerHTML = `<div class="page"><section class="section">
    <p class="eyebrow">Updated ${esc(prettyDate(data.generated_at))} · ${esc(prettyDate(data.since))} to ${esc(prettyDate(data.until))}</p>
    <h1>New papers</h1>
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
    <details class="note"><summary>Which journals are included</summary><p>${data.journals.map(esc).join(" · ")}</p><p>${esc(data.rule)}</p></details>
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
  fillTasks();
  draw();
}

async function pagePapers(fieldId) {
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

// "Sun, N., Zou, S. … (2024). Title" -> "Sun et al., 2024"
function shortCite(text) {
  const year = (text.match(/\((\d{4})\)/) || text.match(/\b(19|20)\d{2}\b/) || [""])[0].replace(/[()]/g, "");
  const first = text.trim().split(/[,.]/)[0].trim().split(/\s+/);
  const surname = /^[A-Z]\.?$/.test(first[0] || "") ? first[first.length - 1] : first.length > 1 && !/,/.test(text.split(" ")[0]) ? first[first.length - 1] : first[0];
  return surname ? `${surname} et al.${year ? ", " + year : ""}` : "paper";
}

function boardTable(b, rows, full = true) {
  const max = Math.max(...b.rows.map((r) => r.score));
  return `<div class="table-wrap"><table>
    <thead><tr><th>#</th><th>Model</th><th>Family</th><th>${esc(b.metric_label)}</th>${full ? b.columns.map((c) => `<th>${esc(c)}</th>`).join("") + "<th>Paper</th>" : ""}</tr></thead>
    <tbody>${rows.map((r) => `<tr><td class="num">${r.rank}</td><td><b>${esc(r.model)}</b></td><td class="muted">${esc(r.kind)}</td>
      <td class="num"><span class="bar"><i style="width:${Math.max(2, (r.score / max) * 90).toFixed(0)}px"></i>${r.score.toFixed(3)}</span></td>
      ${full ? r.values.map((v) => `<td class="num">${v == null ? "—" : v.toFixed(3)}</td>`).join("") +
        `<td class="nowrap">${safe(r.paper_url) ? `<a href="${esc(r.paper_url)}" target="_blank" rel="noopener" title="${esc(r.paper)}">${esc(shortCite(r.paper))}</a>` : "—"}</td>` : ""}</tr>`).join("")}</tbody>
  </table></div>`;
}

async function pageBenchmarks(id) {
  view.innerHTML = `<div class="page"><p class="loading">Loading benchmarks…</p></div>`;
  const data = await need("boards");
  if (!data?.boards?.length) return (view.innerHTML = `<div class="page"><p class="note">No benchmark table has been fetched yet. The daily job fills this page.</p></div>`);
  const b = data.boards.find((x) => x.id === id) || data.boards[0];
  const kinds = [...new Set(b.rows.map((r) => r.kind).filter(Boolean))].sort();
  view.innerHTML = `<div class="page"><section class="section">
    <h1>Benchmarks</h1>
    <p class="lede">Model comparisons copied daily from the results tables that benchmark maintainers publish. Scores are shown exactly as published.</p>
    <div class="chips">${data.boards.map((x) => `<a class="chip" style="--dot:${baseVar(fieldOf(x.field))}" href="#benchmarks/${esc(x.id)}" aria-pressed="${x.id === b.id}">${esc(x.title.replace(/^[^:]+:\s*/, ""))}</a>`).join("")}</div>
    <div class="section-head"><h2>${esc(b.title)}</h2><span class="hint">${b.rows.length} models · ${b.higher ? "higher is better" : "lower is better"}</span></div>
    <div class="controls">
      <div class="control"><label for="bq">Model</label><input class="input" id="bq" type="search" placeholder="Filter models"></div>
      <div class="control"><label for="bk">Family</label><select class="input" id="bk"><option value="">All families</option>${kinds.map((k) => `<option>${esc(k)}</option>`).join("")}</select></div>
    </div>
    <div id="bout"></div>
    <p class="note">Source: <a href="${esc(safe(b.source))}" target="_blank" rel="noopener">${esc(b.source)}</a> · CSV: <span class="mono">${esc(b.csv)}</span> · fetched ${esc(b.fetched_at)}. Task: ${esc(taskLabel(b.field, b.task))}.</p>
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

function pageStatus() {
  const checked = S.status?.checked_at;
  view.innerHTML = `<div class="page"><section class="section">
    <h1>Source status</h1>
    <p class="lede">Each day the build requests every source's website and the download link of its current release. A server that refuses automated checks still counts as up.</p>
    ${checked ? `<p class="hint">Last check: <span class="mono">${esc(checked)}</span></p>` : `<p class="note">No check has run yet. The first run of the daily job on GitHub fills this table.</p>`}
    <div class="table-wrap"><table>
      <thead><tr><th>Database</th><th>Website</th><th>HTTP</th><th>Response</th><th>Download link</th><th>Last 30 days</th></tr></thead>
      <tbody>${S.sources.map((s) => {
        const st = statusOf(s.id), l = S.status?.links?.[s.id];
        return `<tr><td><a href="#source/${esc(s.id)}">${esc(s.name)}</a></td>
          <td class="nowrap">${dot(s.id)} ${st ? esc(STATE_LABEL[st.state] || st.state) : `<span class="muted">—</span>`}</td>
          <td class="num">${st ? st.code || "—" : "—"}</td><td class="num">${st ? st.ms + " ms" : "—"}</td>
          <td class="nowrap">${l ? `<span class="dot ${esc(l.state)}"></span> ${l.code || "—"}` : `<span class="muted">—</span>`}</td><td>${history(s.id)}</td></tr>`;
      }).join("")}</tbody>
    </table></div>
  </section></div>`;
}

function pageAbout() {
  const b = S.build || {};
  const inputs = Object.entries(b.inputs || {}).map(([k, v]) => `${v.slice(0, 16)}…  ${k}`).join("\n");
  view.innerHTML = `<div class="page"><section class="section">
    <h1>How the atlas is built</h1>
    <div class="prose">
      <p>The site is a set of static pages. A small Rust program, <code>atlas</code>, reads five files kept in the repository and writes the JSON files these pages load. A GitHub Actions job runs it every day, commits the new data and publishes the site.</p>
      <h2>What changes every day</h2>
      <p><b>Papers.</b> For each field, two Europe PMC queries return the most cited open-access papers of all time and of the last 24 months. Each paper is tagged with tasks, from keyword patterns, and with the databases and datasets it names.</p>
      <p><b>New papers.</b> Every paper published in the last 60 days in the leading bioinformatics and computational biology journals is collected and sorted into fields and tasks. Nature, Science, Cell and Nature Communications are included only for computational papers. Abstracts are shown when the paper is open access or under a Creative Commons licence.</p>
      <p><b>Benchmarks.</b> Published results tables are downloaded and shown unchanged.</p>
      <p><b>Status.</b> Every source's website and the download link of its current release are requested once. Results are kept for 30 days.</p>
      <h2>Reproducing a build</h2>
      <p>Databases, releases and datasets come only from files in the repository, so a commit always gives the same <code>sources.json</code> and <code>datasets.json</code>. The daily job builds them twice with <code>atlas build --offline</code> and stops if the two outputs differ. Every build records the commit and the SHA-256 of each input:</p>
      <div class="pre">built      ${esc(b.generated_at || "—")}
engine     ${esc(b.engine || "—")}
commit     ${esc(b.commit || "—")}
mode       ${esc(b.mode || "—")}
${esc(inputs)}</div>
      <p>For your own analyses, pin the exact release link from a database page and record its checksum. The “pooch” code tab does both.</p>
      <h2>Adding or fixing an entry</h2>
      <p>Add a block to <code>data/sources.toml</code> and rows to <code>data/database_versions.csv</code>, then open a pull request. No code change is needed.</p>
      <h2>Limits</h2>
      <p>Releases marked “?” come from prior knowledge and were not confirmed against the source. Licence text is a short indication, not legal advice. Task and dataset tags on papers are automatic.</p>
    </div>
  </section></div>`;
}

function notFound(message) {
  view.innerHTML = `<div class="page"><section class="section"><h1>Not found</h1><p class="lede">${esc(message)}</p><a class="chip plain" href="#home">Back to the start</a></section></div>`;
}

// ---------- router ----------
function route() {
  stopLive();
  stopLive = () => {};
  const [page, a, b] = decodeURIComponent(location.hash.replace(/^#/, "") || "home").split("/");
  const nav = { source: "sources" }[page] || page;
  document.querySelectorAll(".nav a").forEach((x) => (x.dataset.nav === nav ? x.setAttribute("aria-current", "page") : x.removeAttribute("aria-current")));
  const pages = { home: pageHome, latest: () => pageLatest(a), sources: () => pageSources(a), source: () => pageSource(a), datasets: () => pageDatasets(a, b),
    papers: () => pagePapers(a), benchmarks: () => pageBenchmarks(a), status: pageStatus, about: pageAbout };
  const render = pages[page] || (() => notFound("That page does not exist."));
  const go = () => { render(); armArt(); window.scrollTo({ top: 0, behavior: "instant" }); };
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(go);
  else go();
}

function initTheme() {
  let saved = "";
  try { saved = localStorage.getItem("atlas-theme") || ""; } catch (e) { /* storage blocked */ }
  if (saved) document.documentElement.dataset.theme = saved;
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const root = document.documentElement;
    const dark = root.dataset.theme === "dark" || (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("atlas-theme", root.dataset.theme); } catch (e) { /* storage blocked */ }
    clearThumbs();
    route();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) {
    const q = document.getElementById("q") || document.getElementById("filter") || document.getElementById("pq");
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
    S.fields = sources.fields;
    S.sources = sources.sources;
    S.datasets = datasets.datasets;
    const [status, build] = await Promise.allSettled([load("status"), load("build")]);
    S.status = status.status === "fulfilled" ? status.value : null;
    S.build = build.status === "fulfilled" ? build.value : null;
  } catch (err) {
    view.innerHTML = `<p class="note">The data files could not be loaded (${esc(err.message)}). If you opened this page from a folder, serve it over HTTP instead.</p>`;
    return;
  }
  if (S.build) document.getElementById("foot-build").textContent = `Data build ${S.build.generated_at} · ${S.build.engine}`;
  window.addEventListener("hashchange", route);
  route();
}

start();
