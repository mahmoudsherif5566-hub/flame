// POST /api/generate-image { prompt, width, height, seed? } -> image bytes
// Primary generator: Cloudflare Workers AI (FLUX), server-side only — the
// API token never reaches the browser. When the Cloudflare env vars are
// unset, 503 { error: "cloudflare_not_configured" } so the page falls back
// to Pollinations. AI-only: never a fake image.
const { CF_CONFIGURED, validateImageRequest, generateImageCF } = require("./lib/_cloudflare.cjs");
const { send, readBody } = require("./lib/_lib.cjs");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return send(405, { ok: false, error: "method_not_allowed" });
    if (!CF_CONFIGURED) return send(503, { ok: false, error: "cloudflare_not_configured" });
    const v = validateImageRequest(readBody(event));
    if (v.error) return send(400, { ok: false, error: v.error });
    const { bytes, contentType } = await generateImageCF(v);
    return {
      statusCode: 200,
      headers: { "Content-Type": contentType, "Cache-Control": "no-store" },
      body: bytes.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    console.error(e);
    return send(502, { ok: false, error: "generation_failed", detail: String(e.message).slice(0, 200) });
  }
};
