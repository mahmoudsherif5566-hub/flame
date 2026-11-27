// POST /api/pro-interest { email } -> { ok, note: "interest_recorded_no_payment" }
// Records Pro interest only — no payment. Same shape as server.js / api/pro-interest.js.
import { EMAIL_RE, cleanEmail, createStore, json, readBody, requireSupabase } from "./_lib.js";

export async function onRequest(context) {
  const env = context.env;
  try {
    if (context.request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
    const missing = requireSupabase(env);
    if (missing) return missing;
    const { email } = await readBody(context.request);
    const clean = cleanEmail(email);
    if (!EMAIL_RE.test(clean)) return json({ ok: false, error: "invalid_email" }, 400);
    await createStore(env).addProInterest(clean);
    return json({ ok: true, note: "interest_recorded_no_payment" });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "server_error", detail: String(e?.message || e).slice(0, 200) }, 500);
  }
}
