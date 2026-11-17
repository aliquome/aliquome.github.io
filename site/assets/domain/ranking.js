// Pure: how a results table is ranked under a view (metric, order, left-out rows),
// with approved changes (rankings.json) applied.
export const numOf = (v) => {
  if (v == null) return null;
  const x = parseFloat(String(v).replace(/[%,\s]/g, "").replace(/±.*$/, ""));
  return Number.isFinite(x) ? x : null;
};

export function approvedView(t) {
  const a = t.approved || {};
  const metric = a.metric && t.metrics.some((m) => m.name === a.metric) ? a.metric : t.metric;
  const higher = typeof a.higher === "boolean" ? a.higher : t.metrics.find((m) => m.name === metric)?.higher ?? true;
  return { metric, higher, exclude: new Set(a.exclude || []) };
}

// Rank the rows of a table under a view { metric, higher, exclude }; equal scores share a rank.
export function rankRows(t, v) {
  const added = (t.approved?.add || []).map((a) => ({ ...a, values: Object.fromEntries(Object.entries(a.values || {}).map(([k, x]) => [k, String(x)])), added: true }));
  const fixes = new Map((t.approved?.fix || []).map((f) => [f.model, f]));
  const rows = t.rows.map((r) => {
    const f = fixes.get(r.model);
    return f ? { ...r, values: { ...r.values, ...Object.fromEntries(Object.entries(f.values || {}).map(([k, x]) => [k, String(x)])) }, fixed: f.source } : r;
  });
  const scored = [...rows, ...added].map((r) => ({ r, s: numOf(r.values[v.metric]), out: v.exclude.has(r.model) }));
  scored.sort((a, b) => a.out - b.out || (a.s == null) - (b.s == null) || (v.higher ? b.s - a.s : a.s - b.s) || a.r.model.localeCompare(b.r.model));
  let rank = 0, prev = null, n = 0;
  return scored.map((x) => {
    if (x.out || x.s == null) return { ...x, rank: null };
    n++;
    if (x.s !== prev) { rank = n; prev = x.s; }
    return { ...x, rank };
  });
}

export function metricRanks(rows, metric, higher, exclude) {
  const vals = rows.filter((r) => !exclude.has(r.model)).map((r) => ({ r, s: numOf(r.values[metric]) })).filter((x) => x.s != null);
  vals.sort((a, b) => (higher ? b.s - a.s : a.s - b.s));
  const ranks = new Map();
  let rank = 0, prev = null;
  vals.forEach((x, i) => { if (x.s !== prev) { rank = i + 1; prev = x.s; } ranks.set(x.r, rank); });
  return { ranks, of: vals.length };
}

// Where a score sits between the worst (0) and the best (1) result of a table,
// whichever direction the metric runs.
export function towardBest(s, lo, hi, higher) {
  if (s == null || !Number.isFinite(s)) return null;
  if (hi === lo) return 1;
  return higher ? (s - lo) / (hi - lo) : (hi - s) / (hi - lo);
}
