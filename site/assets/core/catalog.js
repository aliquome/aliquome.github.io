// Lookups over the loaded catalogue: fields, sources, datasets, saved items.
import { S } from "./store.js";

export const fieldOf = (id) => S.fields.find((f) => f.id === id) || { id, label: id, base: "A", shape: "network", tasks: [] };

export const baseVar = (f) => `var(--base-${(f.base || "A").toLowerCase()})`;

export const STATE_LABEL = { ok: "Reachable", blocked: "Up, refuses automated checks", down: "Not reachable" };

export const statusOf = (id) => S.status?.sources?.[id] || null;

export function findLoader(key) {
  const [kind, id, i] = key.split(":");
  const host = kind === "ds" ? S.datasets.find((d) => d.id === id) : S.sources.find((s) => s.id === id);
  return host?.loaders?.[Number(i)];
}

// Papers are kept in a lookup so a save button can store the full record.
export const paperIndex = new Map();

export function saveItem(kind, id) {
  if (kind === "db") {
    const s = S.sources.find((x) => x.id === id);
    return s && { key: `db:${id}`, type: "database", title: s.name, version: s.latest, url: s.latest_url, href: `#source/${id}` };
  }
  if (kind === "ds") {
    const d = S.datasets.find((x) => x.id === id);
    return d && { key: `ds:${id}`, type: "dataset", title: d.name, version: d.versions || "", url: d.links[0]?.url || d.repo, href: `#datasets/${d.field}/${encodeURIComponent(d.name)}` };
  }
  const p = paperIndex.get(id);
  return p && { key: `pp:${id}`, type: "paper", title: p.title, url: p.url, href: p.url, paper: p };
}

export const dsName = (key) => {
  const [kind, id] = key.split(":");
  if (kind === "db") return S.sources.find((s) => s.id === id)?.name || id;
  return S.datasets.find((d) => d.id === id)?.name || id;
};

export const dsHref = (key) => {
  const [kind, id] = key.split(":");
  if (kind === "db") return `#source/${id}`;
  const d = S.datasets.find((x) => x.id === id);
  return d ? `#datasets/${d.field}/${encodeURIComponent(d.name)}` : "#datasets";
};

// One tag per visible name: a database and a dataset can share a name.
export const uniqueByName = (keys) => {
  const seen = new Set();
  return keys.filter((k) => { const n = dsName(k).toLowerCase(); if (seen.has(n)) return false; seen.add(n); return true; });
};

// Task ids are "task" inside a field list, or "field:task" in the latest feed.
export const taskLabel = (field, id) => {
  const [f, t] = id.includes(":") ? id.split(":") : [field, id];
  return fieldOf(f).tasks?.find((x) => x.id === t)?.label || t;
};
