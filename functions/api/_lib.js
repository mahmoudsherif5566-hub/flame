// Flame — shared helpers for Cloudflare Pages Functions (functions/api/*.js).
// Workers-native port of api/_lib.js: same validation, Cairo-time stats and
// Supabase REST logic, but env vars come from context.env (never process.env)
// and handlers return Web Response objects. No Node-only APIs are used
// (no Buffer, no process, no Node http), so no nodejs_compat flag is needed.

// ---------- env ----------
export function useSupabase(env) {
  return Boolean(env?.SUPABASE_URL && env?.SUPABASE_SERVICE_ROLE_KEY);
}
export function modeOf(env) {
  return useSupabase(env) ? "supabase" : "not_configured";
}

// ---------- validation ----------
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function cleanEmail(v) {
  return String(v || "").trim().toLowerCase().slice(0, 120);
}

// ---------- Cairo time (same as server.js / api/_lib.js) ----------
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
export function statsFromDates(dates, mode) {
  const todayStart = cairoDayStart(0);
  const weekStart = cairoDayStart(-6);
  const sorted = [...dates].sort();
  return {
    total: dates.length,
    today: dates.filter((d) => d >= todayStart).length,
    week: dates.filter((d) => d >= weekStart).length,
    lastRegistrationAt: sorted.length ? sorted[sorted.length - 1] : null,
    mode,
  };
}

// ---------- Supabase REST ----------
async function sb(env, path, { method = "GET", body, prefer } = {}) {
  const url = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
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

export function createStore(env) {
  const mode = modeOf(env);
  return {
    async register(email) {
      await sb(env, "registrations", { method: "POST", body: { email, provider: "email" }, prefer: "resolution=ignore-duplicates,return=minimal" });
      return this.stats();
    },
    async stats() {
      const { json } = await sb(env, "registrations?select=created_at&order=created_at.desc&limit=10000");
      return statsFromDates((json || []).map((r) => r.created_at), mode);
    },
    async addCreative(c) {
      const { json } = await sb(env, "creatives", { method: "POST", body: c, prefer: "return=representation" });
      return (json || [])[0] || null;
    },
    async listCreatives() {
      const { json } = await sb(env, "creatives?select=*&order=created_at.desc&limit=100");
      return json || [];
    },
    async addProInterest(email) {
      await sb(env, "pro_interests", { method: "POST", body: { email, plan: "pro" }, prefer: "return=minimal" });
      return true;
    },
  };
}

// ---------- HTTP helpers (Workers Response) ----------
export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

// Read a JSON request body; returns {} when empty or unparsable.
export async function readBody(request) {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

// Returns false (after building the 503 response) when Supabase env vars are missing.
export function requireSupabase(env) {
  if (!useSupabase(env)) return json({ ok: false, error: "supabase_not_configured" }, 503);
  return null;
}
