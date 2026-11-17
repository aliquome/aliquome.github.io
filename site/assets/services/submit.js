// Sign-in by email (a one-time link, or a code when the email template shows
// one), and reader submissions.
// Talks to a Supabase project over its public REST endpoints; the project URL
// and the public (anon) key come from <meta name="atlas-supabase-url"> and
// <meta name="atlas-supabase-key"> in index.html. No secret lives in the site:
// row-level security in supabase/migrations decides what a reader may do.

const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.content?.trim() || "";
const cfg = () => ({ url: meta("atlas-supabase-url").replace(/\/$/, ""), key: meta("atlas-supabase-key") });
export const enabled = () => Boolean(cfg().url && cfg().key);

const STORE = "atlas-session-v1";
let session = null;
try { session = JSON.parse(localStorage.getItem(STORE) || "null"); } catch { session = null; }
const save = (s) => {
  session = s;
  try { s ? localStorage.setItem(STORE, JSON.stringify(s)) : localStorage.removeItem(STORE); } catch { /* private window */ }
};

export class ApiError extends Error {}
const message = (data, status) =>
  (data && (data.msg || data.message || data.error_description || data.error)) || `The server answered with HTTP ${status}.`;

async function request(path, { method = "GET", body, token, headers = {}, raw } = {}) {
  const { url, key } = cfg();
  let res;
  try {
    res = await fetch(url + path, {
      method,
      headers: { apikey: key, Authorization: `Bearer ${token || key}`, ...(raw ? {} : { "Content-Type": "application/json" }), ...headers },
      body: raw ? body : body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Could not reach the sign-in service. Check your connection and try again.");
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) throw new ApiError(message(data, res.status));
  return data;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// The link in the email brings the reader back to the home address (Supabase
// adds the session after "#"), so the page they asked from is kept meanwhile.
const RETURN = "atlas-return-v1";
const home = () => `${location.origin}/`;

export async function sendCode(email) {
  email = String(email || "").trim().toLowerCase();
  if (!EMAIL.test(email)) throw new ApiError("Enter a valid email address.");
  try { localStorage.setItem(RETURN, location.pathname + location.search); } catch { /* private window */ }
  await request(`/auth/v1/otp?redirect_to=${encodeURIComponent(home())}`, { method: "POST", body: { email, create_user: true } });
  return email;
}

const claims = (jwt) => {
  try { return JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch { return null; }
};

// Run before the router: finishes a sign-in from the emailed link and puts the
// reader back on the page they asked from. Returns a message to show, or "".
export function completeLinkSignIn() {
  const h = location.hash.replace(/^#/, "");
  if (!/(^|&)(access_token|error_code|error)=/.test(h)) return "";
  const p = new URLSearchParams(h);
  let back = "/";
  try { back = localStorage.getItem(RETURN) || "/"; localStorage.removeItem(RETURN); } catch { /* private window */ }
  // an address kept before clean paths starts with "#"; the router moves it
  history.replaceState(null, "", back.startsWith("#") ? `/${back}` : back);
  if (p.get("error") || p.get("error_code")) {
    return p.get("error_code") === "otp_expired" ? "The sign-in link has expired or was already used. Ask for a new one." : `Sign-in failed: ${p.get("error_description") || p.get("error")}.`;
  }
  const c = claims(p.get("access_token") || "");
  if (!c?.sub) return "Sign-in failed: the link was not valid.";
  save({ access_token: p.get("access_token"), refresh_token: p.get("refresh_token"), expires_at: Number(p.get("expires_at")) || c.exp, user: { id: c.sub, email: c.email } });
  return `Signed in as ${c.email}.`;
}

export async function verifyCode(email, code) {
  code = String(code || "").replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(code)) throw new ApiError("Enter the code from the email.");
  const d = await request("/auth/v1/verify", { method: "POST", body: { type: "email", email, token: code } });
  save({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600), user: { id: d.user.id, email: d.user.email } });
  return session.user;
}

export const currentUser = () => session?.user || null;

async function token() {
  if (!session) throw new ApiError("Sign in first.");
  if (session.expires_at - 60 > Date.now() / 1000) return session.access_token;
  try {
    const d = await request("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: session.refresh_token } });
    save({ ...session, access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600) });
    return session.access_token;
  } catch {
    save(null);
    throw new ApiError("Your sign-in has expired. Sign in again.");
  }
}

export async function signOut() {
  const t = session?.access_token;
  save(null);
  if (t) request("/auth/v1/logout", { method: "POST", token: t }).catch(() => {});
}

export const MAX_PDF = 20 * 1024 * 1024;
export async function uploadPaper(file) {
  if (!file) return null;
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) throw new ApiError("The paper must be a PDF file.");
  if (file.size > MAX_PDF) throw new ApiError("The PDF is larger than 20 MB.");
  const t = await token();
  const path = `${session.user.id}/${crypto.randomUUID()}.pdf`;
  await request(`/storage/v1/object/papers/${path}`, { method: "POST", token: t, raw: true, body: file, headers: { "Content-Type": "application/pdf", "x-upsert": "false" } });
  return { path, url: `${cfg().url}/storage/v1/object/public/papers/${path}` };
}

export async function submit({ kind, table_id, proposal, reason, paper_path = null }) {
  const t = await token();
  const rows = await request("/rest/v1/submissions", {
    method: "POST", token: t, headers: { Prefer: "return=representation" },
    body: { kind, table_id, proposal, reason, paper_path },
  });
  return rows[0];
}

export async function mySubmissions() {
  const t = await token();
  return request("/rest/v1/submissions?select=id,created_at,kind,table_id,status,issue_number,review_note&order=created_at.desc&limit=50", { token: t });
}
