// Flame — Cloudflare Workers AI image generation for Pages Functions.
// Workers-native port of api/_cloudflare.js (shared by server.js and the
// Vercel api/generate-image.js function).
// Primary image generator: @cf/black-forest-labs/flux-1-schnell via the
// Cloudflare REST API. The API token lives ONLY in env vars (context.env)
// and is never sent to the browser — the browser calls our own
// /api/generate-image. When the env vars are unset, callers must answer 503
// { error: "cloudflare_not_configured" } so the page falls back to
// Pollinations. AI-only: never a fake image.
// No Node-only APIs are used (base64 is decoded with atob, bytes are
// Uint8Array), so no nodejs_compat flag is needed.
// CLOUDFLARE_API_BASE_URL is a local-test override only (default is the
// real Cloudflare API); never set it in production.

export const CF_MODEL_ID = "@cf/black-forest-labs/flux-1-schnell";

export function cfConfigured(env) {
  return Boolean(env?.CLOUDFLARE_ACCOUNT_ID && env?.CLOUDFLARE_API_TOKEN);
}

// Validate a /api/generate-image request body. Returns the cleaned request
// or { error } (missing_prompt / prompt_too_long).
export function validateImageRequest(body) {
  const prompt = String(body?.prompt || "").trim();
  if (!prompt) return { error: "missing_prompt" };
  if (prompt.length > 2048) return { error: "prompt_too_long" };
  const width = Number(body?.width) || 1024;
  const height = Number(body?.height) || 1024;
  const seedRaw = body?.seed === undefined || body?.seed === null ? Math.floor(Math.random() * 1e9) : Number(body.seed);
  return {
    prompt,
    // Accepted for the API shape; FLUX itself only takes prompt and steps
    // (seed is never forwarded — the model rejects it with a 400)
    // and returns 1024x1024 — the page cover-crops it to the chosen ad size.
    width: Math.min(2048, Math.max(256, Math.round(width))),
    height: Math.min(2048, Math.max(256, Math.round(height))),
    seed: Number.isFinite(seedRaw) ? Math.floor(Math.abs(seedRaw)) : Math.floor(Math.random() * 1e9),
  };
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Call Cloudflare Workers AI. Returns { bytes: Uint8Array, contentType }.
// The REST API answers with a JSON envelope { result: { image: "<base64>" } };
// a raw binary image response is tolerated too.
export async function generateImageCF({ prompt }, env) {
  const base = (env.CLOUDFLARE_API_BASE_URL || "https://api.cloudflare.com/client/v4").replace(/\/$/, "");
  const url = `${base}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${CF_MODEL_ID}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, steps: 4 }),
  });
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("image/")) {
    if (!res.ok) throw new Error(`Cloudflare ${res.status}`);
    return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: ct.split(";")[0].trim() };
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    const msg = json?.errors?.[0]?.message || json?.errors?.[0]?.code || text.slice(0, 200);
    throw new Error(`Cloudflare ${res.status}: ${msg}`);
  }
  const b64 = json?.result?.image || json?.image || (typeof json?.result === "string" ? json.result : null);
  if (!b64) throw new Error("Cloudflare: no image in response");
  return { bytes: base64ToBytes(b64), contentType: "image/jpeg" };
}
