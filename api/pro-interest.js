// POST /api/pro-interest { email } -> { ok, note: "interest_recorded_no_payment" }
// Records Pro interest only — no payment. Same shape as server.js.
import { EMAIL_RE, cleanEmail, store, send, readBody, requireSupabase } from "./_lib.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return send(res, 405, { ok: false, error: "method_not_allowed" });
    if (!requireSupabase(res)) return;
    const { email } = await readBody(req);
    const clean = cleanEmail(email);
    if (!EMAIL_RE.test(clean)) return send(res, 400, { ok: false, error: "invalid_email" });
    await store.addProInterest(clean);
    return send(res, 200, { ok: true, note: "interest_recorded_no_payment" });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { ok: false, error: "server_error", detail: String(e.message).slice(0, 200) });
  }
}
