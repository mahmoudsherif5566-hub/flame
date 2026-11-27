// GET /api/stats -> { total, today, week, lastRegistrationAt, mode }
// Same shape as server.js / api/stats.js; today/week are computed in Africa/Cairo.
import { json, createStore, requireSupabase } from "./_lib.js";

export async function onRequest(context) {
  const env = context.env;
  try {
    if (context.request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);
    const missing = requireSupabase(env);
    if (missing) return missing;
    return json(await createStore(env).stats());
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "server_error", detail: String(e?.message || e).slice(0, 200) }, 500);
  }
}
