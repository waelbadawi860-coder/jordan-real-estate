# ملخص المشروع للانتقال إلى محادثة جديدة — منصة «عقار»

آخر تحديث: 20 تشرين الأول 2026 · آخر تعديل في الكود: `2b0cdaa` (فرع `main`)

> **للبدء في محادثة جديدة:** افتح المشروع في المجلد نفسه، والصق هذه الرسالة:
> «أكمل العمل على منصة عقار. اقرأ أولًا `docs/HANDOFF.md` و`docs/pre-launch-review.html` و`docs/STAGE-8-LAUNCH.md`.»

## 1. ما هو المشروع
- موقع إعلانات عقارية مبوبة للأردن، بأسلوب «حراج» (قائمة نصية بسيطة، لا بطاقات كبيرة)، عربي أولًا مع الإنجليزية تحت `/en`.
- الاسم «عقار» باللغتين، والأيقونة بيت أبيض على أخضر.
- Claude هو المطوّر الوحيد. المالك ليس مبرمجًا: الشرح بلغة بسيطة، والعمل على مراحل يؤكدها المالك.

## 2. الروابط والحسابات
- **نسخة الاختبار:** https://aqar-staging.vercel.app (Vercel Hobby، مشروع `aqar-staging`، فريق `wael-d2e5`). مخفية عن Google عمدًا.
- **الكود:** GitHub `waelbadawi860-coder/jordan-real-estate` (خاص). كل دفع إلى `main` يحدّث نسخة الاختبار تلقائيًا.
- **قاعدة البيانات (تطوير):** Supabase `aqar-dev`، المعرّف `bglfiabquferwviaysqd`، فرانكفورت، الخطة المجانية.
- **التقارير المنشورة:** [مراجعة الجاهزية (الإصدار 3)](https://claude.ai/artifact/N988q3oyubRSahhN5C18X3) · [مسودة المناطق](https://claude.ai/artifact/VRyDgKKBYKHeKeedZT5mzS)

## 3. ما اكتمل واختُبر
- الحسابات (بريد وكلمة مرور وتأكيد)، والإعلانات (إنشاء وتعديل وسحب وتجديد وانتهاء)، والمفضلة، والإشعارات.
- **البحث بأسلوب حراج، خطوة بخطوة:** الكل/بيع/إيجار ← النوع (مع «الكل»، أزرق) ← المحافظة (رمادي هادئ) ← المنطقة (بني). كل صف على سطر واحد مع شريط تمرير. «بحث مفصّل» للفلاتر الإضافية فقط، ويتبع اختيارات الوسوم.
- **الحقول حسب النوع، والقاعدة تفرضها:**

  | النوع | غرف | حمامات | طابق | عدد الطوابق | مفروش |
  |---|---|---|---|---|---|
  | شقة | ✓ | ✓ | ✓ | – | ✓ |
  | فيلا | ✓ | ✓ | – | ✓ | ✓ |
  | بيت مستقل | ✓ | ✓ | – | ✓ | ✓ |
  | أرض سكنية/تجارية | – | – | – | – | – |
  | عقار تجاري | – | ✓ | – | ✓ | – |
  | مكتب | – | ✓ | ✓ | – | ✓ |
  | محل | – | ✓ | ✓ | – | – |
  | عمارة | – | – | – | ✓ | – |
  | أخرى | – | ✓ | – | – | – |

  الطابق: تسوية، أرضي، الأول حتى الرابع، الخامس فما فوق، الأخير، الأخير مع روف. الأرض السكنية والعمارة للبيع فقط.
- **المحافظات:** 12 محافظة و172 منطقة (عمّان 40، والباقي 132 باعتماد المالك).
- **الحماية القانونية:**
  - إقرار المعلن إلزامي عند كل إرسال أو تعديل لإعلان منشور، ومحفوظ نهائيًا.
  - عبارة «القبول للنشر ليس تحققًا» في كل إعلان.
  - سجلات دائمة لا تُحذف، ونسخ لكل تعديل في الإعلان.
- **البلاغات:** عن الإعلان أو المعلن، برقم مرجعي (L-/U-)، مع إيقاف مؤقت للإعلان وإعادته.
- **صفحة اتصل بنا:** بريد فقط. يظهر «سيُعلن قريبًا» حتى يُضبط البريد في الإعدادات.
- **مكافحة الاحتيال:**
  - 10 إشارات خطر تُحسب عند الإرسال.
  - بصمة لكل صورة.
  - قائمة حظر للأرقام والبريد.
- **التحقق بخطوتين للمشرفين:** صفحة `/my/security`، وإلزامي في الموقع المنشور.
- **مسودات قانونية** بالعربية والإنجليزية: `/terms` و`/privacy` و`/posting-policy` و`/reporting-policy`، وعليها تنبيه «مسودة».
- **التنظيف اليومي للصور** (`/api/cron/cleanup`) يحتاج المفتاح `CRON_SECRET` في Vercel.
- **الاختبارات:** 40 وحدة، و89 قاعدة بيانات، و48 موقع، وكلها ناجحة. Lighthouse على الهاتف: 98–99.

## 4. قرارات المالك
- البدء صغيرًا.
- تأكيد الهاتف بـ SMS مؤجل.
- لا خرائط عند الإطلاق.
- لا اختبار اختراق بشري الآن.
- العمولة مبنية لكنها **مطفأة** حتى موافقة المحامي.
- الاسم «عقار» باللغتين.
- بريد التواصل يكون على نطاق الموقع لاحقًا.

## 5. التكلفة الشهرية عند الإطلاق
| البند | التكلفة |
|---|---|
| Vercel Pro | 20$ شهريًا |
| Supabase Pro | 25$ شهريًا |
| نطاق ‎.com | حوالي 11$ سنويًا |
| Resend، وتحويل البريد عبر Cloudflare، وUptimeRobot | مجانية |

**المجموع: حوالي 45$ (32 دينارًا) شهريًا**، وحوالي 391 دينارًا في السنة الأولى. أتعاب المحامي وتسجيل الشركة غير محسوبة.

## 6. المتبقي قبل الإطلاق (بالترتيب)
1. **المحامي** يراجع النصوص القانونية والإقرار ودور المنصة ومدد الاحتفاظ. ثم Claude يطبق التعديلات ويغيّر النسخ من `draft-…` إلى نهائية.
2. **تأسيس الشركة** ونقل الحسابات باسمها.
3. **شراء النطاق**، ثم Claude يجهّز Resend وSMTP والقوالب العربية، ويضبط `contact_email` وبريد تنبيه الإدارة.
4. **حسابات الإنتاج** (Supabase Pro وVercel Pro): مشروع `aqar-prod`، و`db push` لكل التحديثات، و`SITE_STAGE=live`، و`CRON_SECRET`.
5. **النسخ الاحتياطي** (مفتاحا GitHub) واستعادة تجريبية، وUptimeRobot، وGoogle Search Console.
6. **المالك:** تفعيل التحقق بخطوتين لحسابه، ثم تشغيل «إلزام المشرفين» في الإعدادات.
7. **اختبار القبول النهائي** على الهاتف (القائمة في `docs/STAGE-8-LAUNCH.md` المرحلة E).

## 7. بعد الإطلاق
- SMS.
- أدوار الموظفين، والإجراءات الجماعية.
- طلب موافقة جديدة عند تغيير نسخة الشروط.
- إحصاءات الزيارات.
- نسخ ملفات الصور احتياطيًا.
- شجرة فئات للسيارات وغيرها (10–15 يومًا).
- إعادة قياس Lighthouse لصفحة الإعلان، واختبار سعة من مصادر متعددة.

---

## Technical notes for the next session (English)
- **Stack:** Next.js 16.4 App Router in `web/`. It uses `cacheComponents`, `"use cache"` with tags `listings` and `reference-data`, `proxy.ts`, and `app/[lang]` for languages. Read `web/AGENTS.md` and `node_modules/next/dist/docs` before writing Next code. Also Supabase (RLS everywhere, security-definer functions), Tailwind 4, and Vercel functions pinned to `fra1` (`web/vercel.json`, which also defines the cron).
- **Migrations:** `web/supabase/migrations`, latest `20261027090200_floors_count.sql`.
  - Apply with `npx supabase db push`, then `npm run db:types`.
  - Any new `listings` column needs an explicit `grant select (col)` (column-level grant).
  - The trigger functions `listings_check_type_rules`, `listings_before_update` (bait-and-switch plus risky-text check), `record_listing_version` and `change_listing_status` were redefined several times. Always copy the **latest** definition before changing one.
- **Tests:** run from `web/`.
  - `npm test` (unit), `npx vitest run tests/db`, and `npm run test:smoke` (needs the dev server on port 3000).
  - DB tests share a limit of 3 new listings per day per user: insert through the service client with `seller_id`.
  - Every submit in tests must call `declare_listing` first.
- **Gotchas:**
  - PowerShell garbles Arabic: edit with Python or the Write/Edit tools.
  - Commit with `git commit -F`.
  - `text[] || 'x'` needs `array_append`.
  - `supabase db query --linked` can't take multi-line `$$`; flatten it to one line.
  - The dev server sometimes keeps stale CSS after new theme tokens: restart it.
  - Load-testing staging triggers Vercel's DDoS challenge on our IP for about an hour.
- **Local-only secrets:** `web/.env.local` (Supabase keys, `CRON_SECRET`). It is never committed.
