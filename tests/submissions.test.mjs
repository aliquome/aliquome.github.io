// End-to-end test of reader suggestions, from sign-in to the updated table.
//
//   cd tests && npm install && node submissions.test.mjs
//   (CHROME_PATH=/path/to/chrome when Chrome is not in a usual place)
//
// Works on a temporary copy of data/, scripts/ and site/, with local stand-ins
// for Supabase (tests/mock-supabase.mjs) and GitHub (tests/mock-github.mjs):
//  1. a reader signs in with a one-time email code (wrong code refused)
//  2. suggests a ranking, adds a result with an uploaded PDF, corrects a value
//  3. row-level security: another reader cannot write for them, read their
//     rows, set a status or upload into their folder
//  4. scripts/sync-submissions.mjs opens one GitHub issue per valid suggestion
//     (no email in it) and rejects an invalid one with the reason
//  5. the maintainer approves three issues (scripts/apply-ranking.mjs, as the
//     workflow runs it) and declines one; the next sync records the outcomes
//  6. the rebuilt table shows the new ranking, the added and corrected rows,
//     and the reader sees "Applied" next to each suggestion
//  7. the GitHub issue form path and the merge rules of scripts/ranking-lib.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { parse } from "smol-toml";
import { startMockSupabase } from "./mock-supabase.mjs";
import { startMockGitHub } from "./mock-github.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const TABLE = "molecular-property-prediction-bbbp";

// ---------- tiny test harness ----------
let failures = 0, passes = 0;
const ok = (cond, msg) => { if (cond) { passes++; console.log(`  ok    ${msg}`); } else { failures++; console.log(`  FAIL  ${msg}`); } };
const step = (s) => console.log(`\n${s}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- a temporary copy of the repository ----------
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-test-"));
for (const d of ["data", "scripts", "site"]) fs.cpSync(path.join(REPO, d), path.join(WORK, d), { recursive: true });
fs.symlinkSync(path.join(HERE, "node_modules"), path.join(WORK, "node_modules"), "junction");
fs.writeFileSync(path.join(WORK, "data/rankings.toml"), fs.readFileSync(path.join(REPO, "data/rankings.toml"), "utf8").split(/^\[\[table\]\]/m)[0]);
fs.writeFileSync(path.join(WORK, "site/data/rankings.json"), "{}\n");
const rebuildRankings = () => fs.writeFileSync(path.join(WORK, "site/data/rankings.json"), JSON.stringify(parse(fs.readFileSync(path.join(WORK, "data/rankings.toml"), "utf8"))));

const supa = await startMockSupabase();
const gh = await startMockGitHub();
const html = path.join(WORK, "site/index.html");
fs.writeFileSync(html, fs.readFileSync(html, "utf8")
  .replace('<meta name="atlas-supabase-url" content="">', `<meta name="atlas-supabase-url" content="${supa.url}">`)
  .replace('<meta name="atlas-supabase-key" content="">', `<meta name="atlas-supabase-key" content="${supa.anonKey}">`)
  .replace('<meta name="atlas-repo" content="">', `<meta name="atlas-repo" content="https://github.com/${gh.repo}">`));

// static server for the site copy
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
const site = http.createServer((req, res) => {
  const p = path.join(WORK, "site", decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  if (!p.startsWith(path.join(WORK, "site")) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => site.listen(0, "127.0.0.1", r));
const SITE = `http://127.0.0.1:${site.address().port}`;

const env = { ...process.env, SUPABASE_URL: supa.url, SUPABASE_SERVICE_ROLE_KEY: supa.serviceKey, GITHUB_TOKEN: gh.token, GITHUB_REPOSITORY: gh.repo, GITHUB_API_URL: gh.url, SITE_URL: SITE, ATLAS_TEST_ALLOW_LOCAL: "1" };
// asynchronous on purpose: the stand-in servers live in this process and must keep answering
const run = (script, extra = {}) => new Promise((resolve) => {
  const c = spawn(process.execPath, [path.join(WORK, "scripts", script)], { cwd: WORK, env: { ...env, ...extra } });
  let stdout = "", stderr = "";
  c.stdout.on("data", (d) => (stdout += d));
  c.stderr.on("data", (d) => (stderr += d));
  c.on("close", (status) => resolve({ status, stdout, stderr }));
});

const chrome = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => fs.existsSync(p));
if (!chrome) { console.error("No Chrome found; set CHROME_PATH."); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
await page.setViewport({ width: 1280, height: 1000 });
const table = JSON.parse(fs.readFileSync(path.join(WORK, "data/benchmarks/pwc-chemistry.json"), "utf8")).tables.find((t) => t.id === TABLE);
const metric = table.metric;

async function openTable() {
  await page.goto(`${SITE}/?t=${Date.now()}#benchmarks/${TABLE}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#suggest .seg", { timeout: 60000 });
  await page.waitForSelector(".bench tbody tr", { timeout: 60000 });
}
const msg = () => page.$eval("#sg-msg", (e) => e.textContent);
const waitMsg = (re) => page.waitForFunction((src) => new RegExp(src).test(document.querySelector("#sg-msg")?.textContent || ""), { timeout: 15000 }, re.source).then(() => true, () => false);
const setValue = (sel, v) => page.$eval(sel, (e, x) => { e.value = x; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); }, v);
const kind = async (k) => { await page.$eval(`[data-kind="${k}"]`, (b) => b.click()); await wait(100); };
const send = async (re) => { await page.$eval("#sg-submit", (b) => b.click()); return waitMsg(re); };

try {
  // ---------------------------------------------------------------
  step("1. Sign in with a one-time email code");
  await openTable();
  ok(await page.$("#sg-email") !== null, "signed out: the panel asks for an email");
  ok(await page.$eval("#sg-submit", (b) => b.disabled), "the send button is disabled before sign-in");
  await setValue("#sg-email", "not-an-email");
  await page.$eval("#sg-codebtn", (b) => b.click());
  ok(await waitMsg(/valid email/), `an invalid email is refused before any request (${await msg()})`);
  await setValue("#sg-email", "Reader.One@Example.org");
  await page.$eval("#sg-codebtn", (b) => b.click());
  ok(await waitMsg(/We sent a code to reader\.one@example\.org/), "a code is sent (email lower-cased)");
  ok(supa.outbox.length === 1 && /^\d{6}$/.test(supa.outbox[0].code), "the email holds a six-digit code");
  await setValue("#sg-otp", "000000" === supa.lastCode("reader.one@example.org") ? "111111" : "000000");
  await page.$eval("#sg-verify", (b) => b.click());
  ok(await waitMsg(/expired or is invalid/), "a wrong code is refused");
  await setValue("#sg-otp", supa.lastCode("reader.one@example.org"));
  await page.$eval("#sg-verify", (b) => b.click());
  ok(await waitMsg(/Signed in/), "the right code signs the reader in");
  ok((await page.$eval("#sg-auth", (e) => e.textContent)).includes("reader.one@example.org"), "the panel shows who is signed in");
  const readerOne = [...supa.users.values()].find((u) => u.email === "reader.one@example.org");

  // ---------------------------------------------------------------
  step("2. Suggest a ranking, add a result with a PDF, correct a value");
  await kind("ranking");
  await setValue("#sg-reason", "Lower values should win here, for this test.");
  ok(await send(/already the approved ranking/), "an unchanged ranking is not sent");
  await page.select("#th", "0");
  await page.$eval("#tedit", (c) => c.click());
  const leaveOut = table.rows[1].model;
  await page.$eval(`[data-out="${leaveOut.replace(/"/g, '\\"')}"]`, (c) => c.click());
  await wait(150);
  ok((await page.$eval("#sg-preview", (e) => e.textContent)).includes("higher = false"), "the ranking preview follows the controls above the table");
  ok(await send(/Thank you/), "ranking suggestion sent");

  await kind("result");
  await setValue("#sg-reason", "Our new model, published this year.");
  await setValue("#sg-model", "TestNet");
  await setValue("#sg-paper", "TestNet: a model for testing");
  ok(await send(/link to the paper or upload/), "a result needs a paper link or a PDF");
  const pdf = path.join(WORK, "paper.pdf");
  fs.writeFileSync(pdf, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
  await (await page.$("#sg-pdf")).uploadFile(pdf);
  ok(await send(/at least one result/), "a result needs at least one value");
  await setValue("#sg-v0", "1.5");
  await setValue("#sg-code", "http://insecure.example.org/code");
  ok(await send(/code link must start with https/), "an http code link is refused");
  await setValue("#sg-code", "https://github.com/example/testnet");
  ok(await send(/Thank you/), "result suggestion sent with the PDF");
  ok(supa.files.size === 1 && [...supa.files.keys()][0].startsWith(readerOne.id + "/"), "the PDF is stored in the reader's own folder");

  await kind("fix");
  const fixModel = table.rows[2].model;
  await page.select("#sg-fmodel", fixModel);
  await setValue("#sg-reason", "The paper reports a different number in Table 2.");
  ok(await send(/Change at least one value/), "a correction must change a value");
  await setValue("#sg-f0", "88.8");
  await setValue("#sg-src", "https://example.org/paper-table-2");
  ok(await send(/Thank you/), "correction sent");

  await page.waitForFunction(() => document.querySelectorAll(".suggest-list li").length === 3, { timeout: 15000 }).catch(() => {});
  const statuses = await page.$$eval(".suggest-list li .status-text", (l) => l.map((x) => x.textContent));
  ok(statuses.length === 3 && statuses.every((s) => s.startsWith("Waiting")), `the reader sees 3 suggestions waiting (${statuses.join(" | ")})`);
  await openTable();
  ok((await page.$eval("#sg-auth", (e) => e.textContent)).includes("Signed in as"), "the sign-in survives a reload");

  // ---------------------------------------------------------------
  step("3. Row-level security");
  const headers = (t) => ({ apikey: supa.anonKey, Authorization: `Bearer ${t || supa.anonKey}`, "Content-Type": "application/json", Prefer: "return=representation" });
  await fetch(`${supa.url}/auth/v1/otp`, { method: "POST", headers: headers(), body: JSON.stringify({ email: "reader.two@example.org", create_user: true }) });
  const two = await (await fetch(`${supa.url}/auth/v1/verify`, { method: "POST", headers: headers(), body: JSON.stringify({ type: "email", email: "reader.two@example.org", token: supa.lastCode("reader.two@example.org") }) })).json();
  const insert = (token, row) => fetch(`${supa.url}/rest/v1/submissions`, { method: "POST", headers: headers(token), body: JSON.stringify(row) });
  const base = { kind: "ranking", table_id: TABLE, proposal: { higher: true }, reason: "A reason that is long enough." };
  ok((await insert(null, base)).status === 401, "no sign-in: insert refused");
  ok((await insert(two.access_token, { ...base, user_id: readerOne.id })).status === 403, "cannot submit in another reader's name");
  ok((await insert(two.access_token, { ...base, status: "applied" })).status === 403, "cannot set a status");
  ok((await insert(two.access_token, { ...base, paper_path: `${readerOne.id}/${crypto.randomUUID()}.pdf` })).status === 403, "cannot point at another reader's PDF");
  ok((await insert(two.access_token, { ...base, reason: "short" })).status === 400, "a reason under 10 characters is refused");
  const seen = await (await fetch(`${supa.url}/rest/v1/submissions?select=*`, { headers: headers(two.access_token) })).json();
  ok(Array.isArray(seen) && seen.length === 0, "cannot read another reader's suggestions");
  const patch = await (await fetch(`${supa.url}/rest/v1/submissions?status=eq.pending`, { method: "PATCH", headers: headers(two.access_token), body: JSON.stringify({ status: "applied" }) })).json();
  ok(patch.length === 0 && supa.rows.every((r) => r.status === "pending"), "cannot change any status");
  const up = await fetch(`${supa.url}/storage/v1/object/papers/${readerOne.id}/${crypto.randomUUID()}.pdf`, { method: "POST", headers: { apikey: supa.anonKey, Authorization: `Bearer ${two.access_token}`, "Content-Type": "application/pdf" }, body: "%PDF-1.4" });
  ok(up.status === 403, "cannot upload into another reader's folder");
  ok((await insert(two.access_token, { kind: "ranking", table_id: TABLE, proposal: { metric: "No such metric" }, reason: "This metric does not exist." })).status === 201, "reader two sends an invalid suggestion (accepted for review)");
  const other = JSON.parse(fs.readFileSync(path.join(WORK, "data/benchmarks/pwc-proteins.json"), "utf8")).tables[0];
  ok((await insert(two.access_token, { kind: "ranking", table_id: other.id, proposal: { higher: false }, reason: "A valid suggestion the maintainer declines." })).status === 201, "reader two sends a valid suggestion for another table");

  // ---------------------------------------------------------------
  step("4. Sync: valid suggestions become GitHub issues");
  let r = await run("sync-submissions.mjs");
  ok(r.status === 0, `sync runs (${(r.stdout + r.stderr).trim()})`);
  ok(gh.issues.length === 4, `4 issues opened (got ${gh.issues.length})`);
  ok(gh.issues.every((i) => i.labels.some((l) => l.name === "ranking") && /```toml\n\[\[table\]\]/.test(i.body)), "each issue has the ranking label and a TOML block");
  ok(gh.issues.every((i) => !/example\.org/.test(i.body.replace(/https:\/\/example\.org\/paper-table-2/, ""))), "no email address in any issue");
  const bad = supa.rows.find((x) => x.proposal.metric === "No such metric");
  ok(bad.status === "rejected" && /no metric named/.test(bad.review_note), `invalid suggestion rejected with the reason (${bad.review_note})`);
  const mine = supa.rows.filter((x) => x.user_id === readerOne.id);
  ok(mine.every((x) => x.status === "queued" && x.issue_number), "the reader's suggestions are queued with an issue number");
  const resultIssue = gh.issues.find((i) => i.title.startsWith("New result"));
  ok(resultIssue && resultIssue.body.includes(`${supa.url}/storage/v1/object/public/papers/`), "the result issue links the uploaded PDF");
  r = await run("sync-submissions.mjs");
  ok(gh.issues.length === 4, "a second sync opens no duplicate issues");

  // ---------------------------------------------------------------
  step("5. The maintainer approves three issues and declines one");
  for (const x of mine) {
    const issue = gh.issues[x.issue_number - 1];
    gh.approve(issue.number);
    const res = await run("apply-ranking.mjs", { ISSUE_BODY: issue.body, ISSUE_NUMBER: String(issue.number), APPROVER: "owner" });
    ok(res.status === 0 && fs.readFileSync(path.join(WORK, ".ranking-result"), "utf8").startsWith("ok"), `issue ${issue.number} applied (${issue.title})`);
    gh.close(issue.number);
  }
  const declined = supa.rows.find((x) => x.table_id === other.id);
  gh.close(declined.issue_number);
  r = await run("sync-submissions.mjs");
  ok(r.status === 0, `sync after review (${r.stdout.trim()})`);
  ok(mine.every((x) => x.status === "applied"), "the reader's three suggestions are marked applied");
  ok(declined.status === "rejected" && /without approval/.test(declined.review_note), "the declined one is marked not applied");

  const block = parse(fs.readFileSync(path.join(WORK, "data/rankings.toml"), "utf8")).table.find((t) => t.id === TABLE);
  ok(block.higher === false && block.exclude?.[0] === leaveOut, "rankings.toml: new order and the left-out model");
  ok(block.add?.length === 1 && block.add[0].model === "TestNet" && block.add[0].code === "https://github.com/example/testnet", "rankings.toml: the added result");
  ok(block.fix?.[0]?.model === fixModel && block.fix[0].values[metric] === 88.8, "rankings.toml: the correction");
  ok(block.approved.length === 3, "rankings.toml: all three approvals kept, none overwritten");

  // ---------------------------------------------------------------
  step("6. The rebuilt table");
  rebuildRankings();
  await openTable();
  const rows = await page.$$eval(".bench tbody tr", (trs) => trs.map((tr) => ({ rank: tr.children[0].textContent.trim(), model: tr.children[1].querySelector("b").textContent, tags: tr.children[1].textContent, value: tr.children[2].textContent.trim() })));
  const num = (s) => parseFloat(String(s).replace(/[%,\s]/g, ""));
  const ranked = rows.filter((x) => /^\d+$/.test(x.rank));
  ok(ranked.every((x, i) => i === 0 || num(ranked[i - 1].value) <= num(x.value)), "rows are in the approved order (lower is better)");
  ok(rows.find((x) => x.model === leaveOut)?.rank === "out", "the left-out model is out of the ranking");
  const added = rows.find((x) => x.model === "TestNet");
  ok(added && added.rank === "1" && /added/.test(added.tags), `the added result is ranked first with value 1.5 (rank ${added?.rank})`);
  const fixed = rows.find((x) => x.model === fixModel);
  ok(fixed && fixed.value.includes("88.8") && /corrected/.test(fixed.tags), "the corrected value is shown and marked");
  ok((await page.$eval("#tstatus", (e) => e.textContent)).includes(`#${mine.at(-1).issue_number} by owner`), "the status line names the last approval");
  await page.waitForFunction(() => document.querySelectorAll(".suggest-list .status-text").length >= 3, { timeout: 15000 }).catch(() => {});
  const after = await page.$$eval(".suggest-list li .status-text", (l) => l.map((x) => x.textContent));
  ok(after.length === 3 && after.every((s) => s.startsWith("Applied")), `the reader sees Applied on all three (${after.join(" | ")})`);
  await page.evaluate(() => { location.hash = "#benchmarks/model/testnet"; });
  await page.waitForSelector("#prows tr", { timeout: 15000 });
  ok((await page.$eval("#prows", (e) => e.textContent)).includes("1st"), "TestNet has a model page with its first place");
  await page.setViewport({ width: 390, height: 900 });
  await page.evaluate(() => { location.hash = "#benchmarks/molecular-property-prediction-bbbp"; });
  await page.waitForSelector("#suggest .seg", { timeout: 15000 });
  ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "no sideways scroll on a phone");

  // ---------------------------------------------------------------
  step("7. Issue form path and merge rules");
  const formBody = ["### Table id", "", TABLE, "", "### Proposed ranking", "", "```toml", "[[table]]", `id = "${TABLE}"`, "", "[[table.add]]", 'model = "SecondNet"', 'paper = "Another paper"', 'url = "https://doi.org/10.1/x"', `values = { ${JSON.stringify(metric)} = 2.5 }`, "```", "", "### Why", "", "x"].join("\n");
  r = await run("apply-ranking.mjs", { ISSUE_BODY: formBody, ISSUE_NUMBER: "99", APPROVER: "owner" });
  const merged = parse(fs.readFileSync(path.join(WORK, "data/rankings.toml"), "utf8")).table.find((t) => t.id === TABLE);
  ok(r.status === 0 && merged.add.length === 2 && merged.higher === false && merged.fix.length === 1, "a GitHub form proposal adds to the earlier approvals instead of replacing them");
  for (const [name, toml, re] of [
    ["unknown key", `[[table]]\nid = "${TABLE}"\nscript = "x"`, /Key not allowed/],
    ["javascript link", `[[table]]\nid = "${TABLE}"\n[[table.add]]\nmodel = "X"\npaper = "P"\nurl = "javascript:alert(1)"\nvalues = { ${JSON.stringify(metric)} = 1 }`, /https link/],
    ["unknown table", `[[table]]\nid = "nope"\nhigher = true`, /Unknown table/],
    ["text value", `[[table]]\nid = "${TABLE}"\n[[table.fix]]\nmodel = ${JSON.stringify(fixModel)}\nsource = "https://x.org/a"\nvalues = { ${JSON.stringify(metric)} = "high" }`, /must be a number/],
    ["two blocks", `[[table]]\nid = "${TABLE}"\nhigher = true\n[[table]]\nid = "${TABLE}"\nhigher = false`, /exactly one/],
  ]) {
    const res = await run("apply-ranking.mjs", { ISSUE_BODY: "```toml\n" + toml + "\n```", ISSUE_NUMBER: "100", APPROVER: "owner" });
    ok(res.status === 1 && re.test(fs.readFileSync(path.join(WORK, ".ranking-result"), "utf8")), `refused: ${name}`);
  }
  ok(pageErrors.length === 0, `no errors in the page${pageErrors.length ? ": " + pageErrors.join(" | ") : ""}`);
} catch (e) {
  failures++;
  console.log("  FAIL  the test stopped:", e.stack || e.message);
} finally {
  await browser.close();
  await supa.close();
  await gh.stop();
  site.close();
  // remove the link first, so deleting the copy never follows it into tests/node_modules
  fs.unlinkSync(path.join(WORK, "node_modules"));
  fs.rmSync(WORK, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
