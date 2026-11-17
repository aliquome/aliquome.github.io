// Pure: how much of the catalogue a reader can fetch straight from code, and
// what the atlas holds per field. No DOM, no data loading.
import { typeOf, inferType } from "./links.js";
import { upgma, leafOrder } from "./cluster.js";

const hasLink = (url) => /^(https?|ftp|s3|gs):/.test(url || "");
const share = (part, whole) => (whole ? part / whole : 0);

// The four figures of "The atlas today", each with the share drawn as read coverage.
export function coverage(sources, datasets) {
  const versions = sources.flatMap((s) => s.versions);
  const linked = versions.filter((v) => hasLink(v.url));
  const verified = linked.filter((v) => v.verified);
  const current = sources.filter((s) => s.latest_url && typeOf(s.latest_url, s.latest_url_type) !== "portal");
  const withCode = datasets.filter((d) => d.loaders?.length || [d.repo, ...d.links.map((l) => l.url)].some((u) => u && inferType(u) !== "portal"));
  return [
    { label: "Databases", value: sources.length, share: share(current.length, sources.length), note: "current release fetchable from code", href: "#sources" },
    { label: "Releases tracked", value: versions.length, share: share(linked.length, versions.length), note: "with a direct link", href: "#sources" },
    { label: "Direct links", value: linked.length, share: share(verified.length, linked.length), note: "confirmed against the source", href: "#status" },
    { label: "Datasets", value: datasets.length, share: share(withCode.length, datasets.length), note: "with download code", href: "#datasets" },
  ];
}

// Sequencing-style pileup for one track: short reads on three rows, laid
// left to right until they cover `share` of the track. Deterministic per seed.
export function pileup(share, seed) {
  let s = (seed * 2654435761) >>> 0;
  const rand = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const end = share * 100, reads = [];
  for (let row = 0; row < 3; row++) {
    let x = rand() * 2.5;
    while (x < end - 0.5) {
      const len = Math.min(3 + rand() * 6, end - x);
      reads.push({ row, x, w: len, reverse: rand() < 0.45 });
      x += len + 0.5 + rand() * 1.4;
    }
  }
  return reads;
}

// Fields x (databases, datasets, new papers). Shade compares fields within a
// column on a log scale, from the column minimum (0) to its maximum (1); rows are ordered by average-linkage clustering of
// those shades, so fields with a similar profile sit together.
export function fieldMatrix(fields, sources, datasets, paperCounts) {
  const columns = ["Databases", "Datasets", "New papers"];
  const counts = fields.map((f) => [
    sources.filter((s) => s.field === f.id).length,
    datasets.filter((d) => d.field === f.id).length,
    paperCounts ? paperCounts[f.id] || 0 : null,
  ]);
  // log scale, stretched from the smallest to the largest count of each column
  const lo = columns.map((_, c) => Math.min(...counts.map((r) => Math.log1p(r[c] || 0))));
  const hi = columns.map((_, c) => Math.max(...counts.map((r) => Math.log1p(r[c] || 0))));
  const shade = counts.map((r) => r.map((n, c) => (n == null ? null : hi[c] > lo[c] ? (Math.log1p(n) - lo[c]) / (hi[c] - lo[c]) : 0.5)));
  const known = columns.map((_, c) => counts.every((r) => r[c] != null));
  const tree = upgma(shade.map((r) => r.filter((_, c) => known[c])));
  const hrefs = (f) => [`#sources/${f.id}`, `#datasets/${f.id}`, `#latest/${f.id}`];
  return {
    columns,
    tree,
    order: leafOrder(tree),
    rows: fields.map((f, i) => ({ field: f, cells: counts[i].map((n, c) => ({ n, v: shade[i][c], href: hrefs(f)[c], kind: columns[c].toLowerCase() })) })),
  };
}
