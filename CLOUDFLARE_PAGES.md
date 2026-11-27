# Flame on Cloudflare Pages

Same site as the Netlify/Vercel deployments, hosted on Cloudflare Pages
instead: the static frontend in `public/` plus Pages Functions in
`functions/` that serve the same `/api/*` endpoints. The frontend is
unchanged — it calls relative `/api/*` paths, so it works on a
`*.pages.dev` URL with no code changes.

## Why

Netlify (`flame-studio.netlify.app`) does not load on the owner's phone,
and the Vercel URL contains his username, which he does not want public.
Cloudflare Pages gives a clean `flame.pages.dev` URL (a custom domain can
be added later).

## Files

- `functions/api/health.js` — GET `/api/health`
- `functions/api/stats.js` — GET `/api/stats`
- `functions/api/register.js` — POST `/api/register`
- `functions/api/creatives.js` — GET + POST `/api/creatives`
- `functions/api/pro-interest.js` — POST `/api/pro-interest`
- `functions/api/generate-image.js` — POST `/api/generate-image`
- `functions/api/_lib.js` — shared helpers (validation, Cairo-time stats,
  Supabase REST, Response helpers). Files starting with `_` are not routed
  by Pages, so `/api/_lib` is not an endpoint.
- `functions/api/_cloudflare.js` — Workers AI client (FLUX
  `@cf/black-forest-labs/flux-1-schnell`, prompt + steps only — **no seed**;
  sending `seed` made the model reject the request with a 400).
- `wrangler.toml` — Pages project config (`name = "flame"`,
  `pages_build_output_dir = "public"`).

The Netlify (`netlify/functions/`) and Vercel (`api/`) functions and
`server.js` are untouched — this is an additive port with the same
endpoint shapes and the same behavior.

### Behavior notes

- Image generation is Cloudflare Workers AI first. When the Cloudflare
  env vars are unset the endpoint answers 503
  `{ error: "cloudflare_not_configured" }` and the page falls back to
  Pollinations directly from the browser (its own retries), exactly as on
  Netlify/Vercel. There is no server-side Pollinations fallback — the
  free tier rate-limits per IP, so a server-side call would share one
  egress IP across all visitors.
- Env vars are read from `context.env`, never `process.env`. The code
  uses only Web-standard APIs (fetch, atob, Intl, Response), so no
  `nodejs_compat` flag is needed.
- `CLOUDFLARE_API_BASE_URL` is a local-test override only; never set it
  in production.

## Local dev

```bash
# 1. Create .dev.vars in this directory (mock values are fine for testing):
#    SUPABASE_URL=http://127.0.0.1:8789
#    SUPABASE_SERVICE_ROLE_KEY=test-key
#    CLOUDFLARE_ACCOUNT_ID=test-acct
#    CLOUDFLARE_API_TOKEN=test-token
#    CLOUDFLARE_API_BASE_URL=http://127.0.0.1:8790/client/v4
#    (.dev.vars is git-ignored — never put real secrets in it.)
# 2. Run a mock Supabase + mock Cloudflare server if you have them
#    (see the test scripts used during development), then:
npx wrangler pages dev public --port 8788
# Open http://localhost:8788 — frontend + /api/* both served locally.
```

## Deploy

No secrets are in this repo. First set the production secrets, then deploy:

```bash
npx wrangler pages secret put SUPABASE_URL --project-name flame
npx wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY --project-name flame
npx wrangler pages secret put CLOUDFLARE_ACCOUNT_ID --project-name flame
npx wrangler pages secret put CLOUDFLARE_API_TOKEN --project-name flame

npx wrangler pages deploy public --project-name flame
```

(Or set the same four variables in the dashboard: Workers & Pages →
`flame` → Settings → Variables and Secrets, then deploy. To auto-deploy
from GitHub on every push, connect the `flame` repo in the dashboard
instead — production branch `main`, build output directory `public`,
no build command.)

The site will be live at `https://flame.pages.dev`.

## Env vars (production)

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL (same value as Netlify/Vercel) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (**secret**, never commit) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (same value as Netlify/Vercel) |
| `CLOUDFLARE_API_TOKEN` | Workers AI API token (**secret**, never commit) |

## Verify after deploy

```bash
curl https://flame.pages.dev/api/health
# {"ok":true,"mode":"supabase","supabaseConfigured":true}
```

Then open the site, register, and generate one ad — it should succeed
without the "service busy" message.
