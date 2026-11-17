// Every result of every table and board, indexed by model, paper and dataset.
import { approvedView, rankRows, metricRanks } from "./ranking.js";

// Every result of every table and board, indexed by model, paper and dataset.
// Each result carries its rank under the approved ranking and its rank on
// every numeric metric of its table.
export let benchIdx = null;

export const benchKey = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "item";

export function keyed(names) {
  const out = new Map(), used = new Set();
  for (const n of [...names].sort()) {
    let k = benchKey(n), i = 2;
    while (used.has(k)) k = `${benchKey(n)}-${i++}`;
    used.add(k);
    out.set(n, k);
  }
  return out;
}

export const paperName = (s) => (s || "").replace(/\s+/g, " ").trim();

export function buildBenchIndex(tables, boards) {
  if (benchIdx) return benchIdx;
  const entries = [];
  for (const t of tables) {
    const v = approvedView(t);
    const ranked = rankRows(t, v);
    const rows = ranked.map((x) => x.r);
    const total = ranked.filter((x) => x.rank != null).length;
    const per = t.metrics.filter((m) => m.parsed >= 2).map((m) => {
      const higher = m.name === v.metric ? v.higher : m.higher;
      return { name: m.name, higher, ...metricRanks(rows, m.name, higher, v.exclude) };
    });
    for (const x of ranked) {
      entries.push({ kind: "table", id: t.id, task: t.task, dataset: t.dataset, field: t.field, metric: v.metric, higher: v.higher,
        model: x.r.model, paper: paperName(x.r.paper), url: x.r.url, code: x.r.code, date: x.r.date, rank: x.rank, total, out: x.out, extra: x.r.extra, added: x.r.added,
        metrics: per.filter((m) => x.r.values[m.name] != null).map((m) => ({ name: m.name, value: x.r.values[m.name], rank: m.ranks.get(x.r) ?? null, of: m.of, higher: m.higher })) });
    }
  }
  for (const b of boards) {
    for (const r of b.rows) {
      entries.push({ kind: "board", id: b.id, task: b.title.replace(/^[^:]+:\s*/, ""), dataset: b.title.split(":")[0], field: b.field, metric: b.metric_label, higher: b.higher,
        model: r.model, paper: paperName(r.paper), url: r.paper_url, code: "", date: "", rank: r.rank, total: b.rows.length, out: false,
        metrics: [{ name: b.metric_label, value: r.score.toFixed(3), rank: r.rank, of: b.rows.length, higher: b.higher }] });
    }
  }
  const group = (key) => {
    const m = new Map();
    for (const e of entries) { const k = key(e); if (k) (m.get(k) || m.set(k, []).get(k)).push(e); }
    return m;
  };
  const byModel = group((e) => e.model), byPaper = group((e) => e.paper), byDataset = group((e) => e.dataset);
  benchIdx = { entries, byModel, byPaper, byDataset, modelKey: keyed(byModel.keys()), paperKey: keyed(byPaper.keys()), datasetKey: keyed(byDataset.keys()) };
  for (const n of ["model", "paper", "dataset"]) benchIdx[`${n}ByKey`] = new Map([...benchIdx[`${n}Key`]].map(([name, k]) => [k, name]));
  return benchIdx;
}

export const modelHref = (n) => `#benchmarks/model/${benchIdx.modelKey.get(n)}`;

export const paperHref = (n) => `#benchmarks/paper/${benchIdx.paperKey.get(n)}`;

export const datasetHref = (n) => `#benchmarks/dataset/${benchIdx.datasetKey.get(n)}`;

export const entryHref = (e) => `#benchmarks/${e.id}`;

export const placeText = (e) => (e.out ? "left out" : e.rank == null ? "no score" : `${e.rank} of ${e.total}`);

export function summarize(list) {
  const ranks = list.filter((e) => e.rank != null).map((e) => e.rank);
  return {
    tables: new Set(list.map((e) => e.id)).size,
    first: new Set(list.filter((e) => e.rank === 1).map((e) => e.id)).size,
    best: ranks.length ? Math.min(...ranks) : null,
    fields: [...new Set(list.map((e) => e.field))],
    year: list.map((e) => (e.date || "").slice(0, 4)).filter(Boolean).sort()[0] || "",
  };
}
