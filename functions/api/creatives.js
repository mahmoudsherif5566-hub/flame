// /api/creatives — same shapes as server.js / api/creatives.js.
// GET  -> { creatives: [...] }
// POST { email, kind, title, prompt, sample } -> { ok, creative }
import { cleanEmail, createStore, json, readBody, requireSupabase } from "./_lib.js";

export async function onRequest(context) {
  const env = context.env;
  try {
    const missing = requireSupabase(env);
    if (missing) return missing;
    const store = createStore(env);
    if (context.request.method === "GET") {
      return json({ creatives: await store.listCreatives() });
    }
    if (context.request.method === "POST") {
      const b = await readBody(context.request);
      const creative = await store.addCreative({
        email: b.email ? cleanEmail(b.email) : null,
        kind: ["ad", "studio"].includes(b.kind) ? b.kind : "ad",
        title: String(b.title || "").slice(0, 200),
        prompt: String(b.prompt || "").slice(0, 1000),
        sample: String(b.sample || "").slice(0, 100000), // thumbnail data URL (small JPEG) or sample name
      });
      return json({ ok: true, creative });
    }
    return json({ ok: false, error: "method_not_allowed" }, 405);
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "server_error", detail: String(e?.message || e).slice(0, 200) }, 500);
  }
}
