// POST /api/generate-image { prompt, width, height, seed? } -> image bytes
// Primary generator: Cloudflare Workers AI (FLUX), server-side only — the
// API token never reaches the browser. When the Cloudflare env vars are
// unset, 503 { error: "cloudflare_not_configured" } so the page falls back
// to Pollinations (its own client-side retries, same as Netlify/Vercel).
// AI-only: never a fake image.
import { cfConfigured, validateImageRequest, generateImageCF } from "./_cloudflare.js";
import { json, readBody } from "./_lib.js";

export async function onRequest(context) {
  const { request, env } = context;
  try {
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
    if (!cfConfigured(env)) return json({ ok: false, error: "cloudflare_not_configured" }, 503);
    const v = validateImageRequest(await readBody(request));
    if (v.error) return json({ ok: false, error: v.error }, 400);
    const { bytes, contentType } = await generateImageCF(v, env);
    return new Response(bytes, {
      status: 200,
      headers: { "Content-Type": contentType, "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "generation_failed", detail: String(e?.message || e).slice(0, 200) }, 502);
  }
}
