// "Suggest a change" panel of a results table: sign in with an email code,
// then propose a ranking, add a result (with a link or an uploaded PDF), or
// correct a published value. Suggestions are reviewed before they appear.
import * as api from "../services/submit.js";

const KINDS = [
  ["ranking", "Ranking"],
  ["result", "Add a result"],
  ["fix", "Correct a value"],
];
const STATUS = {
  pending: "Waiting for the automatic checks",
  queued: "With the maintainers",
  applied: "Applied to the table",
  rejected: "Not applied",
};
const HTTPS = /^https:\/\/[^\s"'<>]+$/;

// the same TOML the review scripts read (scripts/ranking-lib.mjs)
function toToml(id, p) {
  const q = JSON.stringify;
  const key = (k) => (/^[A-Za-z0-9_-]+$/.test(k) ? k : q(k));
  const inline = (v) => `{ ${Object.entries(v).map(([k, x]) => `${key(k)} = ${x}`).join(", ")} }`;
  const lines = ["[[table]]", `id = ${q(id)}`];
  if (p.metric !== undefined) lines.push(`metric = ${q(p.metric)}`);
  if (p.higher !== undefined) lines.push(`higher = ${p.higher}`);
  if (p.exclude?.length) lines.push(`exclude = [${p.exclude.map(q).join(", ")}]`);
  if (p.note) lines.push(`note = ${q(p.note)}`);
  for (const a of p.add || []) {
    lines.push("", "[[table.add]]", `model = ${q(a.model)}`, `paper = ${q(a.paper)}`, `url = ${q(a.url || "https://")}`);
    if (a.code) lines.push(`code = ${q(a.code)}`);
    if (a.date) lines.push(`date = ${q(a.date)}`);
    lines.push(`values = ${inline(a.values)}`);
  }
  for (const f of p.fix || []) lines.push("", "[[table.fix]]", `model = ${q(f.model)}`, `source = ${q(f.source)}`, `values = ${inline(f.values)}`);
  return lines.join("\n");
}

export function mountSuggest(el, { t, view, base, repo, esc }) {
  const rankable = t.metrics.filter((m) => m.parsed >= 2).map((m) => m.name);
  let kind = "ranking", step = "email", email = "", busy = false;

  el.innerHTML = `
    <h2>Suggest a change</h2>
    <p>Rank the table differently, add a result from your own paper, or correct a published value. A maintainer reviews every suggestion before it appears.${api.enabled() ? " Sign in with your email: we send you a one-time code, no password. Your suggestion is published as a GitHub issue; your email is not." : ""}</p>
    <div class="seg" role="group" aria-label="Kind of change">${KINDS.map(([k, l]) => `<button type="button" data-kind="${k}" aria-pressed="${k === kind}">${l}</button>`).join("")}</div>
    <div class="suggest-body" id="sg-body"></div>
    <label for="sg-reason">Why</label>
    <textarea class="input" id="sg-reason" rows="3" placeholder="What the change fixes or adds, and where the numbers come from."></textarea>
    <div class="suggest-auth" id="sg-auth"></div>
    <div class="export-actions" id="sg-send"></div>
    <p class="suggest-msg" id="sg-msg" role="status" aria-live="polite"></p>
    <div id="sg-mine"></div>`;
  const $ = (id) => el.querySelector(`#${id}`);
  const say = (text, bad = false) => { const m = $("sg-msg"); m.textContent = text; m.classList.toggle("bad", bad); };

  const body = () => {
    if (kind === "ranking") {
      $("sg-body").innerHTML = `<p class="hint">Use the controls above the table: the metric, the order, and “Choose rows to leave out”. This suggestion sends the ranking you see now.</p><pre class="suggest-preview" id="sg-preview"></pre>`;
    } else if (kind === "result") {
      $("sg-body").innerHTML = `<div class="suggest-grid">
        <div class="control"><label for="sg-model">Model name</label><input class="input" id="sg-model" maxlength="300" autocomplete="off"></div>
        <div class="control"><label for="sg-paper">Paper title</label><input class="input" id="sg-paper" maxlength="500"></div>
        <div class="control"><label for="sg-url">Link to the paper</label><input class="input" id="sg-url" type="url" placeholder="https://doi.org/…"></div>
        <div class="control"><label for="sg-pdf">Or upload the PDF</label><input class="input" id="sg-pdf" type="file" accept="application/pdf,.pdf"${api.enabled() ? "" : " disabled"}></div>
        <div class="control"><label for="sg-code">Code (optional)</label><input class="input" id="sg-code" type="url" placeholder="https://github.com/…"></div>
        <div class="control"><label for="sg-date">Publication date (optional)</label><input class="input" id="sg-date" type="date"></div>
      </div>
      <p class="hint">Results on this table's metrics. Fill in at least one.</p>
      <div class="suggest-grid">${rankable.map((m, i) => `<div class="control"><label for="sg-v${i}">${esc(m)}</label><input class="input" id="sg-v${i}" data-metric="${esc(m)}" inputmode="decimal" placeholder="number"></div>`).join("")}</div>`;
    } else {
      $("sg-body").innerHTML = `<div class="suggest-grid">
        <div class="control"><label for="sg-fmodel">Model</label><select class="input" id="sg-fmodel">${t.rows.map((r) => `<option>${esc(r.model)}</option>`).join("")}</select></div>
        <div class="control"><label for="sg-src">Source of the correct values</label><input class="input" id="sg-src" type="url" placeholder="https://… (the paper or its results file)"></div>
      </div>
      <p class="hint">Change only the values that are wrong.</p>
      <div class="suggest-grid" id="sg-fixvals"></div>`;
      const fill = () => {
        const r = t.rows.find((x) => x.model === $("sg-fmodel").value);
        $("sg-fixvals").innerHTML = rankable.map((m, i) => `<div class="control"><label for="sg-f${i}">${esc(m)}</label><input class="input" id="sg-f${i}" data-metric="${esc(m)}" data-was="${esc(r?.values[m] ?? "")}" value="${esc(r?.values[m] ?? "")}" inputmode="decimal"></div>`).join("");
      };
      $("sg-fmodel").addEventListener("change", fill);
      fill();
    }
    refresh();
  };

  const numberOf = (s) => { const x = parseFloat(String(s).replace(/[%,\s]/g, "").replace(/±.*$/, "")); return Number.isFinite(x) ? x : null; };

  // read the form into a proposal; throws a readable message when something is missing
  const collect = (forPreview = false) => {
    if (kind === "ranking") {
      const p = { metric: view.metric, higher: view.higher };
      if (view.exclude.size) p.exclude = [...view.exclude];
      const same = view.metric === base.metric && view.higher === base.higher && view.exclude.size === base.exclude.size && [...view.exclude].every((m) => base.exclude.has(m));
      if (same && !forPreview) throw new Error("This is already the approved ranking. Change the metric, the order or the rows first.");
      return p;
    }
    if (kind === "result") {
      const row = { model: $("sg-model").value.trim(), paper: $("sg-paper").value.trim(), url: $("sg-url").value.trim(), values: {} };
      const code = $("sg-code").value.trim(), date = $("sg-date").value;
      if (code) row.code = code;
      if (date) row.date = date;
      el.querySelectorAll("[id^=sg-v]").forEach((i) => { if (i.value.trim() !== "") { const x = numberOf(i.value); if (x == null && !forPreview) throw new Error(`“${i.dataset.metric}” must be a number.`); if (x != null) row.values[i.dataset.metric] = x; } });
      if (!forPreview) {
        if (!row.model) throw new Error("Enter the model name.");
        if (!row.paper) throw new Error("Enter the paper title.");
        if (!row.url && !$("sg-pdf").files[0]) throw new Error("Add a link to the paper or upload its PDF.");
        if (row.url && !HTTPS.test(row.url)) throw new Error("The paper link must start with https://");
        if (row.code && !HTTPS.test(row.code)) throw new Error("The code link must start with https://");
        if (!Object.keys(row.values).length) throw new Error("Fill in at least one result.");
      }
      if (!row.url) delete row.url;
      return { add: [row] };
    }
    const f = { model: $("sg-fmodel").value, source: $("sg-src").value.trim(), values: {} };
    el.querySelectorAll("[id^=sg-f]").forEach((i) => {
      if (!i.dataset.metric || i.value.trim() === i.dataset.was) return;
      const x = numberOf(i.value);
      if (x == null && !forPreview) throw new Error(`“${i.dataset.metric}” must be a number.`);
      if (x != null) f.values[i.dataset.metric] = x;
    });
    if (!forPreview) {
      if (!Object.keys(f.values).length) throw new Error("Change at least one value.");
      if (!HTTPS.test(f.source)) throw new Error("Add an https link to the source of the correct values.");
    }
    return { fix: [f] };
  };

  const auth = () => {
    const a = $("sg-auth");
    if (!api.enabled()) { a.innerHTML = ""; return; }
    const user = api.currentUser();
    if (user) {
      a.innerHTML = `<p>Signed in as <b>${esc(user.email)}</b>. <button class="linkish" type="button" id="sg-out">Sign out</button></p>`;
      $("sg-out").addEventListener("click", async () => { await api.signOut(); step = "email"; auth(); send(); mine(); say("Signed out."); });
      return;
    }
    if (step === "email") {
      a.innerHTML = `<div class="suggest-grid"><div class="control"><label for="sg-email">Your email</label><input class="input" id="sg-email" type="email" autocomplete="email" value="${esc(email)}" placeholder="name@university.edu"></div></div>
        <div class="export-actions"><button class="btn" type="button" id="sg-codebtn">Email me a sign-in link</button></div>`;
      $("sg-codebtn").addEventListener("click", async () => {
        if (busy) return;
        busy = true; say("Sending the email…");
        try { email = await api.sendCode($("sg-email").value); step = "code"; auth(); say(`We sent an email to ${email}. Open its link in this browser and you will come back here signed in. It may take a minute; check your spam folder too.`); $("sg-otp")?.focus(); }
        catch (e) { say(e.message, true); }
        busy = false;
      });
    } else {
      a.innerHTML = `<div class="suggest-grid"><div class="control"><label for="sg-otp">If the email to ${esc(email)} shows a code, enter it here</label><input class="input" id="sg-otp" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="12345678"></div></div>
        <div class="export-actions"><button class="btn solid" type="button" id="sg-verify">Sign in</button><button class="btn" type="button" id="sg-back">Use another email</button></div>`;
      $("sg-back").addEventListener("click", () => { step = "email"; auth(); say(""); });
      const verify = async () => {
        if (busy) return;
        busy = true; say("Checking the code…");
        try { await api.verifyCode(email, $("sg-otp").value); step = "email"; auth(); send(); mine(); say("Signed in. You can send your suggestion now."); }
        catch (e) { say(e.message, true); }
        busy = false;
      };
      $("sg-verify").addEventListener("click", verify);
      $("sg-otp").addEventListener("keydown", (e) => { if (e.key === "Enter") verify(); });
    }
  };

  const send = () => {
    const s = $("sg-send");
    if (!api.enabled()) {
      s.innerHTML = repo ? `<button class="btn solid" type="button" id="sg-gh">Open the suggestion on GitHub</button>` : `<p class="hint">This copy of the site has no sign-in service or GitHub repository set up. Copy the preview and send it to the maintainers.</p>`;
      $("sg-gh")?.addEventListener("click", () => {
        try {
          const p = collect();
          const reason = $("sg-reason").value.trim();
          if (reason.length < 10) throw new Error("Say in a sentence why the change is needed.");
          const toml = toToml(t.id, p);
          const title = `${KINDS.find((k) => k[0] === kind)[1]}: ${t.task} on ${t.dataset}`.slice(0, 120);
          window.open(`${repo}/issues/new?template=ranking-change.yml&labels=ranking&title=${encodeURIComponent(title)}&table=${encodeURIComponent(t.id)}&proposal=${encodeURIComponent(toml)}&reason=${encodeURIComponent(reason)}`, "_blank", "noopener");
        } catch (e) { say(e.message, true); }
      });
      return;
    }
    s.innerHTML = `<button class="btn solid" type="button" id="sg-submit" ${api.currentUser() ? "" : "disabled"}>Send suggestion</button>${api.currentUser() ? "" : '<span class="hint">Sign in first.</span>'}`;
    $("sg-submit").addEventListener("click", async () => {
      if (busy) return;
      let p;
      const reason = $("sg-reason").value.trim();
      try {
        p = collect();
        if (reason.length < 10) throw new Error("Say in a sentence why the change is needed.");
      } catch (e) { say(e.message, true); return; }
      busy = true;
      try {
        let paper_path = null;
        const file = kind === "result" ? $("sg-pdf").files[0] : null;
        if (file) {
          say("Uploading the PDF…");
          const up = await api.uploadPaper(file);
          paper_path = up.path;
          if (!p.add[0].url) p.add[0].url = up.url;
        }
        say("Sending…");
        await api.submit({ kind, table_id: t.id, proposal: p, reason, paper_path });
        say("Thank you. Your suggestion was received; its status is below and changes as it is reviewed.");
        $("sg-reason").value = "";
        if (kind !== "ranking") body();
        mine();
      } catch (e) { say(e.message, true); }
      busy = false;
    });
  };

  const mine = async () => {
    const box = $("sg-mine");
    if (!api.enabled() || !api.currentUser()) { box.innerHTML = ""; return; }
    try {
      const list = await api.mySubmissions();
      box.innerHTML = list.length ? `<h3>Your suggestions</h3><ul class="suggest-list">${list.map((s) => `<li class="st-${esc(s.status)}">
          <span><a href="#benchmarks/${esc(s.table_id)}">${esc(s.table_id)}</a> <span class="hint">${esc(KINDS.find((k) => k[0] === s.kind)?.[1] || s.kind)}, ${esc(String(s.created_at).slice(0, 10))}</span></span>
          <span class="status-text">${esc(STATUS[s.status] || s.status)}${s.issue_number && repo ? ` (<a href="${esc(repo)}/issues/${Number(s.issue_number)}" target="_blank" rel="noopener">issue ${Number(s.issue_number)}</a>)` : ""}${s.review_note ? `: ${esc(s.review_note)}` : ""}</span></li>`).join("")}</ul>` : "";
    } catch (e) { box.innerHTML = `<p class="hint">${esc(e.message)}</p>`; }
  };

  const refresh = () => {
    const pre = $("sg-preview");
    if (pre) { try { pre.textContent = toToml(t.id, collect(true)); } catch { /* incomplete form */ } }
  };

  el.querySelectorAll("[data-kind]").forEach((b) => b.addEventListener("click", () => {
    kind = b.dataset.kind;
    el.querySelectorAll("[data-kind]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    body();
    say("");
  }));
  body(); auth(); send(); mine();
  return {
    open(k) {
      el.querySelector(`[data-kind="${k}"]`)?.click();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    refresh,
  };
}
