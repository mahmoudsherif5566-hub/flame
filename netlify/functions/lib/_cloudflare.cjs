// Flame — Cloudflare Workers AI image generation for the Netlify Functions.
// CommonJS port of api/_cloudflare.js (same logic, same API contract).
// The API token lives ONLY in env vars and is never sent to the browser.
// No new dependencies — Node built-ins + global fetch only.
// CLOUDFLARE_API_BASE_URL is a local-test override only (default is the
// real Cloudflare API); never set it in production.

const CF_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const CF_API_BASE = (process.env.CLOUDFLARE_API_BASE_URL || "https://api.cloudflare.com/client/v4").replace(/\/$/, "");
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";

const CF_CONFIGURED = Boolean(CF_ACCOUNT_ID && CF_API_TOKEN);

// Validate a /api/generate-image request body. Returns the cleaned request
// or { error } (missing_prompt / prompt_too_long).
function validateImageRequest(body) {
  const prompt = String(body?.prompt || "").trim();
  if (!prompt) return { error: "missing_prompt" };
  if (prompt.length > 2048) return { error: "prompt_too_long" };
  const width = Number(body?.width) || 1024;
  const height = Number(body?.height) || 1024;
  const seedRaw = body?.seed === undefined || body?.seed === null ? Math.floor(Math.random() * 1e9) : Number(body.seed);
  return {
    prompt,
    // Accepted for the API shape; FLUX itself only takes prompt/steps/seed
    // and returns 1024x1024 — the page cover-crops it to the chosen ad size.
    width: Math.min(2048, Math.max(256, Math.round(width))),
    height: Math.min(2048, Math.max(256, Math.round(height))),
    seed: Number.isFinite(seedRaw) ? Math.floor(Math.abs(seedRaw)) : Math.floor(Math.random() * 1e9),
  };
}

// Call Cloudflare Workers AI. Returns { bytes: Buffer, contentType }.
// The REST API answers with a JSON envelope { result: { image: "<base64>" } };
// a raw binary image response is tolerated too.
async function generateImageCF({ prompt, seed }) {
  const url = `${CF_API_BASE}/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_MODEL}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${CF_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, steps: 4, seed }),
  });
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("image/")) {
    if (!res.ok) throw new Error(`Cloudflare ${res.status}`);
    return { bytes: Buffer.from(await res.arrayBuffer()), contentType: ct.split(";")[0].trim() };
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    const msg = (json && json.errors && (json.errors[0]?.message || json.errors[0]?.code)) || text.slice(0, 200);
    throw new Error(`Cloudflare ${res.status}: ${msg}`);
  }
  const b64 = (json && json.result && json.result.image) || (json && json.image) || (typeof (json && json.result) === "string" ? json.result : null);
  if (!b64) throw new Error("Cloudflare: no image in response");
  return { bytes: Buffer.from(b64, "base64"), contentType: "image/jpeg" };
}

module.exports = { CF_CONFIGURED, CF_MODEL_ID: CF_MODEL, validateImageRequest, generateImageCF };
