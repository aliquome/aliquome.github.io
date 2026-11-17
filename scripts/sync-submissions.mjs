// Moves reader submissions from Supabase to GitHub and reports back.
//
//   pending  -> checked with scripts/ranking-lib.mjs
//               valid:   a GitHub issue (labels: ranking, from-site), status "queued"
//               invalid: status "rejected" with the reason
//   queued   -> once its issue is closed: "applied" if the change is in
//               data/rankings.toml, otherwise "rejected"
//
// Environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GITHUB_TOKEN,
// GITHUB_REPOSITORY (owner/name), GITHUB_API_URL (default https://api.github.com),
// SITE_URL (optional, for links to the table in the issue).
// The submitter's email is never written to GitHub.
import fs from "node:fs";
import path from "node:path";
import { ROOT, ProposalError, validateProposal, proposalToToml, findTable } from "./ranking-lib.mjs";

const SUPA = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const GH = (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "");
const REPO = process.env.GITHUB_REPOSITORY || "";
const TOKEN = process.env.GITHUB_TOKEN || "";
const SITE = (process.env.SITE_URL || "").replace(/\/$/, "");
if (!SUPA || !KEY) { console.log("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set; nothing to do."); process.exit(0); }
if (!REPO || !TOKEN) { console.error("GITHUB_REPOSITORY and GITHUB_TOKEN are required."); process.exit(1); }

async function call(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`${opts.method || "GET"} ${url.replace(/\?.*/, "")}: HTTP ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}
const supa = (p, opts = {}) => call(`${SUPA}/rest/v1/${p}`, { ...opts, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=representation", ...(opts.headers || {}) } });
const gh = (p, opts = {}) => call(`${GH}${p}`, { ...opts, headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", ...(opts.headers || {}) } });
const setStatus = (id, fields) => supa(`submissions?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(fields) });

// keys each kind of submission may use
const KIND_KEYS = { ranking: ["metric", "higher", "exclude", "note"], result: ["add", "note"], fix: ["fix", "note"] };
// reader text goes into a public issue: no @mentions, no raw HTML, bounded length
const quoteText = (s) => String(s).slice(0, 4000).replace(/@/g, "@​").replace(/</g, "&lt;").split("\n").map((l) => `> ${l}`).join("\n");
const paperUrl = (p) => `${SUPA}/storage/v1/object/public/papers/${p}`;

function check(sub) {
  if (!KIND_KEYS[sub.kind]) throw new ProposalError(`Unknown kind: ${sub.kind}`);
  const p = { ...(sub.proposal || {}) };
  delete p.id;
  for (const k of Object.keys(p)) if (!KIND_KEYS[sub.kind].includes(k)) throw new ProposalError(`A ${sub.kind} suggestion cannot set "${k}".`);
  if (sub.kind === "result" && sub.paper_path) for (const a of p.add || []) if (!a.url) a.url = paperUrl(sub.paper_path);
  return validateProposal({ id: sub.table_id, ...p });
}

function issueBody(sub, clean) {
  const t = findTable(clean.id);
  const what = { ranking: "a different ranking", result: "a new result", fix: "a correction to published values" }[sub.kind];
  return [
    `<!-- submission: ${sub.id} -->`,
    `A reader signed in on the site and suggests ${what} for **${t.task}** on **${t.dataset}** (\`${clean.id}\`).`,
    SITE ? `Table: ${SITE}/#benchmarks/${clean.id}` : "",
    sub.paper_path ? `Uploaded paper: ${paperUrl(sub.paper_path)}` : "",
    "",
    "### Why",
    "",
    quoteText(sub.reason),
    "",
    "### Proposed change",
    "",
    "```toml",
    proposalToToml(clean),
    "```",
    "",
    "Add the `approved` label to apply it, or close the issue to decline. The submitter's email is not published.",
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
}

const rankings = fs.existsSync(path.join(ROOT, "data/rankings.toml")) ? fs.readFileSync(path.join(ROOT, "data/rankings.toml"), "utf8") : "";
let opened = 0, rejected = 0, applied = 0, closed = 0;

for (const sub of await supa("submissions?status=eq.pending&order=created_at.asc&limit=50&select=*")) {
  let clean;
  try { clean = check(sub); } catch (e) {
    if (!(e instanceof ProposalError)) throw e;
    await setStatus(sub.id, { status: "rejected", review_note: e.message.slice(0, 500) });
    rejected++;
    continue;
  }
  const t = findTable(clean.id);
  const title = `${{ ranking: "Ranking", result: "New result", fix: "Correction" }[sub.kind]}: ${t.task} on ${t.dataset}`.slice(0, 200);
  const issue = await gh(`/repos/${REPO}/issues`, { method: "POST", body: JSON.stringify({ title, body: issueBody(sub, clean), labels: ["ranking", "from-site"] }) });
  await setStatus(sub.id, { status: "queued", issue_number: issue.number, review_note: null });
  opened++;
}

for (const sub of await supa("submissions?status=eq.queued&order=created_at.asc&limit=100&select=id,issue_number")) {
  const issue = await gh(`/repos/${REPO}/issues/${sub.issue_number}`);
  if (issue.state !== "closed") continue;
  if (new RegExp(`"#${sub.issue_number} by `).test(rankings)) {
    await setStatus(sub.id, { status: "applied", review_note: null });
    applied++;
  } else {
    await setStatus(sub.id, { status: "rejected", review_note: "Closed by a maintainer without approval." });
    closed++;
  }
}
console.log(`opened ${opened} issues, rejected ${rejected} invalid, marked ${applied} applied, ${closed} declined`);
