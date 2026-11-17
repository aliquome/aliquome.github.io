// Applies an approved ranking proposal (a GitHub issue made from the
// "Ranking change" form) to data/rankings.toml.
//
//   ISSUE_BODY=... ISSUE_NUMBER=12 APPROVER=login node scripts/apply-ranking.mjs
//
// The issue text is untrusted input: it is only parsed as TOML, every key is
// checked against the table it names, and nothing from it is executed.
import fs from "node:fs";
import path from "node:path";
import { parse } from "smol-toml";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const fail = (msg) => { fs.writeFileSync(path.join(ROOT, ".ranking-result"), `error: ${msg}\n`); console.error(msg); process.exit(1); };

const body = process.env.ISSUE_BODY || "";
const issue = Number(process.env.ISSUE_NUMBER || 0);
const approver = (process.env.APPROVER || "").replace(/[^\w-]/g, "");

// the form renders the proposal as a ```toml fenced block
const block = body.match(/```toml\s*\n([\s\S]*?)```/);
if (!block) fail("No ```toml block found in the issue.");
if (block[1].length > 20000) fail("The proposal is too long.");
let proposal;
try { proposal = parse(block[1]); } catch (e) { fail(`The proposal is not valid TOML: ${e.message.split("\n")[0]}`); }
const list = proposal.table;
if (!Array.isArray(list) || list.length !== 1) fail("The proposal must hold exactly one [[table]] block.");
const p = list[0];

// find the table
const dir = path.join(ROOT, "data/benchmarks");
let table = null;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const t = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).tables?.find((x) => x.id === p.id);
  if (t) { table = t; break; }
}
if (typeof p.id !== "string" || !table) fail(`Unknown table id: ${String(p.id).slice(0, 80)}`);

const allowed = new Set(["id", "metric", "higher", "exclude", "note", "add"]);
for (const k of Object.keys(p)) if (!allowed.has(k)) fail(`Key not allowed: ${k}`);
const metrics = new Set(table.metrics.map((m) => m.name));
const models = new Set(table.rows.map((r) => r.model));
const str = (v, max, what) => { if (typeof v !== "string" || !v.trim() || v.length > max) fail(`${what} must be a string of at most ${max} characters.`); return v.trim(); };
const url = (v, what) => { const s = str(v, 500, what); if (!/^https:\/\/[^\s"'<>]+$/.test(s)) fail(`${what} must be an https link.`); return s; };

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
    for (const k of Object.keys(a)) if (!["model", "paper", "url", "code", "values", "date"].includes(k)) fail(`Key not allowed in add #${i + 1}: ${k}`);
    const row = { model: str(a.model, 300, "model"), paper: str(a.paper, 500, "paper"), url: url(a.url, "url") };
    if (a.code !== undefined) row.code = url(a.code, "code");
    if (a.date !== undefined) { row.date = str(a.date, 10, "date"); if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) fail("date must look like 2025-01-31."); }
    if (typeof a.values !== "object" || !a.values || Array.isArray(a.values)) fail(`add #${i + 1} needs values = { "metric" = number }.`);
    row.values = {};
    for (const [k, v] of Object.entries(a.values)) {
      if (!metrics.has(k)) fail(`The table has no metric named "${k}".`);
      if (typeof v !== "number" || !Number.isFinite(v)) fail(`The value of "${k}" must be a number.`);
      row.values[k] = v;
    }
    if (!Object.keys(row.values).length) fail(`add #${i + 1} has no values.`);
    return row;
  });
}
if (p.note !== undefined) clean.note = str(p.note, 1000, "note");
if (Object.keys(clean).length === 1) fail("The proposal changes nothing.");
clean.approved = `#${issue} by ${approver} on ${new Date().toISOString().slice(0, 10)}`;

// merge into rankings.toml: one block per table, the newest approval wins
const file = path.join(ROOT, "data/rankings.toml");
const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
const header = text.split(/^\[\[table\]\]/m)[0] || "";
const current = text.trim() ? parse(text).table || [] : [];
const next = [...current.filter((t) => t.id !== clean.id), clean].sort((a, b) => a.id.localeCompare(b.id));

const q = (v) => JSON.stringify(v);
const key = (k) => (/^[A-Za-z0-9_-]+$/.test(k) ? k : q(k));
const blocks = next.map((t) => {
  const lines = ["[[table]]", `id = ${q(t.id)}`];
  if (t.metric !== undefined) lines.push(`metric = ${q(t.metric)}`);
  if (t.higher !== undefined) lines.push(`higher = ${t.higher}`);
  if (t.exclude) lines.push(`exclude = [${t.exclude.map(q).join(", ")}]`);
  if (t.note !== undefined) lines.push(`note = ${q(t.note)}`);
  lines.push(`approved = ${q(t.approved)}`);
  for (const a of t.add || []) {
    lines.push("", "[[table.add]]", `model = ${q(a.model)}`, `paper = ${q(a.paper)}`, `url = ${q(a.url)}`);
    if (a.code) lines.push(`code = ${q(a.code)}`);
    if (a.date) lines.push(`date = ${q(a.date)}`);
    lines.push(`values = { ${Object.entries(a.values).map(([k, v]) => `${key(k)} = ${v}`).join(", ")} }`);
  }
  return lines.join("\n");
});
fs.writeFileSync(file, `${header.trimEnd()}\n\n${blocks.join("\n\n")}\n`);
parse(fs.readFileSync(file, "utf8")); // the result must still be valid TOML
fs.writeFileSync(path.join(ROOT, ".ranking-result"), `ok: ${clean.id}\n`);
console.log(`Applied ranking change for ${clean.id}`);
