// A small stand-in for the GitHub issues API used by scripts/sync-submissions.mjs.
import http from "node:http";

export function startMockGitHub({ port = 0, token = "gh-test-token", repo = "owner/atlas" } = {}) {
  const issues = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    const send = (status, data) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
    if (req.headers.authorization !== `Bearer ${token}`) return send(401, { message: "Bad credentials" });
    const base = `/repos/${repo}/issues`;
    if (req.url === base && req.method === "POST") {
      if (!body?.title || !body?.body) return send(422, { message: "Validation Failed" });
      const issue = { number: issues.length + 1, title: body.title, body: body.body, labels: (body.labels || []).map((name) => ({ name })), state: "open" };
      issues.push(issue);
      return send(201, issue);
    }
    const m = req.url.match(new RegExp(`^${base}/(\\d+)$`));
    if (m) {
      const issue = issues[Number(m[1]) - 1];
      if (!issue) return send(404, { message: "Not Found" });
      if (req.method === "GET") return send(200, issue);
      if (req.method === "PATCH") { Object.assign(issue, body); return send(200, issue); }
    }
    send(404, { message: `No mock for ${req.method} ${req.url}` });
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok({
    url: `http://127.0.0.1:${server.address().port}`, token, repo, issues,
    // what a maintainer does on github.com
    approve: (n) => { const i = issues[n - 1]; i.labels.push({ name: "approved" }); },
    close: (n) => { issues[n - 1].state = "closed"; },
    stop: () => new Promise((c) => server.close(c)),
  })));
}
