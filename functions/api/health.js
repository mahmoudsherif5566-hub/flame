// GET /api/health -> { ok, mode, supabaseConfigured }
// Same shape as server.js / api/health.js. Mode is "supabase" when the env
// vars are set, otherwise "not_configured".
import { json, modeOf, useSupabase } from "./_lib.js";

export function onRequest(context) {
  const env = context.env;
  if (context.request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);
  return json({ ok: true, mode: modeOf(env), supabaseConfigured: useSupabase(env) });
}
