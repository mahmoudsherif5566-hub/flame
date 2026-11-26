// POST /api/generate-image { prompt, width, height, seed? } -> image bytes
// Primary generator: Cloudflare Workers AI (FLUX), server-side only — the
// API token never reaches the browser. When the Cloudflare env vars are
// unset, 503 { error: "cloudflare_not_configured" } so the page falls back
// to Pollinations. AI-only: never a fake image.
import { CF_CONFIGURED, validateImageRequest, generateImageCF } from "./_cloudflare.js";
import { send, readBody } from "./_lib.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return send(res, 405, { ok: false, error: "method_not_allowed" });
    if (!CF_CONFIGURED) return send(res, 503, { ok: false, error: "cloudflare_not_configured" });
    const v = validateImageRequest(await readBody(req));
    if (v.error) return send(res, 400, { ok: false, error: v.error });
    const { bytes, contentType } = await generateImageCF(v);
    res.writeHead(200, { "Content-Type": contentType, "Content-Length": bytes.length, "Cache-Control": "no-store" });
    return res.end(bytes);
  } catch (e) {
    console.error(e);
    return send(res, 502, { ok: false, error: "generation_failed", detail: String(e.message).slice(0, 200) });
  }
}
