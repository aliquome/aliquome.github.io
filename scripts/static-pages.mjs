// Writes a page on disk for every address of the site (see site/assets/domain/
// paths.js): one per database, dataset, benchmark table, model, paper and
// dataset profile, the section pages, 404.html, sitemap.xml and robots.txt.
// Each page is site/index.html with its own title, description, canonical
// address, structured data and content, so that search engines read every item
// without running the site's JavaScript; in a browser the site then takes over.
// Run after the engine: node scripts/static-pages.mjs [site-dir]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { approvedView, rankRows } from "../site/assets/domain/ranking.js";
import { buildBenchIndex, keyed, paperName } from "../site/assets/domain/bench-index.js";
import { snippets, typeOf } from "../site/assets/domain/links.js";
import { configurePaths, toPath } from "../site/assets/domain/paths.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE_DIR = path.resolve(process.argv[2] || path.join(ROOT, "site"));
const BASE = "https://aliquome.github.io/";
// everything this script writes, removed first so a build leaves no stale page
const OUTPUT = ["db", "datasets", "benchmarks", "models", "papers", "status", "about", "saved", "404.html", "sitemap.xml", "robots.txt"];

const read = (p) => JSON.parse(fs.readFileSync(path.join(SITE_DIR, p), "utf8"));
const TEMPLATE = fs.readFileSync(path.join(SITE_DIR, "index.html"), "utf8").replace(/\r\n/g, "\n");
const { fields, sources } = read("data/sources.json");
const { datasets } = read("data/datasets.json");
const build = read("data/build.json");
const { boards } = read("data/leaderboards.json");
const latest = read("data/latest.json");
const top = read("data/papers.json");
let approved = new Map();
try { approved = new Map((read("data/rankings.json").table || []).map((t) => [t.id, t])); } catch { /* none yet */ }
const tables = fields.flatMap((f) => {
  const p = path.join(SITE_DIR, "data/benchmarks", `pwc-${f.id}.json`);
  if (!fs.existsSync(p)) return [];
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return j.tables.map((t) => ({ ...t, source_name: j.source, source_url: j.url, approved: approved.get(t.id) || null }));
});
const idx = buildBenchIndex(tables, boards);
const datasetKey = keyed(datasets.map((d) => d.name));
configurePaths({ fields: fields.map((f) => f.id), datasetSlugs: datasetKey });
const today = String(build.generated_at || new Date().toISOString()).slice(0, 10);
const label = Object.fromEntries(fields.map((f) => [f.id, f.label]));

// ---------- helpers ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const clip = (s, n) => { s = clean(s); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; };
const safe = (u) => (/^(https?|ftp|s3|gs):\/\//i.test(u || "") ? u : "");
const ext = (u, text) => (safe(u) ? `<a href="${esc(u)}" rel="nofollow noopener">${esc(text ?? u)}</a>` : esc(text ?? u ?? ""));
const to = (route) => esc(toPath(route));
const num = (n) => Number(n || 0).toLocaleString("en-US");
const plural = (n, one, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o, null, 0).replace(/</g, "\\u003c")}</script>`;
const doi = (p) => (p.doi ? `https://doi.org/${p.doi}` : p.id?.startsWith("MED:") ? `https://europepmc.org/article/MED/${p.id.slice(4)}` : "");

const pages = []; // { url, html, index }
function page({ url, title, description, h1, crumb = [], body, schema = [], index = true }) {
  const canonical = BASE + url.replace(/^\//, "").replace(/index\.html$/, "");
  const trail = [["Aliquome", "/"], ...crumb];
  const crumbs = crumb.length ? `<nav class="crumbs" aria-label="Breadcrumb">${trail.map(([n, u], i) => (i === trail.length - 1 ? `<span aria-current="page">${esc(n)}</span>` : `<a href="${esc(u)}">${esc(n)}</a><span aria-hidden="true">/</span>`)).join("")}</nav>` : "";
  const breadcrumbLd = crumb.length ? [{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: trail.map(([name, u], i) => ({ "@type": "ListItem", position: i + 1, name, item: BASE + u.replace(/^\//, "") })) }] : [];
  const sub = (html, re, fn) => { if (!re.test(html)) throw new Error(`site/index.html has no ${re}`); return html.replace(re, fn); };
  let html = TEMPLATE;
  html = sub(html, /<title>[\s\S]*?<\/title>/, () => `<title>${esc(title)}</title>`);
  html = sub(html, /<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${esc(clip(description, 158))}">${index ? "" : '\n  <meta name="robots" content="noindex">'}`);
  html = sub(html, /<link rel="canonical" href="[^"]*">/, () => `<link rel="canonical" href="${esc(canonical)}">`);
  html = sub(html, /<meta property="og:url" content="[^"]*">/, () => `<meta property="og:url" content="${esc(canonical)}">`);
  html = sub(html, /<meta property="og:title" content="[^"]*">/, () => `<meta property="og:title" content="${esc(title)}">`);
  html = sub(html, /<meta property="og:description" content="[^"]*">/, () => `<meta property="og:description" content="${esc(clip(description, 200))}">`);
  html = sub(html, /<script type="application\/ld\+json">[\s\S]*?<\/script>/, () => [...breadcrumbLd, ...schema].map(ld).join("\n  "));
  html = sub(html, /(<main id="view"[^>]*>)[\s\S]*?(<\/main>)/, (_, open, close) => `${open}\n<div class="page static-page" data-for="${esc(url.endsWith(".html") ? "" : url)}">\n${crumbs}\n<h1>${esc(h1)}</h1>\n${body}\n</div>\n  ${close}`);
  pages.push({ url, html, index });
}

const table = (head, rows) => `<div class="table-wrap"><table class="static-table"><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const facts = (pairs) => `<dl class="facts">${pairs.filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>`;
const code = (url, type) => {
  const sn = snippets(url, typeOf(url, type));
  return sn.length ? `<div class="static-code">${sn.map(([lang, src]) => `<h3>${esc(lang)}</h3><pre><code>${esc(src)}</code></pre>`).join("")}</div>` : "";
};
const modelLink = (m) => (idx.modelKey.has(m) ? `<a href="${to(["benchmarks", "model", idx.modelKey.get(m)])}">${esc(m)}</a>` : esc(m));
const paperLink = (p) => (p && idx.paperKey.has(p) ? `<a href="${to(["benchmarks", "paper", idx.paperKey.get(p)])}">${esc(clip(p, 110))}</a>` : esc(clip(p, 110)));
const entryRows = (entries, first) => entries.map((e) => [first(e), e.out ? "left out" : e.rank == null ? "no score" : `${e.rank} of ${e.total}`, e.metrics.map((m) => `${esc(m.name)} <span class="num">${esc(m.value)}</span>`).join("<br>")]);
const byField = (items, key) => fields.map((f) => [f, items.filter((x) => key(x) === f.id)]).filter(([, xs]) => xs.length);
const paperItem = (p) => { const u = doi(p); return `<li>${u ? ext(u, clean(p.title)) : esc(clean(p.title))} <span class="muted">${esc(clip(p.authors, 60))} <i>${esc(p.journal)}</i> ${esc(p.date || p.year || "")}</span></li>`; };

// ---------- databases ----------
for (const s of sources) {
  const vs = s.versions || [];
  const description = `${s.name}: ${clean(s.summary)} All ${plural(vs.length, "release")} with direct download links and code${s.latest ? `; current release ${s.latest}${s.latest_date ? ` (${s.latest_date})` : ""}` : ""}.`;
  const nTables = tables.filter((t) => t.field === s.field).length;
  page({
    url: toPath(["source", s.id]),
    title: `${s.name}: all releases and download links | Aliquome`,
    description,
    h1: s.name,
    crumb: [["Databases", toPath(["sources"])], [s.name, toPath(["source", s.id])]],
    body: `<p class="lede">${esc(s.summary)}</p>
${facts([["Field", `<a href="${to(["sources", s.field])}">${esc(label[s.field] || s.field)}</a>`], ["Current release", s.latest ? `<b>${esc(s.latest)}</b> ${esc(s.latest_date || "")}` : ""], ["Releases tracked", num(vs.length)], ["Licence", esc(s.license || "")], ["Website", ext(s.homepage)]])}
${s.latest_url ? `<h2>Download the current release</h2><p class="url-line"><code>${esc(s.latest_url)}</code></p>${code(s.latest_url, s.latest_url_type)}` : ""}
<h2>Every release of ${esc(s.name)}</h2>
${table(["Release", "Date", "Status", "Download"], [...vs].reverse().map((v) => [`<b>${esc(v.version)}</b>`, esc(v.date || ""), esc(v.status || ""), v.url ? ext(v.url) : `<span class="muted">${esc(v.note || "no direct link")}</span>`]))}
${nTables ? `<p class="hint">Related: <a href="${to(["benchmarks", s.field])}">${plural(nTables, "benchmark table")} in ${esc(label[s.field] || s.field)}</a>.</p>` : ""}`,
    schema: [{
      "@context": "https://schema.org", "@type": "Dataset", name: s.name, description: clip(description, 4900),
      url: BASE + toPath(["source", s.id]).slice(1), sameAs: safe(s.homepage) || undefined, version: s.latest || undefined, license: s.license || undefined,
      isAccessibleForFree: true, keywords: [label[s.field], "bioinformatics database", `${s.name} download`, `${s.name} versions`].filter(Boolean),
      distribution: /^https?:/.test(s.latest_url || "") ? [{ "@type": "DataDownload", contentUrl: s.latest_url, name: `${s.name} ${s.latest || ""}`.trim() }] : undefined,
      includedInDataCatalog: { "@type": "DataCatalog", name: "Aliquome", url: BASE },
    }],
  });
}

// ---------- datasets ----------
const tablesOfDataset = new Map();
for (const t of tables) if (t.dataset_id) (tablesOfDataset.get(t.dataset_id) || tablesOfDataset.set(t.dataset_id, []).get(t.dataset_id)).push(t);
const datasetBody = (d) => {
  const ts = tablesOfDataset.get(d.id) || [];
  return `<p class="lede">${esc(d.description)}</p>
${facts([["Field", `<a href="${to(["datasets", d.field])}">${esc(label[d.field] || d.field)}</a>`], ["Category", esc(d.category || "")], ["Licence", esc(d.license || "")], ["Versions", esc(d.versions || "")], ["Access", esc(d.access || "")], ["Repository", d.repo ? ext(d.repo) + (d.stars ? ` <span class="muted">${num(d.stars)} stars</span>` : "") : ""], ["Papers using it", d.paper_count ? num(d.paper_count) : ""]])}
${(d.links || []).length ? `<h2>Download ${esc(d.name)}</h2><ul class="static-links">${d.links.map((l) => `<li>${esc(l.label)}: ${ext(l.url)}</li>`).join("")}</ul>${code(d.links[0].url)}` : ""}
${ts.length ? `<h2>Benchmarks on ${esc(d.name)}</h2><ul class="static-links">${ts.map((t) => `<li><a href="${to(["benchmarks", t.id])}">${esc(t.task)} on ${esc(t.dataset)}</a> <span class="muted">${plural(t.rows.length, "result")}</span></li>`).join("")}</ul>` : ""}`;
};
// a few names are listed twice, in two fields or from two sources: one page shows both
const sameName = new Map();
for (const d of datasets) (sameName.get(d.name) || sameName.set(d.name, []).get(d.name)).push(d);
for (const [, group] of sameName) {
  const d = group[0];
  const short = clean(d.description).length < 80;
  const description = `${d.name} dataset: ${clean(d.description)}${short ? `${/[.!?]$/.test(clean(d.description)) ? "" : "."} ${d.category || label[d.field] || ""}: download links, code and benchmark results.` : ""}`;
  const url = toPath(["datasets", d.field, d.name]);
  page({
    url,
    title: `${d.name} dataset: download, code and benchmarks | Aliquome`,
    description,
    h1: d.name,
    crumb: [["Datasets", toPath(["datasets"])], [d.name, url]],
    body: group.map((x, i) => (i ? `<h2>Also listed in ${esc(label[x.field] || x.field)}: ${esc(x.category || "")}</h2>\n` : "") + datasetBody(x)).join("\n"),
    schema: [{
      "@context": "https://schema.org", "@type": "Dataset", name: d.name, description: clip(description, 4900),
      url: BASE + url.slice(1), license: d.license || undefined, isAccessibleForFree: true, sameAs: safe(d.repo) || undefined,
      keywords: [label[d.field], d.category, "machine learning", "bioinformatics dataset"].filter(Boolean),
      distribution: (d.links || []).filter((l) => /^https?:/.test(l.url || "")).slice(0, 10).map((l) => ({ "@type": "DataDownload", contentUrl: l.url, name: l.label })),
      includedInDataCatalog: { "@type": "DataCatalog", name: "Aliquome", url: BASE },
    }],
  });
}

// ---------- benchmark tables and boards ----------
for (const t of tables) {
  const v = approvedView(t);
  const ranked = rankRows(t, v);
  const metrics = t.metrics.filter((m) => m.parsed >= 2).map((m) => m.name);
  const shown = [v.metric, ...metrics.filter((m) => m !== v.metric)].slice(0, 4);
  const best = ranked.find((x) => x.rank === 1);
  const ds = t.dataset_id ? datasets.find((d) => d.id === t.dataset_id) : null;
  const name = `${t.task} on ${t.dataset}`;
  page({
    url: toPath(["benchmarks", t.id]),
    title: `${name}: leaderboard and results | Aliquome`,
    description: `${name}: ${plural(ranked.length, "published result")} ranked by ${v.metric}${best ? `; best ${best.r.model} (${best.r.values[v.metric]})` : ""}. ${clean(t.description || "")}`,
    h1: name,
    crumb: [["Benchmarks", toPath(["benchmarks"])], [name, toPath(["benchmarks", t.id])]],
    body: `<p class="lede">${esc(plural(ranked.length, "published result"))}, ranked by <b>${esc(v.metric)}</b> (${v.higher ? "higher is better" : "lower is better"}).${ds ? ` About the data and how to download it: <a href="${to(["datasets", ds.field, ds.name])}">${esc(ds.name)}</a>.` : ""}</p>
${t.description ? `<p>${esc(clip(t.description, 600))}</p>` : ""}
${table(["#", "Model", ...shown.map(esc), "Paper", "Code"], ranked.map((x) => [x.rank ?? "–", `<b>${modelLink(x.r.model)}</b>${x.r.extra ? ' <span class="tag">extra data</span>' : ""}`, ...shown.map((m) => `<span class="num">${esc(x.r.values[m] ?? "")}</span>`), `${paperLink(paperName(x.r.paper))}${x.r.date ? ` <span class="muted">${esc(String(x.r.date).slice(0, 4))}</span>` : ""}`, x.r.code ? ext(x.r.code, "Code") : ""]))}
<p class="hint">Source: ${ext(t.source_url, t.source_name || "Papers with Code archive")}. Field: <a href="${to(["benchmarks", t.field])}">${esc(label[t.field] || t.field)}</a>.</p>`,
  });
}
for (const b of boards) {
  page({
    url: toPath(["benchmarks", b.id]),
    title: `${b.title}: leaderboard | Aliquome`,
    description: `${b.title}: ${plural(b.rows.length, "model")} ranked by ${b.metric_label}${b.rows[0] ? `; best ${b.rows[0].model}` : ""}. From ProteinGym.`,
    h1: b.title,
    crumb: [["Benchmarks", toPath(["benchmarks"])], [b.title, toPath(["benchmarks", b.id])]],
    body: `<p class="lede">${plural(b.rows.length, "model")}, ranked by <b>${esc(b.metric_label)}</b>.</p>
${table(["#", "Model", esc(b.metric_label), "Paper"], b.rows.map((r) => [r.rank, `<b>${modelLink(r.model)}</b>`, `<span class="num">${esc(r.score.toFixed(3))}</span>`, paperLink(paperName(r.paper))]))}
<p class="hint">Source: ${ext(b.source, "ProteinGym")}.</p>`,
  });
}

// ---------- model, paper and dataset profiles ----------
for (const [model, entries] of idx.byModel) {
  const key = idx.modelKey.get(model);
  const ranked = entries.filter((e) => e.rank != null);
  const bestPlace = ranked.length ? Math.min(...ranked.map((e) => e.rank)) : null;
  const tasks = [...new Set(entries.map((e) => e.task))];
  const papers = [...new Set(entries.map((e) => e.paper).filter(Boolean))];
  page({
    url: toPath(["benchmarks", "model", key]),
    title: `${model}: benchmark results and rankings | Aliquome`,
    description: `${model}: results in ${plural(entries.length, "bioinformatics benchmark")} (${clip(tasks.join(", "), 90)})${bestPlace ? `, best place ${bestPlace}` : ""}.${papers[0] ? ` Reported in “${clip(papers[0], 80)}”.` : ""}`,
    h1: model,
    crumb: [["Models", toPath(["benchmarks", "models"])], [model, toPath(["benchmarks", "model", key])]],
    body: `<p class="lede">In ${plural(entries.length, "ranking")}${bestPlace ? `, best place ${bestPlace}` : ""}.</p>
${papers.length ? `<p>Reported in ${papers.slice(0, 5).map(paperLink).join(", ")}${papers.length > 5 ? ` and ${num(papers.length - 5)} more` : ""}.</p>` : ""}
${table(["Ranking", "Place", "Results"], entryRows(entries, (e) => `<a href="${to(["benchmarks", e.id])}"><b>${esc(e.task)}</b> on ${esc(e.dataset)}</a>`))}`,
  });
}
for (const [paper, entries] of idx.byPaper) {
  const key = idx.paperKey.get(paper);
  const models = [...new Set(entries.map((e) => e.model))];
  const link = entries.find((e) => e.url)?.url;
  page({
    url: toPath(["benchmarks", "paper", key]),
    title: `${clip(paper, 90)}: benchmark results | Aliquome`,
    description: `Results of “${clip(paper, 100)}” in ${plural(entries.length, "bioinformatics benchmark")}: ${clip(models.join(", "), 80)}.`,
    h1: paper,
    crumb: [["Papers with results", toPath(["benchmarks", "papers"])], [clip(paper, 60), toPath(["benchmarks", "paper", key])]],
    body: `<p class="lede">${plural(models.length, "model")} in ${plural(entries.length, "ranking")}.${link ? ` Read the paper: ${ext(link, "link")}.` : ""}</p>
${table(["Model", "Ranking", "Place", "Results"], entries.map((e) => [modelLink(e.model), ...entryRows([e], (x) => `<a href="${to(["benchmarks", x.id])}">${esc(x.task)} on ${esc(x.dataset)}</a>`)[0]]))}`,
  });
}
for (const [dataset, entries] of idx.byDataset) {
  const key = idx.datasetKey.get(dataset);
  const ids = [...new Set(entries.map((e) => e.id))];
  page({
    url: toPath(["benchmarks", "dataset", key]),
    title: `${dataset} benchmarks: leaderboards and results | Aliquome`,
    description: `${dataset}: ${plural(ids.length, "results table")} with ${plural(entries.length, "published result")} for machine learning models.`,
    h1: `Benchmarks on ${dataset}`,
    crumb: [["Benchmarks", toPath(["benchmarks"])], [dataset, toPath(["benchmarks", "dataset", key])]],
    body: `<ul class="static-links">${ids.map((id) => { const e = entries.find((x) => x.id === id); return `<li><a href="${to(["benchmarks", id])}"><b>${esc(e.task)}</b> on ${esc(e.dataset)}</a> <span class="muted">${plural(entries.filter((x) => x.id === id).length, "result")}, ${esc(e.metric)}</span></li>`; }).join("")}</ul>`,
  });
}

// ---------- section pages ----------
page({
  url: toPath(["sources"]), title: `${sources.length} bioinformatics databases with every release and download link | Aliquome`,
  description: `Every release of ${sources.length} core bioinformatics databases (${sources.slice(0, 8).map((s) => s.name).join(", ")} and more) with direct, versioned download links and code.`,
  h1: "Databases", crumb: [["Databases", toPath(["sources"])]],
  body: byField(sources, (s) => s.field).map(([f, xs]) => `<h2 id="${esc(f.id)}">${esc(f.label)}</h2><ul class="static-links">${xs.map((s) => `<li><a href="${to(["source", s.id])}"><b>${esc(s.name)}</b></a>: ${esc(s.summary)} <span class="muted">${plural((s.versions || []).length, "release")}</span></li>`).join("")}</ul>`).join("\n"),
});
page({
  url: toPath(["datasets"]), title: `${datasets.length} machine learning datasets for biology | Aliquome`,
  description: `${datasets.length} public datasets for machine learning in biology: proteins, molecules, single-cell, genomics, histopathology and biomedical text, with download links, code and benchmarks.`,
  h1: "Datasets and benchmarks", crumb: [["Datasets", toPath(["datasets"])]],
  body: byField(datasets, (d) => d.field).map(([f, xs]) => `<h2 id="${esc(f.id)}">${esc(f.label)}</h2><ul class="static-links">${[...xs].sort((a, b) => a.name.localeCompare(b.name)).map((d) => `<li><a href="${to(["datasets", d.field, d.name])}"><b>${esc(d.name)}</b></a>: ${esc(clip(d.description, 150))}</li>`).join("")}</ul>`).join("\n"),
});
page({
  url: toPath(["benchmarks"]), title: `${tables.length + boards.length} bioinformatics benchmark tables and leaderboards | Aliquome`,
  description: `${tables.length + boards.length} results tables and leaderboards for machine learning in biology, ${num(idx.byModel.size)} models: molecular property prediction, protein function, drug–target interaction and more.`,
  h1: "Benchmarks", crumb: [["Benchmarks", toPath(["benchmarks"])]],
  body: `<p><a href="${to(["benchmarks", "models"])}">All ${num(idx.byModel.size)} models</a> and <a href="${to(["benchmarks", "papers"])}">all ${num(idx.byPaper.size)} papers with results</a>.</p>
${boards.length ? `<h2>ProteinGym</h2><ul class="static-links">${boards.map((b) => `<li><a href="${to(["benchmarks", b.id])}"><b>${esc(b.title)}</b></a> <span class="muted">${plural(b.rows.length, "model")}</span></li>`).join("")}</ul>` : ""}
${byField(tables, (t) => t.field).map(([f, xs]) => `<h2 id="${esc(f.id)}">${esc(f.label)}</h2><ul class="static-links">${[...xs].sort((a, b) => a.task.localeCompare(b.task) || a.dataset.localeCompare(b.dataset)).map((t) => `<li><a href="${to(["benchmarks", t.id])}"><b>${esc(t.task)}</b> on ${esc(t.dataset)}</a> <span class="muted">${plural(t.rows.length, "result")}, ${esc(t.metric)}</span></li>`).join("")}</ul>`).join("\n")}`,
});
const byName = (m) => [...m.keys()].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
page({
  url: toPath(["benchmarks", "models"]), title: `${idx.byModel.size} models compared on bioinformatics benchmarks | Aliquome`,
  description: `${idx.byModel.size} machine learning models for biology and chemistry, each with its results and rank on every benchmark table it appears in.`,
  h1: "Models", crumb: [["Benchmarks", toPath(["benchmarks"])], ["Models", toPath(["benchmarks", "models"])]],
  body: `<ul class="static-columns">${byName(idx.byModel).map((m) => `<li>${modelLink(m)} <span class="muted">${idx.byModel.get(m).length}</span></li>`).join("")}</ul>`,
});
page({
  url: toPath(["benchmarks", "papers"]), title: `${idx.byPaper.size} papers with benchmark results in biology | Aliquome`,
  description: `${idx.byPaper.size} papers that report results on bioinformatics and chemistry benchmarks, each with every ranking it appears in.`,
  h1: "Papers with results", crumb: [["Benchmarks", toPath(["benchmarks"])], ["Papers", toPath(["benchmarks", "papers"])]],
  body: `<ul class="static-links">${byName(idx.byPaper).map((p) => `<li>${paperLink(p)} <span class="muted">${plural(idx.byPaper.get(p).length, "result")}</span></li>`).join("")}</ul>`,
});
const newest = [...latest.papers].sort((a, b) => String(b.date).localeCompare(String(a.date)));
page({
  url: toPath(["latest"]), title: `New bioinformatics and computational biology papers | Aliquome`,
  description: `${num(latest.papers.length)} papers published since ${latest.since} in ${latest.journals.length} leading bioinformatics and computational biology journals, sorted by field and task.`,
  h1: "New papers", crumb: [["Papers", toPath(["latest"])]],
  body: `<p class="lede">${num(latest.papers.length)} papers from ${latest.since} to ${latest.until}, from ${esc(latest.journals.join(", "))}. <a href="${to(["papers"])}">Most cited papers</a>.</p>
<ul class="static-links">${newest.map(paperItem).join("")}</ul>`,
});
page({
  url: toPath(["papers"]), title: `Most cited open-access bioinformatics papers by field | Aliquome`,
  description: `The most cited open-access papers in ${fields.length} fields of bioinformatics and computational biology, from Europe PMC.`,
  h1: "Most cited papers", crumb: [["Papers", toPath(["latest"])], ["Most cited", toPath(["papers"])]],
  body: top.fields.filter((f) => f.papers.length).map((f) => `<h2 id="${esc(f.id)}">${esc(f.label)}</h2><ul class="static-links">${f.papers.map(paperItem).join("")}</ul>`).join("\n"),
});
page({ url: toPath(["status"]), title: "Source status | Aliquome", description: "Whether every database website and current download link answered at the last check, and the history of the last 30 checks.", h1: "Source status", crumb: [["Status", toPath(["status"])]], body: `<p class="lede">Checked every two days. Last build ${esc(today)}.</p>` });
page({ url: toPath(["about"]), title: "Cite and reproduce | Aliquome", description: "How Aliquome is built every two days, how to reproduce a build, how to cite it and how to add or fix an entry.", h1: "How the atlas is built", crumb: [["About", toPath(["about"])]], body: `<p class="lede">How the atlas is built, how to reproduce it and how to cite it.</p>` });
page({ url: toPath(["saved"]), title: "Saved items | Aliquome", description: "Databases, releases, datasets and papers you saved in this browser.", h1: "Saved", crumb: [["Saved", toPath(["saved"])]], body: `<p class="lede">Items you save are kept in this browser.</p>`, index: false });
page({ url: "/404.html", title: "Not found | Aliquome", description: "This page does not exist.", h1: "Not found", body: `<p class="lede">That page does not exist. <a href="/">Back to the start</a>.</p>`, index: false });

// ---------- write ----------
for (const o of OUTPUT) fs.rmSync(path.join(SITE_DIR, o), { recursive: true, force: true });
const seen = new Set();
for (const p of pages) {
  if (seen.has(p.url)) throw new Error(`two pages at ${p.url}`);
  seen.add(p.url);
  const file = p.url.endsWith(".html") ? path.join(SITE_DIR, p.url) : path.join(SITE_DIR, p.url, "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, p.html);
}
const urls = ["/", ...pages.filter((p) => p.index).map((p) => p.url)];
fs.writeFileSync(path.join(SITE_DIR, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(BASE + u.slice(1))}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`);
// the list of results-table files, so the site asks only for files that exist
const tableFiles = fs.readdirSync(path.join(SITE_DIR, "data/benchmarks")).filter((f) => /^pwc-.+\.json$/.test(f)).sort().map((f) => f.replace(/\.json$/, ""));
fs.writeFileSync(path.join(SITE_DIR, "data/benchmarks/index.json"), `${JSON.stringify({ files: tableFiles })}\n`);
fs.writeFileSync(path.join(SITE_DIR, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${BASE}sitemap.xml\n`);
const n = (pre) => pages.filter((p) => p.url.startsWith(pre)).length;
console.log(`pages: ${pages.length} (${n("/db/") - 1} databases, ${n("/datasets/") - 1} datasets, ${n("/models/") - 1} models, ${n("/benchmarks/paper/")} papers, ${n("/benchmarks/dataset/")} benchmark datasets); sitemap with ${urls.length} URLs`);
