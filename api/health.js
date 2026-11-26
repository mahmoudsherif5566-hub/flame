// GET /api/health -> { ok, mode, supabaseConfigured }
// Same shape as server.js. Mode is "supabase" when the env vars are set,
// otherwise "not_configured" (Vercel has no local SQLite fallback).
import { MODE, USE_SUPABASE, send } from "./_lib.js";

export default function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { ok: false, error: "method_not_allowed" });
  return send(res, 200, { ok: true, mode: MODE, supabaseConfigured: USE_SUPABASE });
}
