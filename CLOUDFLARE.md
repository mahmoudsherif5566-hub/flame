# توليد الصور — Cloudflare Workers AI (الأساسي) + Pollinations (الاحتياطي)

الموقع بيولّد الإعلانات بالذكاء الاصطناعي الحقيقي على خطوتين:
1. **الأساسي: Cloudflare Workers AI** — نموذج FLUX (`@cf/black-forest-labs/flux-1-schnell`) عن طريق السيرفر (`POST /api/generate-image`).
2. **الاحتياطي: Pollinations** — لو Cloudflare مش متوصّل أو مشغول، الصفحة بترجع لـ Pollinations المجاني تلقائياً (زي قبل كده).

التوكن بتاع Cloudflare **مبيوصلش للمتصفح أبداً** — هو على السيرفر بس في متغيرات البيئة.

## المتغيرات المطلوبة

```
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
```

## التوكن بييجي منين؟ (مجاني)

1. اعمل حساب مجاني على [Cloudflare](https://dash.cloudflare.com/sign-up) (من غير بطاقة بنكية).
2. من لوحة التحكم: **Workers & Pages ← AI ← Workers AI** — هتلاقي الـ Account ID هناك.
3. اعمل API Token: **My Profile ← API Tokens ← Create Token** — اختار قالب فيه صلاحية **Workers AI** (أو صلاحية مخصصة: `Account: Workers AI: Edit`)، وانسخ التوكن.
4. الخطة المجانية: **10,000 Neurons في اليوم** (بتتصفّر 00:00 UTC) — دي حوالي **173 صورة FLUX في اليوم** بمقاس 1024×1024 و4 خطوات. لو خلصت، التوليد بيرجع للاحتياطي (Pollinations) تلقائياً.

## فين تحط المتغيرات؟

- **Netlify (الموقع الأساسي):** Site configuration ← Environment variables ← ضيف الاتنين ← **Redeploy** (إعادة النشر ضرورية عشان المتغيرات تتفعّل).
- **Vercel:** Project Settings ← Environment Variables ← ضيف الاتنين (Production) ← Redeploy.
- **محلي:** حطهم في ملف `.env` جنب `server.js` (مش بيتعمل له commit أبداً) وشغّل `./start.sh`.

## ملحوظات

- النموذج بيرجّع صورة 1024×1024 — الصفحة بتقصّها (cover) على مقاس الإعلان اللي اخترته (مربع / ستوري / بانر).
- لو المتغيرات مش متظبطة، الـ endpoint بيرجع `503 { error: "cloudflare_not_configured" }` والصفحة بتكمّل على Pollinations — مفيش صورة مزيفة أبداً.
- `CLOUDFLARE_API_BASE_URL` متغير **للاختبار المحلي بس** (عشان توجيه الطلبات لسيرفر وهمي) — متحطّوش في الإنتاج.

## التحقق بعد التوصيل

افتح `https://flame-studio.netlify.app/api/health` — لازم يفضل `mode: "supabase"`، وولّد إعلان من الموقع: لو Cloudflare شغال، الإعلان هيطلع حتى من غير ما تستنى الـ 45 ثانية بتوع Pollinations.
