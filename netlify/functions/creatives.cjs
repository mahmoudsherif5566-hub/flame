// /api/creatives — same shapes as server.js and api/creatives.js.
// GET  -> { creatives: [...] }
// POST { email, kind, title, prompt, sample } -> { ok, creative }
const { cleanEmail, store, send, readBody, requireSupabase, serverError } = require("./lib/_lib.cjs");

exports.handler = async (event) => {
  try {
    const missing = requireSupabase();
    if (missing) return missing;
    if (event.httpMethod === "GET") {
      return send(200, { creatives: await store.listCreatives() });
    }
    if (event.httpMethod === "POST") {
      const b = readBody(event);
      const creative = await store.addCreative({
        email: b.email ? cleanEmail(b.email) : null,
        kind: ["ad", "studio"].includes(b.kind) ? b.kind : "ad",
        title: String(b.title || "").slice(0, 200),
        prompt: String(b.prompt || "").slice(0, 1000),
        sample: String(b.sample || "").slice(0, 100000), // thumbnail data URL (small JPEG) or sample name
      });
      return send(200, { ok: true, creative });
    }
    return send(405, { ok: false, error: "method_not_allowed" });
  } catch (e) {
    return serverError(e);
  }
};
