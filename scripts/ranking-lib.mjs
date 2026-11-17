// Shared rules for changes to the results tables. Used by
//   scripts/apply-ranking.mjs     (an approved GitHub issue -> data/rankings.toml)
//   scripts/sync-submissions.mjs  (signed-in submissions -> GitHub issues)
// Everything a reader sends is untrusted: it is only parsed and checked here,
// never executed, and only the keys below can reach data/rankings.toml.
import fs from "node:fs";
import path from "node:path";
import { parse } from "smol-toml";

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");

export class ProposalError extends Error {}
const fail = (msg) => { throw new ProposalError(msg); };

export function findTable(id, root = ROOT) {
  const dir = path.join(root, "data/benchmarks");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const t = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).tables?.find((x) => x.id === id);
    if (t) return t;
  }
  return null;
}

const str = (v, max, what) => {
  if (typeof v !== "string" || !v.trim() || v.length > max) fail(`${what} must be text of at most ${max} characters.`);
  return v.trim();
};
// the end-to-end test (tests/submissions.test.mjs) serves uploads from a local
// http server; only that test sets ATLAS_TEST_ALLOW_LOCAL
const LOCAL_OK = process.env.ATLAS_TEST_ALLOW_LOCAL === "1";
const https = (v, what) => {
  const s = str(v, 500, what);
  if (!/^https:\/\/[^\s"'<>]+$/.test(s) && !(LOCAL_OK && /^http:\/\/127\.0\.0\.1:\d+\/[^\s"'<>]+$/.test(s))) fail(`${what} must be an https link.`);
  return s;
};
const values = (v, metrics, what) => {
  if (typeof v !== "object" || !v || Array.isArray(v)) fail(`${what} needs values = { "metric" = number }.`);
  const out = {};
  for (const [k, x] of Object.entries(v)) {
    if (!metrics.has(k)) fail(`The table has no metric named "${k}".`);
    if (typeof x !== "number" || !Number.isFinite(x)) fail(`The value of "${k}" must be a number.`);
    out[k] = x;
  }
  if (!Object.keys(out).length) fail(`${what} has no values.`);
  return out;
};
const only = (obj, keys, what) => { for (const k of Object.keys(obj)) if (!keys.includes(k)) fail(`Key not allowed${what ? ` in ${what}` : ""}: ${k}`); };

// Check one proposal object ({ id, metric?, higher?, exclude?, note?, add?, fix? })
// against its table and return a clean copy.
export function validateProposal(p, root = ROOT) {
  if (!p || typeof p !== "object" || Array.isArray(p)) fail("The proposal must be one [[table]] block.");
  if (typeof p.id !== "string") fail("The proposal needs the table id.");
  const table = findTable(p.id, root);
  if (!table) fail(`Unknown table id: ${String(p.id).slice(0, 80)}`);
  only(p, ["id", "metric", "higher", "exclude", "note", "add", "fix"]);
  const metrics = new Set(table.metrics.map((m) => m.name));
  const models = new Set(table.rows.map((r) => r.model));
  const clean = { id: p.id };
  if (p.metric !== undefined) { clean.metric = str(p.metric, 200, "metric"); if (!metrics.has(clean.metric)) fail(`The table has no metric named "${clean.metric}".`); }
  if (p.higher !== undefined) { if (typeof p.higher !== "boolean") fail("higher must be true or false."); clean.higher = p.higher; }
  if (p.exclude !== undefined) {
    if (!Array.isArray(p.exclude) || p.exclude.length > 200) fail("exclude must be a list of model names.");
    clean.exclude = p.exclude.map((m) => str(m, 300, "excluded model"));
    for (const m of clean.exclude) if (!models.has(m)) fail(`The table has no model named "${m}".`);
  }
  if (p.add !== undefined) {
    if (!Array.isArray(p.add) || p.add.length > 50) fail("add must be a list of [[table.add]] blocks.");
    clean.add = p.add.map((a, i) => {
      const what = `add #${i + 1}`;
      if (typeof a !== "object" || !a) fail(`${what} must be a block.`);
      only(a, ["model", "paper", "url", "code", "values", "date"], what);
      const row = { model: str(a.model, 300, "model"), paper: str(a.paper, 500, "paper"), url: https(a.url, "url") };
      if (a.code !== undefined) row.code = https(a.code, "code");
      if (a.date !== undefined) { row.date = str(a.date, 10, "date"); if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) fail("date must look like 2025-01-31."); }
      row.values = values(a.values, metrics, what);
      return row;
    });
  }
  if (p.fix !== undefined) {
    if (!Array.isArray(p.fix) || p.fix.length > 50) fail("fix must be a list of [[table.fix]] blocks.");
    clean.fix = p.fix.map((a, i) => {
      const what = `fix #${i + 1}`;
      if (typeof a !== "object" || !a) fail(`${what} must be a block.`);
      only(a, ["model", "values", "source"], what);
      const row = { model: str(a.model, 300, "model"), source: https(a.source, "source"), values: values(a.values, metrics, what) };
      if (!models.has(row.model)) fail(`The table has no model named "${row.model}".`);
      return row;
    });
  }
  if (p.note !== undefined) clean.note = str(p.note, 1000, "note");
  if (Object.keys(clean).length === 1) fail("The proposal changes nothing.");
  return clean;
}

// The ```toml block of an issue body -> one validated proposal.
export function proposalFromText(body, root = ROOT) {
  const block = String(body || "").match(/```toml\s*\n([\s\S]*?)```/);
  if (!block) fail("No ```toml block found.");
  if (block[1].length > 20000) fail("The proposal is too long.");
  let doc;
  try { doc = parse(block[1]); } catch (e) { fail(`The proposal is not valid TOML: ${e.message.split("\n")[0]}`); }
  if (!Array.isArray(doc.table) || doc.table.length !== 1) fail("The proposal must hold exactly one [[table]] block.");
  return validateProposal(doc.table[0], root);
}

const q = (v) => JSON.stringify(v);
const key = (k) => (/^[A-Za-z0-9_-]+$/.test(k) ? k : q(k));
const inline = (v) => `{ ${Object.entries(v).map(([k, x]) => `${key(k)} = ${x}`).join(", ")} }`;

// One proposal as a TOML [[table]] block (for issues and for the file).
export function proposalToToml(t) {
  const lines = ["[[table]]", `id = ${q(t.id)}`];
  if (t.metric !== undefined) lines.push(`metric = ${q(t.metric)}`);
  if (t.higher !== undefined) lines.push(`higher = ${t.higher}`);
  if (t.exclude?.length) lines.push(`exclude = [${t.exclude.map(q).join(", ")}]`);
  if (t.note !== undefined) lines.push(`note = ${q(t.note)}`);
  if (t.approved?.length) lines.push(`approved = [${t.approved.map(q).join(", ")}]`);
  for (const a of t.add || []) {
    lines.push("", "[[table.add]]", `model = ${q(a.model)}`, `paper = ${q(a.paper)}`, `url = ${q(a.url)}`);
    if (a.code) lines.push(`code = ${q(a.code)}`);
    if (a.date) lines.push(`date = ${q(a.date)}`);
    lines.push(`values = ${inline(a.values)}`);
  }
  for (const f of t.fix || []) lines.push("", "[[table.fix]]", `model = ${q(f.model)}`, `source = ${q(f.source)}`, `values = ${inline(f.values)}`);
  return lines.join("\n");
}

// Merge an approved proposal into the table's existing block: settings are
// replaced, added results and corrections accumulate, and every approval is kept.
export function mergeProposal(current, clean, approval) {
  const prev = current.find((t) => t.id === clean.id) || { id: clean.id };
  const next = { ...prev };
  for (const k of ["metric", "higher", "exclude", "note"]) if (clean[k] !== undefined) next[k] = clean[k];
  if (clean.add) {
    const same = (a, b) => a.model === b.model && a.paper === b.paper;
    next.add = [...(prev.add || []).filter((a) => !clean.add.some((b) => same(a, b))), ...clean.add];
  }
  if (clean.fix) {
    const fixes = [...(prev.fix || [])];
    for (const f of clean.fix) {
      const i = fixes.findIndex((x) => x.model === f.model);
      if (i < 0) fixes.push(f);
      else fixes[i] = { model: f.model, source: f.source, values: { ...fixes[i].values, ...f.values } };
    }
    next.fix = fixes;
  }
  const before = Array.isArray(prev.approved) ? prev.approved : prev.approved ? [prev.approved] : [];
  next.approved = [...before, approval];
  return [...current.filter((t) => t.id !== clean.id), next].sort((a, b) => a.id.localeCompare(b.id));
}

export function writeRankings(file, list) {
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const header = text.split(/^\[\[table\]\]/m)[0] || "";
  fs.writeFileSync(file, `${header.trimEnd()}\n\n${list.map(proposalToToml).join("\n\n")}\n`);
  parse(fs.readFileSync(file, "utf8")); // the result must still be valid TOML
}

export function readRankings(file) {
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  return text.trim() ? parse(text).table || [] : [];
}
