// Flame Standalone — Node server (no npm dependencies, Node >= 22)
// Serves the frontend and provides the API backed by a REAL central database.
//
// Storage modes:
//  - Supabase (production): set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
//    The server talks to Supabase's REST API with the service-role key only,
//    so every visitor shares ONE central database and ONE global count.
//  - Local SQLite (development): data/flame.db via node:sqlite.
//    Same tables, same API — used to verify the wiring locally.
//
// API:
//  GET  /api/health                 -> { ok, mode, supabaseConfigured }
//  GET  /api/stats                  -> { total, today, week, lastRegistrationAt, mode }
//  POST /api/register   { email }   -> { ok, total }            (email-only)
//  GET  /api/creatives             -> { creatives: [...] }
//  POST /api/creatives { email, kind, title, prompt, sample }
//  POST /api/pro-interest { email } -> { ok }
//
// All dates for today/week are computed in Africa/Cairo on the server.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);
const MODE = USE_SUPABASE ? "supabase" : "local-sqlite";

// ---------- helpers ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function cleanEmail(v) {
  return String(v || "").trim().toLowerCase().slice(0, 120);
}
function cairoOffsetMs(date) {
  // Offset of Africa/Cairo from UTC at a given instant (handles Egypt DST: UTC+2 winter, UTC+3 summer).
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo", hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, (+parts.hour) % 24, +parts.minute, +parts.second);
  return asUTC - date.getTime();
}
function cairoDayStart(offsetDays = 0) {
  // Midnight in Africa/Cairo, returned as an ISO UTC instant.
  const now = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now); // YYYY-MM-DD in Cairo
  const [y, mo, d] = parts.split("-").map(Number);
  const utcMidnight = Date.UTC(y, mo - 1, d);
  const offset = cairoOffsetMs(new Date(utcMidnight + 12 * 3600000));
  return new Date(utcMidnight - offset).toISOString();
}
function statsFromDates(dates) {
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

// ---------- Supabase REST adapter ----------
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

const supabaseStore = {
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

// ---------- Local SQLite adapter (same tables, same API) ----------
import { DatabaseSync } from "node:sqlite";
const dbPath = path.join(__dirname, "data", "flame.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS registrations (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, provider TEXT NOT NULL DEFAULT 'email', created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS creatives (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, kind TEXT NOT NULL DEFAULT 'ad', title TEXT, prompt TEXT, sample TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS pro_interests (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'pro', created_at TEXT NOT NULL DEFAULT (datetime('now')));
`);
const localStore = {
  async register(email) {
    db.prepare("INSERT OR IGNORE INTO registrations (email, provider) VALUES (?, 'email')").run(email);
    return this.stats();
  },
  async stats() {
    const rows = db.prepare("SELECT created_at FROM registrations ORDER BY created_at DESC LIMIT 10000").all();
    // SQLite stores UTC 'YYYY-MM-DD HH:MM:SS' — convert to ISO for the same stats math.
    return statsFromDates(rows.map((r) => r.created_at.replace(" ", "T") + "Z"));
  },
  async addCreative(c) {
    const info = db.prepare("INSERT INTO creatives (email, kind, title, prompt, sample) VALUES (?, ?, ?, ?, ?)").run(c.email || null, c.kind || "ad", c.title || null, c.prompt || null, c.sample || null);
    return db.prepare("SELECT * FROM creatives WHERE id = ?").get(info.lastInsertRowid);
  },
  async listCreatives() {
    return db.prepare("SELECT * FROM creatives ORDER BY created_at DESC LIMIT 100").all();
  },
  async addProInterest(email) {
    db.prepare("INSERT INTO pro_interests (email, plan) VALUES (?, 'pro')").run(email);
    return true;
  },
};

const store = USE_SUPABASE ? supabaseStore : localStore;

// ---------- HTTP server ----------
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml" };

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}
async function readBody(req) {
  let raw = "";
  for await (const chunk of req) { raw += chunk; if (raw.length > 200_000) throw new Error("body too large"); }
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/health" && req.method === "GET")
        return send(res, 200, { ok: true, mode: MODE, supabaseConfigured: USE_SUPABASE });
      if (url.pathname === "/api/stats" && req.method === "GET")
        return send(res, 200, await store.stats());
      if (url.pathname === "/api/register" && req.method === "POST") {
        const { email } = await readBody(req);
        const clean = cleanEmail(email);
        if (!EMAIL_RE.test(clean)) return send(res, 400, { ok: false, error: "invalid_email" });
        const before = await store.stats();
        const after = await store.register(clean);
        return send(res, 200, { ok: true, isNew: after.total > before.total, ...after });
      }
      if (url.pathname === "/api/creatives" && req.method === "GET")
        return send(res, 200, { creatives: await store.listCreatives() });
      if (url.pathname === "/api/creatives" && req.method === "POST") {
        const b = await readBody(req);
        const creative = await store.addCreative({
          email: b.email ? cleanEmail(b.email) : null,
          kind: ["ad", "studio"].includes(b.kind) ? b.kind : "ad",
          title: String(b.title || "").slice(0, 200),
          prompt: String(b.prompt || "").slice(0, 1000),
          sample: String(b.sample || "").slice(0, 100000), // thumbnail data URL (small JPEG) or sample name
        });
        return send(res, 200, { ok: true, creative });
      }
      if (url.pathname === "/api/pro-interest" && req.method === "POST") {
        const { email } = await readBody(req);
        const clean = cleanEmail(email);
        if (!EMAIL_RE.test(clean)) return send(res, 400, { ok: false, error: "invalid_email" });
        await store.addProInterest(clean);
        return send(res, 200, { ok: true, note: "interest_recorded_no_payment" });
      }
      return send(res, 404, { ok: false, error: "not_found" });
    }
    // Static files
    let file = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.join(__dirname, "public", decodeURIComponent(file));
    if (!filePath.startsWith(path.join(__dirname, "public"))) return send(res, 403, { ok: false });
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      const index = path.join(__dirname, "public", "index.html");
      res.writeHead(200, { "Content-Type": MIME[".html"] });
      return res.end(fs.readFileSync(index));
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { ok: false, error: "server_error", detail: String(e.message).slice(0, 200) });
  }
});

server.listen(PORT, () => {
  console.log(`Flame standalone running on http://localhost:${PORT} — mode: ${MODE}`);
});
