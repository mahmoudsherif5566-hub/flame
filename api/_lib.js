// Flame — shared helpers for the Vercel serverless API functions (api/*.js).
// Same logic as server.js (validation + Cairo-time stats + Supabase REST),
// but Supabase-only: no SQLite on Vercel (serverless filesystem is ephemeral).
// No new dependencies — Node built-ins + global fetch only.

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
export const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);
export const MODE = USE_SUPABASE ? "supabase" : "not_configured";

// ---------- validation ----------
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function cleanEmail(v) {
  return String(v || "").trim().toLowerCase().slice(0, 120);
}

// ---------- Cairo time (same as server.js) ----------
export function cairoOffsetMs(date) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo", hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, (+parts.hour) % 24, +parts.minute, +parts.second);
  return asUTC - date.getTime();
}
export function cairoDayStart(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now); // YYYY-MM-DD in Cairo
  const [y, mo, d] = parts.split("-").map(Number);
  const utcMidnight = Date.UTC(y, mo - 1, d);
  const offset = cairoOffsetMs(new Date(utcMidnight + 12 * 3600000));
  return new Date(utcMidnight - offset).toISOString();
}
export function statsFromDates(dates) {
  const todayStart = cairoDayStart(0);
  const weekStart = cairoDayStart(-6);
  const sorted = [...dates].sort();
  return {
    total: dates.length,
    today: dates.filter((d) => d >= todayStart).length,
    week: dates.filter((d) => d >= weekStart).length,
    lastRegistrationAt: sorted.length ? sorted[sorted.length - 1] : null,
    mode: MODE,
  };
}

// ---------- Supabase REST ----------
async function sb(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* empty body */ }
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`);
  return { json, count: res.headers.get("content-range") };
}

export const store = {
  async register(email) {
    await sb("registrations", { method: "POST", body: { email, provider: "email" }, prefer: "resolution=ignore-duplicates,return=minimal" });
    return this.stats();
  },
  async stats() {
    const { json } = await sb("registrations?select=created_at&order=created_at.desc&limit=10000");
    return statsFromDates((json || []).map((r) => r.created_at));
  },
  async addCreative(c) {
    const { json } = await sb("creatives", { method: "POST", body: c, prefer: "return=representation" });
    return (json || [])[0] || null;
  },
  async listCreatives() {
    const { json } = await sb("creatives?select=*&order=created_at.desc&limit=100");
    return json || [];
  },
  async addProInterest(email) {
    await sb("pro_interests", { method: "POST", body: { email, plan: "pro" }, prefer: "return=minimal" });
    return true;
  },
};

// ---------- HTTP helpers (work on Vercel's res and on plain Node res) ----------
export function send(res, code, obj) {
  const body = JSON.stringify(obj);
  if (typeof res.status === "function") {
    return res.status(code).json(obj);
  }
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body) });
  return res.end(body);
}

// Vercel pre-parses JSON bodies into req.body; fall back to reading the stream.
export async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") return req.body ? JSON.parse(req.body) : {};
    return req.body;
  }
  let raw = "";
  for await (const chunk of req) { raw += chunk; if (raw.length > 200_000) throw new Error("body too large"); }
  return raw ? JSON.parse(raw) : {};
}

// Returns false (after sending 503) when Supabase env vars are missing.
export function requireSupabase(res) {
  if (!USE_SUPABASE) {
    send(res, 503, { ok: false, error: "supabase_not_configured" });
    return false;
  }
  return true;
}
