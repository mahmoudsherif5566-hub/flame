// POST /api/register { email } -> { ok, total, today, week, lastRegistrationAt, mode, isNew }
// Email-only, same validation and response shape as server.js / api/register.js.
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
    const store = createStore(env);
    const before = await store.stats();
    const after = await store.register(clean);
    return json({ ok: true, isNew: after.total > before.total, ...after });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "server_error", detail: String(e?.message || e).slice(0, 200) }, 500);
  }
}
