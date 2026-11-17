// A small stand-in for the Supabase endpoints the site and the sync script use,
// with the same rules as supabase/migrations/*.sql:
//   POST /auth/v1/otp, /auth/v1/verify, GET /auth/v1/verify (the emailed link), /auth/v1/token?grant_type=refresh_token, /auth/v1/logout
//   POST|GET|PATCH /rest/v1/submissions   (row-level security as in the SQL)
//   POST /storage/v1/object/papers/<uid>/<uuid>.pdf, GET /storage/v1/object/public/papers/...
// Sent codes land in an outbox instead of an inbox: GET /__outbox?email=...
import http from "node:http";
import crypto from "node:crypto";

export function startMockSupabase({ port = 0, anonKey = "anon-test-key", serviceKey = "service-test-key" } = {}) {
  const users = new Map();      // email -> { id, email }
  const codes = new Map();      // email -> { code, expires, tries }
  const sessions = new Map();   // access token -> { user, expires }
  const refresh = new Map();    // refresh token -> user
  const rows = [];              // submissions
  const files = new Map();      // storage path -> Buffer
  const outbox = [];            // { email, code, at }
  const log = [];

  const send = (res, status, data, headers = {}) => {
    res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", ...headers });
    res.end(data === undefined ? "" : JSON.stringify(data));
  };
  const body = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c))); });
  const issue = (user) => {
    // shaped like a JWT, as the site reads the user from the token of an emailed link
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const access = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated" })}.${crypto.randomBytes(24).toString("base64url")}`, ref = crypto.randomBytes(24).toString("hex");
    sessions.set(access, { user, expires: Date.now() + 3600e3 });
    refresh.set(ref, user);
    return { access_token: access, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: ref, user: { id: user.id, email: user.email, aud: "authenticated" } };
  };
  // who is calling: the service role, a signed-in reader, or nobody
  const caller = (req) => {
    const key = req.headers.apikey;
    if (key !== anonKey && key !== serviceKey) return { bad: true };
    const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (bearer === serviceKey && key === serviceKey) return { service: true };
    const s = sessions.get(bearer);
    if (s && s.expires > Date.now()) return { user: s.user };
    return { anon: true };
  };
  const ROW_KEYS = ["id", "created_at", "user_id", "kind", "table_id", "proposal", "reason", "paper_path", "status", "issue_number", "review_note", "updated_at"];
  const UUID = "[0-9a-f-]{36}";
  // PostgREST-style filters used by the clients: col=eq.value
  const filtersOf = (url) => [...url.searchParams].filter(([k]) => ROW_KEYS.includes(k)).map(([k, v]) => [k, v.replace(/^eq\./, "")]);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (req.method === "OPTIONS") {
      return send(res, 204, undefined, { "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS", "Access-Control-Allow-Headers": "apikey,authorization,content-type,prefer,x-upsert" });
    }
    log.push(`${req.method} ${url.pathname}`);
    const raw = await body(req);
    const json = () => { try { return JSON.parse(raw.toString() || "null"); } catch { return null; } };
    const who = caller(req);

    if (url.pathname === "/__outbox") return send(res, 200, outbox.filter((m) => !url.searchParams.get("email") || m.email === url.searchParams.get("email")));
    if (url.pathname.startsWith("/storage/v1/object/public/papers/")) {
      const f = files.get(decodeURIComponent(url.pathname.slice("/storage/v1/object/public/papers/".length)));
      if (!f) return send(res, 404, { message: "Object not found" });
      res.writeHead(200, { "Content-Type": "application/pdf", "Access-Control-Allow-Origin": "*" });
      return res.end(f);
    }
    // the link in the email: opened in the browser, so it carries no API key
    if (url.pathname === "/auth/v1/verify" && req.method === "GET") {
      const email = url.searchParams.get("email"), c = codes.get(email), to = url.searchParams.get("redirect_to") || "http://localhost/";
      if (url.searchParams.get("type") !== "magiclink" || !c || c.expires < Date.now() || c.code !== url.searchParams.get("token")) {
        res.writeHead(303, { Location: `${to}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired` });
        return res.end();
      }
      codes.delete(email);
      const s = issue(users.get(email));
      res.writeHead(303, { Location: `${to}#access_token=${s.access_token}&expires_at=${s.expires_at}&expires_in=3600&refresh_token=${s.refresh_token}&token_type=bearer&type=magiclink` });
      return res.end();
    }
    if (who.bad) return send(res, 401, { message: "Invalid API key" });

    // ---- auth ----
    if (url.pathname === "/auth/v1/otp" && req.method === "POST") {
      const { email, create_user } = json() || {};
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email || "")) return send(res, 400, { code: 400, error_code: "validation_failed", msg: "Unable to validate email address: invalid format" });
      const recent = outbox.filter((m) => m.email === email && Date.now() - m.at < 60e3).length;
      if (recent >= 3) return send(res, 429, { code: 429, error_code: "over_email_send_rate_limit", msg: "For security purposes, you can only request this after 60 seconds." });
      if (!users.has(email)) { if (!create_user) return send(res, 422, { msg: "Signups not allowed for otp" }); users.set(email, { id: crypto.randomUUID(), email }); }
      const code = String(crypto.randomInt(0, 1e6)).padStart(6, "0");
      codes.set(email, { code, expires: Date.now() + 3600e3, tries: 0 });
      const link = `http://${req.headers.host}/auth/v1/verify?type=magiclink&token=${code}&email=${encodeURIComponent(email)}&redirect_to=${encodeURIComponent(url.searchParams.get("redirect_to") || "")}`;
      outbox.push({ email, code, link, at: Date.now() });
      return send(res, 200, {});
    }
    if (url.pathname === "/auth/v1/verify" && req.method === "POST") {
      const { email, token, type } = json() || {};
      const c = codes.get(email);
      if (type !== "email" || !c || c.expires < Date.now() || c.code !== token || ++c.tries > 5) {
        if (c && c.code !== token) c.tries++;
        return send(res, 403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" });
      }
      codes.delete(email);
      return send(res, 200, issue(users.get(email)));
    }
    if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
      const user = refresh.get((json() || {}).refresh_token);
      if (!user) return send(res, 400, { error: "invalid_grant", error_description: "Invalid Refresh Token" });
      refresh.delete((json() || {}).refresh_token);
      return send(res, 200, issue(user));
    }
    if (url.pathname === "/auth/v1/logout") { sessions.delete((req.headers.authorization || "").slice(7)); return send(res, 204); }

    // ---- storage ----
    const m = url.pathname.match(new RegExp(`^/storage/v1/object/papers/(${UUID})/(${UUID}\\.pdf)$`));
    if (url.pathname.startsWith("/storage/v1/object/papers/") && req.method === "POST") {
      if (!who.user) return send(res, 403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
      if (!m || m[1] !== who.user.id) return send(res, 403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
      if (req.headers["content-type"] !== "application/pdf") return send(res, 415, { statusCode: "415", error: "invalid_mime_type", message: "mime type not supported" });
      if (raw.length > 20 * 1024 * 1024) return send(res, 413, { statusCode: "413", error: "Payload too large", message: "The object exceeded the maximum allowed size" });
      const key = `${m[1]}/${m[2]}`;
      if (files.has(key)) return send(res, 409, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
      files.set(key, raw);
      return send(res, 200, { Key: `papers/${key}`, Id: crypto.randomUUID() });
    }

    // ---- submissions (row-level security as in the SQL) ----
    if (url.pathname === "/rest/v1/submissions") {
      if (req.method === "POST") {
        if (!who.user && !who.service) return send(res, 401, { code: "42501", message: "new row violates row-level security policy for table \"submissions\"" });
        const d = json() || {};
        const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), user_id: d.user_id ?? who.user?.id, kind: d.kind, table_id: d.table_id, proposal: d.proposal,
          reason: d.reason, paper_path: d.paper_path ?? null, status: d.status ?? "pending", issue_number: d.issue_number ?? null, review_note: d.review_note ?? null, updated_at: new Date().toISOString() };
        for (const k of Object.keys(d)) if (!ROW_KEYS.includes(k)) return send(res, 400, { code: "PGRST204", message: `Could not find the '${k}' column of 'submissions' in the schema cache` });
        if (who.user) {
          const ok = row.user_id === who.user.id && row.status === "pending" && row.issue_number == null && row.review_note == null &&
            (row.paper_path == null || row.paper_path.split("/")[0] === who.user.id);
          if (!ok) return send(res, 403, { code: "42501", message: "new row violates row-level security policy for table \"submissions\"" });
        }
        const checks = [["kind", ["ranking", "result", "fix"].includes(row.kind)], ["table_id", typeof row.table_id === "string" && row.table_id.length >= 1 && row.table_id.length <= 120],
          ["proposal", row.proposal && typeof row.proposal === "object" && JSON.stringify(row.proposal).length < 20000], ["reason", typeof row.reason === "string" && row.reason.length >= 10 && row.reason.length <= 4000],
          ["paper_path", row.paper_path == null || new RegExp(`^${UUID}/${UUID}\\.pdf$`).test(row.paper_path)], ["status", ["pending", "queued", "applied", "rejected"].includes(row.status)]];
        for (const [k, good] of checks) if (!good) return send(res, 400, { code: "23514", message: `new row for relation "submissions" violates check constraint "submissions_${k}_check"` });
        if (rows.filter((r) => r.user_id === row.user_id && Date.now() - Date.parse(r.created_at) < 864e5).length >= 20) return send(res, 400, { code: "P0001", message: "Too many suggestions today. Please try again tomorrow." });
        rows.push(row);
        return send(res, 201, (req.headers.prefer || "").includes("return=representation") ? [row] : undefined);
      }
      if (req.method === "GET") {
        if (!who.user && !who.service) return send(res, 200, []);
        let list = rows.filter((r) => who.service || r.user_id === who.user.id);
        for (const [k, v] of filtersOf(url)) list = list.filter((r) => String(r[k]) === v);
        const order = url.searchParams.get("order") || "";
        if (order.startsWith("created_at")) list = [...list].sort((a, b) => (order.endsWith(".desc") ? -1 : 1) * a.created_at.localeCompare(b.created_at));
        const sel = url.searchParams.get("select");
        if (sel && sel !== "*") list = list.map((r) => Object.fromEntries(sel.split(",").map((k) => [k, r[k]])));
        return send(res, 200, list.slice(0, Number(url.searchParams.get("limit") || 1000)));
      }
      if (req.method === "PATCH") {
        // readers have no update policy: their PATCH changes nothing
        if (!who.service) return send(res, 200, []);
        const changed = [];
        for (const r of rows) if (filtersOf(url).every(([k, v]) => String(r[k]) === v)) { Object.assign(r, json(), { updated_at: new Date().toISOString() }); changed.push(r); }
        return send(res, 200, changed);
      }
    }
    return send(res, 404, { message: `No mock for ${req.method} ${url.pathname}` });
  });

  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok({
    url: `http://127.0.0.1:${server.address().port}`, anonKey, serviceKey, rows, files, outbox, users, log,
    lastCode: (email) => [...outbox].reverse().find((m) => m.email === email)?.code,
    close: () => new Promise((c) => server.close(c)),
  })));
}
