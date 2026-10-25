# ملخص المشروع للانتقال إلى محادثة جديدة — منصة «عقار»

آخر تحديث: 25 تشرين الأول 2026 · آخر تعديل في الكود: «إعادة الموافقة على الشروط»

> **للبدء في محادثة جديدة:** افتح المشروع في المجلد نفسه، والصق هذه الرسالة:
> «أكمل العمل على منصة عقار. اقرأ أولًا `docs/HANDOFF.md`.»

## 1. ما هو المشروع
- موقع إعلانات عقارية مبوبة للأردن، بأسلوب «حراج» (قائمة بسيطة سريعة)، عربي أولًا والإنجليزية تحت `/en`.
- الاسم «عقار» باللغتين. **الشعار الجديد:** حرف «ع» مع مبنى ودبوس خريطة برتقالي. الألوان: أخضر `#1d6b5d`، وأخضر داكن `#2a4a47`، وبرتقالي `#e29932`، وبيج `#e1caaa`.
- Claude هو المطوّر الوحيد. المالك ليس مبرمجًا: الشرح بلغة بسيطة، والعمل على مراحل.

## 2. الروابط والحسابات
- **نسخة الاختبار:** https://aqar-staging.vercel.app (Vercel Hobby، مشروع `aqar-staging`). مخفية عن Google. كل دفع إلى `main` يحدّثها خلال دقيقة أو دقيقتين.
- **الكود:** GitHub `waelbadawi860-coder/jordan-real-estate` (خاص).
- **قاعدة البيانات (تطوير واختبار):** Supabase `aqar-dev` (`bglfiabquferwviaysqd`)، فرانكفورت.
- **حساب المالك المشرف:** whb90@hotmail.com، مع تحقق بخطوتين مفعّل، و«إلزام المشرفين» مفعّل.
- **إعدادات Vercel الحالية:** `NEXT_PUBLIC_SITE_URL` (صحيح)، و`CRON_SECRET` (مضاف).

## 3. ما اكتمل (كله على نسخة الاختبار ومختبر)
**البحث والتصفح**
- وسوم خطوة بخطوة: نوع العرض، ثم نوع العقار، ثم المحافظة، ثم المنطقة.
  - مناطق عمّان: 20 منطقة بترتيب المالك في سطر واحد، وزر «كل المناطق (133)» مع بحث بالاسم.
  - وسم «✓ مكاتب موثّقة».
- زر **«فلاتر»** بجانب مربع البحث يفتح لوحة جانبية فوق الصفحة: من اليمين على الكمبيوتر، وكامل الشاشة على الهاتف.
- 12 محافظة و372 منطقة.

**الإعلان**
- النموذج: المنطقة **إجبارية**، وتُختار من خانة بحث واحدة.
- **موقع العقار:** خانة اختيارية تقبل رابط Google Maps أو إحداثيات. **يظهر للزوار كما أدخله المعلن** (قرار المالك)، مع تنويه «الموقع كما حدده المعلن»، وزر «عرض الموقع على خرائط Google».
- **«عروض مشابهة»** أسفل كل إعلان، وزر **«متابعة العروض المشابهة»**.
- عبارة «منشور على مسؤولية المعلن» في أسفل الإعلان بخط صغير.

**المتابعات**
- إشعار داخل الموقع فورًا عند نشر عرض مطابق.
- ملخص يومي بالبريد الساعة 9 صباحًا (يعمل عند إضافة Resend).
- إلغاء بضغطة من رابط البريد، وصفحة «متابعاتي».

**الدخل (لا عمولة نهائيًا)**
- النشر مجاني للفرد حتى **3 إعلانات منشورة في الوقت نفسه** (يُغيَّر من الإعدادات).
- **الإعلان المميز** يظهر أعلى الصفحة الرئيسية والبحث بشارة «مميز · مدفوع». السعر: 5 دنانير لـ7 أيام، و9 لـ14 يومًا، و15 لـ30 يومًا. ورفع الإعلان للأعلى: 2 دينار. الأسعار تُغيَّر من الإعدادات.
- يسجّل المشرف الترويج بعد الدفع اليدوي (CliQ أو إي فواتيركم) من صفحة الإعلان في لوحة الإدارة.
- **المكاتب:**
  - صفحة «مكتبي».
  - صفحة عامة لكل مكتب.
  - **باقات:** الأساسية 20 دينارًا (25 إعلانًا)، والمتقدمة 45 (75 إعلانًا)، والمميزة 90 (200 إعلان). تُعدَّل من «المكاتب».
  - **«مكتب موثّق»:** المكتب يرفع السجل التجاري والترخيص والهوية، والمشرف يراجعها، والشارة تبقى سنة.
- صفحات **«الأسعار والخدمات»** و**«عن عقار»**، وشريط «لماذا عقار» في الصفحة الرئيسية.

**الإدارة والحماية**
- قائمة تدقيق من 5 بنود قبل قبول أي إعلان.
- صفحة «المكاتب» في لوحة الإدارة.
- بلاغات، وقائمة حظر، وإشارات خطر، وبصمة الصور، وسجلات دائمة.
- التحقق بخطوتين، ومطلوب أيضًا في قاعدة البيانات لمن فعّله.

**القانون**
- الصفحات الأربع حدّثت حسب المراجعة القانونية، نسخة `draft-2026-10-25`.
- المراجعة كاملة في `docs/LEGAL-REVIEW-2026-10.md`.
- صفحة «سياسة العمولة» حُذفت.
- إضافات بعد مقارنة مع السوق المفتوح وخريطة: اسم جهة الشكاوى (وزارة الاقتصاد الرقمي والريادة، يتأكد منه المحامي)، وممنوعات جديدة في سياسة النشر (أرقام على الصور، حذف وإعادة النشر للصعود، أكثر من عقار في إعلان)، ومنع البرامج الآلية والفحص الأمني دون إذن، وشكل بلاغ حقوق النشر المكتمل.
- **إعادة الموافقة عند تغيير الشروط:** عندما يرفع المشرف رقم نسخة الشروط أو سياسة الخصوصية من الإعدادات، يُطلب من كل مستخدم الموافقة على النص الجديد قبل استخدام صفحات حسابه أو نشر إعلان. تُحفظ الموافقة مع بصمة مجهولة للجهاز ونوع المتصفح. إذا لم يوافق يستطيع تسجيل الخروج أو طلب حذف حسابه.
  - **مهم:** ارفع رقم النسخة فقط عند تغيير جوهري. تصحيح خطأ إملائي لا يحتاج نسخة جديدة.
  - عند تحويل النسخ من `draft-…` إلى نهائية بعد المحامي، سيُطلب من كل المستخدمين الموافقة مرة أخرى، وهذا مقصود.

**الأمان والسرعة**
- فحص اختراق آلي (75 محاولة) ناجح بالكامل.
- مراجعة كود كاملة، وأُصلحت ثغراتها.
- **سرعة الهاتف** مع 1000 إعلان: الصفحة الرئيسية 99–100، والبحث 98، والإعلان 94–97. وقاعدة البيانات تجيب في 3ms.

**الاختبارات:** 48 وحدة، و95 قاعدة بيانات، و52 موقع، وكلها ناجحة.

## 4. قرارات المالك
- لا عمولة. الدخل من التمييز والرفع والباقات والتوثيق.
- الموقع الدقيق للعقار يظهر للزوار إذا أدخله المعلن.
- سقف التعويض في الشروط: ما دفعه المستخدم خلال الشهر السابق فقط.
- **تأجيل تسجيل الشركة 6–12 شهرًا** ما دام الموقع مجانيًا. **لكن لا تُباع أي خدمة مدفوعة قبل تسجيل نشاط تجاري.**
- **لا اختبار اختراق بشري الآن** (الميزانية). يُجرى قبل الدفع الإلكتروني أو عند النمو. النطاق جاهز في `docs/PENTEST-SCOPE.md`.
- **موقع ثانٍ لبيع منتجات أخرى لاحقًا** (بعد استقرار عقار): **بنفس المحرك وقاعدة البيانات**، بحساب واحد ورصيد مشترك و«تاجر موثّق». الاستراحات والشاليهات تُضاف إلى «عقار» نفسه.
- لا خرائط تفاعلية عند الإطلاق، ولا SMS الآن.

## 5. المتبقي قبل الإطلاق
1. **المحامي:** يراجع الصفحات على نسخة الاختبار مع `docs/LEGAL-REVIEW-2026-10.md`، ويحسم ما بين [الأقواس]: مدد الحفظ، والاسترداد، والضريبة، والمحكمة، واسم الجهة المشغّلة. بعده يحوّل Claude النسخ من `draft-…` إلى نهائية.
2. **الشعار:**
   - البحث في قاعدة WIPO عن Jordan فقط، بالعربي والإنجليزي، وبصورة الشعار.
   - ثم بحث رسمي لدى مديرية حماية الملكية الصناعية، ثم تسجيل **الشعار مع الكلمة** في الفئتين 35 و36.
   - طلب ملف الشعار الأصلي (SVG أو 1024px) من المصمم.
3. **النطاق**، ثم Resend (`RESEND_API_KEY` و`EMAIL_FROM`) والقوالب العربية وبريد التواصل.
4. **حسابات الإنتاج** (Supabase Pro وVercel Pro، حوالي 45$ شهريًا): `db push`، و`SITE_STAGE=live`، و`CRON_SECRET`، وحد إنفاق وتنبيهات.
5. **النسخ الاحتياطي واستعادة تجريبية، وUptimeRobot، وGoogle Search Console.**
6. **اختبار المالك على الهاتف** (`docs/STAGE-8-LAUNCH.md`، المرحلة E): البريد، والصور، والموافقة برمز التحقق، وملف CSV.

## 6. بعد الإطلاق
- SMS لتأكيد الهاتف.
- الاستراحات والشاليهات (إيجار يومي).
- الدفع الإلكتروني، برصيد مشترك يصلح للموقع الثاني لاحقًا.
- أدوار الموظفين.
- إحصاءات الزيارات.
- نسخ ملفات الصور احتياطيًا.
- شجرة الفئات للموقع الثاني.

---

## Technical notes for the next session (English)
- **Stack:** Next.js 16.4 App Router in `web/` with `cacheComponents` (`"use cache"`, tags `listings`, `reference-data`, `offices`, `listing-<id>`), `proxy.ts`, and `app/[lang]`. Read `web/AGENTS.md` and `node_modules/next/dist/docs` first. Supabase with RLS plus column-level grants everywhere, SECURITY DEFINER functions (`search_path=''`), Tailwind 4, Vercel `fra1`.
- **Migrations:** `web/supabase/migrations`, latest `20261029090000_terms_reconsent.sql`.
  - Run `npx supabase db push`, then `npm run db:types`.
  - A worktree needs `web/supabase/.temp/*` copied from the main checkout to be linked.
- **Key tables added this session:**
  - `listings.featured_until`, `bumped_at`, and `ranked_at` (generated; lists sort by `ranked_at`).
  - `listing_promotions`.
  - `office_plans`, `offices`, `office_plan_history`, `office_verifications`, plus the private `office-documents` bucket.
  - `saved_searches` and `saved_search_hits`.
  - Settings `max_active_listings_individual` and `price_*`.
- **Re-consent:** `pending_consents()` / `accept_current_terms(p_evidence)`; users can no longer insert into `user_consents` directly. `requireCurrentConsent()` (`lib/consent.ts`) gates `/my/*` and `/post`, redirecting to `/accept-terms?next=`. Trigger `listings_require_current_terms` blocks seller submissions while a consent is pending (`terms_consent_required`). Test helpers call `accept_current_terms` after sign-in.
- **Key functions:** `admin_promote_listing`, `admin_set_office_plan`, `admin_review_office_verification`, `admin_set_office_status`, `submit_office_verification`, `active_listing_limit` (the trigger `listings_check_active_limit` fires on every update), `notify_saved_searches` (trigger), `unsubscribe_saved_search`.
- **`is_admin()`** requires aal2 once the admin has a verified TOTP factor, or always when `require_admin_mfa` is on (it is ON on dev). **Test admins enroll TOTP automatically** through `tests/totp.ts` (`confirmTwoStep`).
- **Cron jobs:** `/api/cron/cleanup` (01:30 UTC) and `/api/cron/alerts` (06:00 UTC, the e-mail digest, which is skipped until `RESEND_API_KEY` and `EMAIL_FROM` are set). Both use `lib/cron.ts` and need `CRON_SECRET`.
- **Tests (from `web/`):**
  - `npm test`
  - `npx vitest run tests/db`
  - `SMOKE_BASE_URL=http://localhost:3000 npx vitest run tests/smoke` (needs the dev server)
  - `node --env-file=.env.local scripts/security-probe.mjs` (attacks staging and the dev database)
  - `scripts/load-test-data.mjs 1000` and `--remove` (speed-test data)
- **Gotchas:**
  - With `cacheComponents` the shell streams first, so a missing listing returns 200 with noindex, and old slugs redirect client-side.
  - A Postgrest query is thenable: never return it bare from an async function (wrap it, as `applyFilters` does with `{ q }`).
  - The dev server keeps stale CSS and new files: `rm -rf .next` and restart.
  - Write Arabic text with Python scripts or the Write tool, not shell heredocs with quotes.
  - Commit with `git commit -F`.
  - Staging reference data is cached for hours; a new deploy refreshes it.
- **Local-only secrets:** `web/.env.local`. The owner also had `C:\Users\WaelBadawi\Downloads\CRON_SECRET-for-Vercel.txt` and was asked to delete it.
