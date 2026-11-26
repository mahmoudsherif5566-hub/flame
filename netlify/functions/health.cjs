// GET /api/health -> { ok, mode, supabaseConfigured }
// Same shape as server.js and api/health.js. Mode is "supabase" when the env
// vars are set, otherwise "not_configured" (Netlify has no local SQLite fallback).
const { MODE, USE_SUPABASE, send } = require("./lib/_lib.cjs");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return send(405, { ok: false, error: "method_not_allowed" });
  return send(200, { ok: true, mode: MODE, supabaseConfigured: USE_SUPABASE });
};
