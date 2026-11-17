// Writes the full catalogue into README.md, between the catalog markers:
// every database with its releases, every dataset, every benchmark table, the
// most cited open-access papers and the new papers of the last 60 days. The
// text is plain Markdown so GitHub and search engines index every name.
// Run after the engine: node scripts/readme-catalog.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configurePaths, toPath } from "../site/assets/domain/paths.js";
import { keyed } from "../site/assets/domain/bench-index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://aliquome.github.io/";
const START = "<!-- catalog:start -->";
const END = "<!-- catalog:end -->";

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const { fields, sources } = read("site/data/sources.json");
const { datasets } = read("site/data/datasets.json");
const top = read("site/data/papers.json");
const latest = read("site/data/latest.json");
const benchDir = path.join(ROOT, "data/benchmarks");
const tables = fs.readdirSync(benchDir).filter((f) => f.endsWith(".json")).sort()
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(benchDir, f), "utf8")).tables);

// Markdown-safe text on one line
const md = (s) => String(s ?? "").replace(/\s+/g, " ").trim()
  .replace(/[\\`*_[\]<>|]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : `\\${c}`));
const cut = (s, n) => { s = String(s ?? "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s; };
const title = (s) => md(String(s ?? "").replace(/\.$/, ""));
const num = (n) => n.toLocaleString("en-US");
configurePaths({ fields: fields.map((f) => f.id), datasetSlugs: keyed(datasets.map((d) => d.name)) });
const at = (route) => SITE + toPath(route).slice(1);
const label = Object.fromEntries(fields.map((f) => [f.id, f.label]));
const order = fields.map((f) => f.id);
const byField = (items, key = (x) => x.field) => {
  const g = new Map(order.map((id) => [id, []]));
  for (const x of items) { const k = key(x); if (!g.has(k)) g.set(k, []); g.get(k).push(x); }
  return [...g].filter(([, xs]) => xs.length);
};
const group = (heading, count, unit, lines) =>
  `<details>\n<summary><b>${md(heading)}</b> (${num(count)} ${unit})</summary>\n\n${lines.join("\n")}\n\n</details>\n`;
const paperLine = (p) => {
  const link = p.doi ? `https://doi.org/${p.doi}` : p.id?.startsWith("MED:") ? `https://europepmc.org/article/MED/${p.id.slice(4)}` : "";
  const name = link ? `[${title(p.title)}](${link})` : title(p.title);
  const first = String(p.authors || "").split(",")[0].replace(/\.$/, "").trim();
  const who = first ? (String(p.authors).includes(",") ? `${first} et al` : first) : "";
  const stop = /[?!]$/.test(String(p.title ?? "").trim()) ? " " : ". ";
  return `- ${name}${stop}${who ? `${md(who)}. ` : ""}*${md(p.journal)}*, ${md(p.year || String(p.date || "").slice(0, 4))}.`;
};

const out = [];
out.push(`## Full catalogue\n\nEverything on [aliquome.github.io](${SITE}), as plain lists. Updated automatically every two days; last update ${latest.until || new Date().toISOString().slice(0, 10)}.\n`);

// databases
out.push(`### Bioinformatics databases and their releases (${sources.length} databases, ${num(sources.reduce((n, s) => n + (s.versions?.length || 0), 0))} releases)\n`);
for (const [f, xs] of byField(sources)) {
  out.push(group(label[f] || f, xs.length, "databases", xs.map((s) => {
    const rel = (s.versions || []).map((v) => v.version).filter(Boolean);
    return `- **[${md(s.name)}](${at(["source", s.id])})**: ${md(cut(s.summary, 160))}${rel.length ? ` Releases: ${md(rel.join(", "))}.` : ""}`;
  })));
}

// datasets
out.push(`### Datasets for machine learning in biology (${datasets.length})\n`);
for (const [f, xs] of byField(datasets)) {
  const sorted = [...xs].sort((a, b) => (b.stars || 0) - (a.stars || 0) || a.name.localeCompare(b.name));
  out.push(group(label[f] || f, xs.length, "datasets", sorted.map((d) =>
    `- **[${md(d.name)}](${at(["datasets", d.field, d.name])})**: ${md(cut(d.description, 170))}`)));
}

// benchmark tables
out.push(`### Benchmark tables and leaderboards (${tables.length})\n`);
for (const [f, xs] of byField(tables)) {
  const sorted = [...xs].sort((a, b) => a.task.localeCompare(b.task) || a.dataset.localeCompare(b.dataset));
  out.push(group(label[f] || f, xs.length, "tables", sorted.map((t) =>
    `- [${md(t.task)} on ${md(t.dataset)}](${at(["benchmarks", t.id])}): ${num(t.rows?.length || 0)} results${t.metric ? `, ranked by ${md(t.metric)}` : ""}`)));
}

// most cited papers
const nTop = top.fields.reduce((n, f) => n + f.papers.length, 0);
out.push(`### Most cited open-access papers by field (${num(nTop)})\n`);
for (const f of top.fields) {
  if (!f.papers.length) continue;
  out.push(group(f.label, f.papers.length, "papers", f.papers.map(paperLine)));
}

// new papers: the newest IN_README here and all of them in PAPERS.md, as
// GitHub stops rendering a README of about 512 KB
const IN_README = 600;
const fieldOf = (p) => (p.tasks?.[0] || "").split(":")[0] || p.field || "other";
const newest = [...latest.papers].sort((a, b) => String(b.date).localeCompare(String(a.date)));
const newPapers = (list) => byField(list, fieldOf).map(([f, xs]) => group(label[f] || "Other", xs.length, "papers", xs.map(paperLine)));
const from = `From ${md(latest.journals.join(", "))}.`;
const shown = newest.slice(0, IN_README);
out.push(`### New bioinformatics and computational biology papers (${num(latest.papers.length)} since ${latest.since})\n\nThe ${num(shown.length)} newest, from ${shown.at(-1)?.date} to ${latest.until}; all ${num(latest.papers.length)} are in [PAPERS.md](PAPERS.md). ${from}\n`);
out.push(...newPapers(shown));
fs.writeFileSync(path.join(ROOT, "PAPERS.md"),
  `# New bioinformatics and computational biology papers\n\nEvery paper published from ${latest.since} to ${latest.until} in the leading bioinformatics and computational biology journals, sorted by field, newest first. Updated every two days by [Aliquome](${SITE}); browse them with abstracts, tasks and filters at [aliquome.github.io/papers](${at(["latest"])}).\n\n${from}\n\n${newPapers(newest).join("\n")}`);

const block = `${START}\n${out.join("\n")}\n${END}`;
const file = path.join(ROOT, "README.md");
let readme = fs.readFileSync(file, "utf8");
const crlf = readme.includes("\r\n");
readme = readme.replace(/\r\n/g, "\n");
if (!readme.includes(START) || !readme.includes(END)) throw new Error("README.md has no catalog markers");
readme = readme.slice(0, readme.indexOf(START)) + block + readme.slice(readme.indexOf(END) + END.length);
fs.writeFileSync(file, crlf ? readme.replace(/\n/g, "\r\n") : readme);
console.log(`README catalogue: ${sources.length} databases, ${datasets.length} datasets, ${tables.length} tables, ${nTop} top papers, ${latest.papers.length} new papers; README ${Math.round(Buffer.byteLength(readme) / 1024)} KB`);
