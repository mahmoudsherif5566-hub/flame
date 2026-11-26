// GET /api/stats -> { total, today, week, lastRegistrationAt, mode }
// Same shape as server.js; today/week are computed in Africa/Cairo.
import { store, send, requireSupabase } from "./_lib.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return send(res, 405, { ok: false, error: "method_not_allowed" });
    if (!requireSupabase(res)) return;
    return send(res, 200, await store.stats());
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { ok: false, error: "server_error", detail: String(e.message).slice(0, 200) });
  }
}
