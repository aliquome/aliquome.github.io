// Data access: the JSON files written by the engine, loaded once and kept in S.

// Bumped whenever more data arrives, so derived indexes know to rebuild.
export let dataVersion = 0;
export const dataChanged = () => { dataVersion++; };

export const S = { fields: [], sources: [], datasets: [], papers: null, boards: null, status: null, build: null };

export async function need(name) {
  if (S[name]) return S[name];
  const file = name === "boards" ? "leaderboards" : name;
  try { S[name] = await load(file); } catch (e) { S[name] = null; }
  dataChanged();
  return S[name];
}

// Two kinds of results tables: boards that benchmark maintainers publish
// (leaderboards.json, fetched every two days) and tables from the Papers with Code
// archive (data/benchmarks/*.json). Approved ranking changes from
// data/rankings.toml (rankings.json) are applied on top of the archive tables.
export async function needTables() {
  if (S.tables) return S.tables;
  // the list of table files, written with the pages; without it, try every field
  const names = await load("benchmarks/index").then((j) => j.files).catch(() => S.fields.map((f) => `pwc-${f.id}`));
  const files = await Promise.all(names.map((n) => load(`benchmarks/${n}`).catch(() => null)));
  const rk = await load("rankings").catch(() => ({}));
  const approved = new Map((rk?.table || []).map((t) => [t.id, t]));
  S.tables = files.filter(Boolean).flatMap((f) => f.tables.map((t) => ({ ...t, source_name: f.source, source_url: f.url, license: f.license, snapshot: f.snapshot, approved: approved.get(t.id) || null })));
  dataChanged();
  return S.tables;
}

export async function load(name) {
  const res = await fetch(`/data/${name}.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${name}.json: HTTP ${res.status}`);
  return res.json();
}
