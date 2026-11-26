// POST /api/register { email } -> { ok, total, today, week, lastRegistrationAt, mode, isNew }
// Email-only, same validation and response shape as server.js.
import { EMAIL_RE, cleanEmail, store, send, readBody, requireSupabase } from "./_lib.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return send(res, 405, { ok: false, error: "method_not_allowed" });
    if (!requireSupabase(res)) return;
    const { email } = await readBody(req);
    const clean = cleanEmail(email);
    if (!EMAIL_RE.test(clean)) return send(res, 400, { ok: false, error: "invalid_email" });
    const before = await store.stats();
    const after = await store.register(clean);
    return send(res, 200, { ok: true, isNew: after.total > before.total, ...after });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { ok: false, error: "server_error", detail: String(e.message).slice(0, 200) });
  }
}
