# نشر Flame على Netlify (الخطة المجانية — من غير بطاقة)

Netlify بيدي خطة مجانية من غير ما يطلب بطاقة، واللينك الافتراضي بيكون زي
`flame-xxxx.netlify.app` — **من غير اسم حساب**، وتقدر تغيّر الاسم من إعدادات الموقع
لأي اسم متاح (مثلًا `flame-studio`).

المشروع جاهز للنشر من نفس مستودع GitHub: https://github.com/mahmoudsherif5566-hub/flame

## الملفات الجديدة (Netlify فقط — نسخة Vercel والسيرفر المحلي زي ما هم)

- `netlify.toml` — بيقول لـ Netlify إن الملفات الثابتة في `public/`، والدوال في
  `netlify/functions/`، وبيحوّل أي طلب `/api/*` للدالة المناسبة (اللينك بيفضل `/api/*`).
- `netlify/functions/lib/_lib.cjs` — منطق مشترك (التحقق من الإيميل، حساب اليوم/الأسبوع
  بتوقيت القاهرة، الاتصال بـ Supabase). نفس منطق `server.js` بالظبط، لكن
  **من غير SQLite** (نظام الملفات في السيرفرلس مؤقت). CommonJS (`.cjs`) عشان يشتغل
  رغم إن `package.json` فيه `"type": "module"`.
- `netlify/functions/health.cjs` — ‏GET /api/health
- `netlify/functions/stats.cjs` — ‏GET /api/stats
- `netlify/functions/register.cjs` — ‏POST /api/register
- `netlify/functions/creatives.cjs` — ‏GET / POST /api/creatives
- `netlify/functions/pro-interest.cjs` — ‏POST /api/pro-interest

نفس شكل الردود والتحقق زي `server.js` ونسخة Vercel بالظبط، فالواجهة
(`public/index.html`) شغالة من غير أي تعديل.

## خطوات النشر (مرة واحدة)

1. افتح https://app.netlify.com وسجّل الدخول بـ GitHub (نفس الحساب `mahmoudsherif5566-hub`).
2. اضغط **Add new site → Import an existing project** واختار مستودع **flame**.
3. خلّي الإعدادات زي ما هي (Publish directory: `public`، و Functions directory هيتقرا
   من `netlify.toml`).
4. **قبل النشر، ضيف متغيرات البيئة** في Site settings → Environment variables:
   - `SUPABASE_URL` = رابط مشروع Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` = مفتاح الـ service_role (سرّي — يتحط هنا بس، ومايتكتّبش في أي ملف)
5. اضغط **Deploy**. هيطلع لينك عام زي `https://flame-xxxx.netlify.app`.
6. (اختياري) غيّر اسم اللينك من Site settings → Site details → Change site name،
   لاسم نظيف متاح زي `flame-studio`.

## التحقق بعد النشر

- افتح `https://<اللينك>/api/health` — لازم يرجع `"mode":"supabase"` و `"supabaseConfigured":true`.
- سجّل إيميل تجريبي من الموقع وتأكد إن العدد زاد، وبعدين امسح الإيميل التجريبي من جدول `registrations` في Supabase.

## ملاحظات مهمة

- **من غير متغيرات البيئة** الموقع هيفتح عادي بس التسجيل والعدّاد مش هيشتغلوا: `/api/health` هيرجع `"mode":"not_configured"` وباقي الـ API هيرجع `503 supabase_not_configured`.
- نسخة Vercel (`api/`) والسيرفر المحلي (`server.js` + `./start.sh` → http://localhost:3000)
  لسه شغالين زي ما هم — نسخة Netlify مش بتلغي ولا بتغيّر أي حاجة فيهم.
- القيم السرية (مفتاح Supabase) **ممنوع** تتكتب في أي ملف في المشروع — متغيرات بيئة بس.
