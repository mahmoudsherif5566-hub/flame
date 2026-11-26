// /api/creatives — same shapes as server.js.
// GET  -> { creatives: [...] }
// POST { email, kind, title, prompt, sample } -> { ok, creative }
import { cleanEmail, store, send, readBody, requireSupabase } from "./_lib.js";

export default async function handler(req, res) {
  try {
    if (!requireSupabase(res)) return;
    if (req.method === "GET") {
      return send(res, 200, { creatives: await store.listCreatives() });
    }
    if (req.method === "POST") {
      const b = await readBody(req);
      const creative = await store.addCreative({
        email: b.email ? cleanEmail(b.email) : null,
        kind: ["ad", "studio"].includes(b.kind) ? b.kind : "ad",
        title: String(b.title || "").slice(0, 200),
        prompt: String(b.prompt || "").slice(0, 1000),
        sample: String(b.sample || "").slice(0, 100000), // thumbnail data URL (small JPEG) or sample name
      });
      return send(res, 200, { ok: true, creative });
    }
    return send(res, 405, { ok: false, error: "method_not_allowed" });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { ok: false, error: "server_error", detail: String(e.message).slice(0, 200) });
  }
}
