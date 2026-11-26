# نشر Flame على Vercel (الخطة المجانية — من غير بطاقة)

Vercel بيدي خطة Hobby مجانية من غير ما يطلب بطاقة، وده بديل Render اللي طلب بطاقة.
المشروع جاهز للنشر من نفس مستودع GitHub: https://github.com/mahmoudsherif5566-hub/flame

## الملفات الجديدة (Vercel فقط — السيرفر المحلي زي ما هو)

- `vercel.json` — بيقول لـ Vercel إن الملفات الثابتة في `public/`، وإن مفيش خطوة بناء.
- `api/_lib.js` — منطق مشترك (التحقق من الإيميل، حساب اليوم/الأسبوع بتوقيت القاهرة، الاتصال بـ Supabase). نفس منطق `server.js` بالظبط، لكن **من غير SQLite** (نظام الملفات في السيرفرلس مؤقت).
- `api/health.js` — ‏GET /api/health
- `api/stats.js` — ‏GET /api/stats
- `api/register.js` — ‏POST /api/register
- `api/creatives.js` — ‏GET / POST /api/creatives
- `api/pro-interest.js` — ‏POST /api/pro-interest
- `.vercelignore` — بيمنع رفع قاعدة البيانات المحلية وملفات التجربة.

نفس شكل الردود والتحقق زي `server.js` بالظبط، فالواجهة (`public/index.html`) شغالة من غير أي تعديل.

## خطوات النشر (مرة واحدة)

1. افتح https://vercel.com وسجّل الدخول بـ GitHub (نفس الحساب `mahmoudsherif5566-hub`).
2. اضغط **Add New → Project** واختار مستودع **flame**.
3. خلّي الإعدادات زي ما هي (Framework Preset: Other، و Output Directory هيتقرا من `vercel.json`).
4. **قبل النشر، ضيف متغيرات البيئة** في Project Settings → Environment Variables:
   - `SUPABASE_URL` = رابط مشروع Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` = مفتاح الـ service_role (سرّي — يتحط هنا بس، ومايتكتّبش في أي ملف)
5. اضغط **Deploy**. هيطلع لينك عام زي `flame-xxxx.vercel.app`.

## التحقق بعد النشر

- افتح `https://<اللينك>/api/health` — لازم يرجع `"mode":"supabase"` و `"supabaseConfigured":true`.
- سجّل إيميل تجريبي من الموقع وتأكد إن العدد زاد، وبعدين امسح الإيميل التجريبي من جدول `registrations` في Supabase.

## ملاحظات مهمة

- **من غير متغيرات البيئة** الموقع هيفتح عادي بس التسجيل والعدّاد مش هيشتغلوا: `/api/health` هيرجع `"mode":"not_configured"` وباقي الـ API هيرجع `503 supabase_not_configured`.
- خطة Hobby المجانية: الدومين `*.vercel.app` مجاني، والدوال السيرفرلس ليها حدود استخدام شهرية سخية لموقع زي ده. لو الموقع كبُر جدًا في المستقبل ممكن يحتاج خطة مدفوعة.
- **السيرفر المحلي لسه شغال زي ما هو**: `./start.sh` → http://localhost:3000 بنفس `server.js` وقاعدة SQLite المحلية. نسخة Vercel مش بتلغي ولا بتغيّر أي حاجة فيه.
- القيم السرية (مفتاح Supabase) **ممنوع** تتكتب في أي ملف في المشروع — متغيرات بيئة بس.
