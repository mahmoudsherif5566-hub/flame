// POST /api/register { email } -> { ok, total, today, week, lastRegistrationAt, mode, isNew }
// Email-only, same validation and response shape as server.js and api/register.js.
const { EMAIL_RE, cleanEmail, store, send, readBody, requireSupabase, serverError } = require("./lib/_lib.cjs");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return send(405, { ok: false, error: "method_not_allowed" });
    const missing = requireSupabase();
    if (missing) return missing;
    const { email } = readBody(event);
    const clean = cleanEmail(email);
    if (!EMAIL_RE.test(clean)) return send(400, { ok: false, error: "invalid_email" });
    const before = await store.stats();
    const after = await store.register(clean);
    return send(200, { ok: true, isNew: after.total > before.total, ...after });
  } catch (e) {
    return serverError(e);
  }
};
