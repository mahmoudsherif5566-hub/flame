// POST /api/pro-interest { email } -> { ok, note: "interest_recorded_no_payment" }
// Records Pro interest only — no payment. Same shape as server.js and api/pro-interest.js.
const { EMAIL_RE, cleanEmail, store, send, readBody, requireSupabase, serverError } = require("./lib/_lib.cjs");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return send(405, { ok: false, error: "method_not_allowed" });
    const missing = requireSupabase();
    if (missing) return missing;
    const { email } = readBody(event);
    const clean = cleanEmail(email);
    if (!EMAIL_RE.test(clean)) return send(400, { ok: false, error: "invalid_email" });
    await store.addProInterest(clean);
    return send(200, { ok: true, note: "interest_recorded_no_payment" });
  } catch (e) {
    return serverError(e);
  }
};
