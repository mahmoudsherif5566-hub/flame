// GET /api/stats -> { total, today, week, lastRegistrationAt, mode }
// Same shape as server.js and api/stats.js; today/week are computed in Africa/Cairo.
const { store, send, requireSupabase, serverError } = require("./lib/_lib.cjs");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") return send(405, { ok: false, error: "method_not_allowed" });
    const missing = requireSupabase();
    if (missing) return missing;
    return send(200, await store.stats());
  } catch (e) {
    return serverError(e);
  }
};
