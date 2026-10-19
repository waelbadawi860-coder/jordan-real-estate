# Progress Checklist

Legend: [x] done and verified · [ ] not done · (you) = needs your action

## Stage 1 — Planning and setup
- [x] Inspected project folder (empty) and tools (Git 2.55 installed)
- [x] Wrote Stage 1 plan — `docs/STAGE-1-PLAN.md`
- [x] Decisions in section 9 approved (all recommendations accepted, 2026-10-19)
- [x] (you) GitHub account created — username `waelbadawi860-coder`
- [x] Installed Node.js 24.20.0 LTS and npm 11.19.0
- [x] Created Next.js 16.4.2 app in `web/` and installed packages (Supabase, next-intl, zod, lucide-react, Supabase CLI, Vitest, Playwright)
- [x] Confirmed `npm run dev` serves the starter page at http://localhost:3000 (HTTP 200)
- [x] First Git commit (one repository at project root, branch `main`)
- [x] (you) Created private GitHub repository `waelbadawi860-coder/jordan-real-estate`; code pushed to `main`
- [x] **Stage 1 complete**

## Stage 2 — Database and authentication
- [x] (you) Supabase account and development project `aqar-dev` (ref `bglfiabquferwviaysqd`, Frankfurt)
- [x] Keys written to `web/.env.local` via the Supabase CLI (not shown in chat; file not in Git)
- [x] 6 migrations applied: schema, security policies, listing workflow, photo storage, reference data, function lock-down
- [x] RLS enabled on all 15 tables, explicit column-level permissions — see `docs/DATABASE.md`
- [x] Reference data loaded: 10 property types, 12 cities, 40 Amman neighborhoods, default settings
- [x] Hourly listing-expiry job scheduled (pg_cron)
- [x] Private + public photo buckets with upload rules (images only, 5 MB)
- [x] Login settings applied: email + password, email confirmation ON, min 8 chars with letters and digits, redirect `http://localhost:3000/**`, phone login off
- [x] Supabase connection code for browser, server and trusted admin use; startup check for missing settings
- [x] **Automated security tests: 40/40 passed** (anonymous, ordinary, suspended and admin users) — `npm run test:db`
  - First run found a real gap: two server-only functions were callable by anyone. Fixed by migration `20261019100500`, re-tested.
- [ ] (you) Manual check below, then confirm Stage 2

### Manual check (5 minutes, in the Supabase dashboard)
1. **Table Editor** (left menu): you should see tables such as `listings`, `profiles`, `cities`. None should show a red "Unrestricted" label.
2. Open `neighborhoods`: 40 rows (Abdoun, Khalda, Dabouq …).
3. **Storage**: two buckets — `listing-photos` (Private) and `listing-photos-public` (Public).
4. **Authentication → Users**: empty (the test users were removed automatically).
5. **Authentication → Sign In / Providers → Email**: "Confirm email" is ON.

## Stage 3 — Public website
- [x] Arabic-first, right-to-left layout; English at `/en/...`; language switch keeps the page and filters
- [x] Cairo font, brand colours in one place (`web/src/app/globals.css`), mobile-first layouts
- [x] Home page: search form (works without JavaScript), latest listings, "Add property" call to action
- [x] Search results: sale/rent, city, neighborhood, type, keyword, price, area, bedrooms, sorting; "Show more" (fast keyset pagination); invalid filters ignored with a notice
- [x] Property page: photos, price, facts, description, seller name, safety tip, share, report link
- [x] Phone number hidden until "Show phone number" is tapped; server rate limit 30/hour per visitor (IP stored only as an anonymous hash); Call + WhatsApp with the prefilled Arabic message
- [x] SEO: unique titles/descriptions, canonical URLs, Arabic/English alternates, `sitemap.xml` (published listings only), `robots.txt`, Open Graph previews (title, price, neighborhood, first photo) readable by WhatsApp/Facebook
- [x] Correct HTTP status: missing/sold/expired listing → 404; short or outdated listing address → 308 redirect
- [x] Public data cached for 1 minute (listings) / 1 hour (cities, types, settings)
- [x] Placeholder pages (marked "being prepared", hidden from search engines): add property, login, terms, privacy, commission policy, contact
- [x] Demo data: `npm run demo:add` / `npm run demo:remove` (14 listings marked "[تجريبي]", development only)
- [x] Automated tests: **57/57 passed** (42 database security incl. rate limiter, 15 helper tests); production build succeeds
- [x] Checked in browser at 360px, 375px and 1280px wide: no horizontal scrolling
- [ ] (you) Manual check below, then confirm Stage 3

### Manual check (10 minutes) — keep `npm run dev` running and open http://localhost:3000
1. Home page is in Arabic, text flows right-to-left, and 12 demo listings appear.
2. Choose **للإيجار** (for rent), city **عمّان**, press **ابحث** → only rental listings appear.
3. On the results page open **خيارات أكثر** (more filters), set max price 1000, search → only cheap rentals remain.
4. Scroll down, press **عرض المزيد** (show more) on an unfiltered search → 2 more listings load, button disappears.
5. Open a listing → photos, price, details. Press **إظهار رقم الهاتف** → number `06 000 0000` and Call/WhatsApp buttons appear. (Demo number — don't call it.)
6. Press **English** at the top → same page in English, left-to-right.
7. On your phone browser or Chrome's phone view (F12 → phone icon): everything fits, buttons are easy to tap.
8. Visit http://localhost:3000/property/999999 → "page not found".

## Stage 4 — User accounts and listings
- [x] Register (name, email, password ≥8 with letters+digits, consent checkbox), email confirmation, login, logout, forgot/reset password
- [x] Consent recorded at registration (`user_consents`, version `draft-2026-10` until legal review)
- [x] Open-redirect protection on "return to" links after login
- [x] My account: name, default phone, preferred language, change password, request account deletion (withdraws listings immediately, removes public photos)
- [x] Add property form adapts to type (bedrooms/furnished only for homes; rent period only for rentals); neighborhoods follow the chosen city; values kept if there's an error
- [x] Phone accepted as 07XXXXXXXX / +962…; WhatsApp only for mobile numbers
- [x] Photos: compressed in the browser to WebP (≤1600px) + 480px thumbnail, hidden GPS data removed, progress bar, main-photo choice, delete; max 20
- [x] Photos become public only when the listing is published, after a server check that each file is a genuine image; removed again when unpublished
- [x] Preview page, submit for review, back to draft, resubmit after rejection, withdraw (with reason), mark sold/rented, archive, delete draft, renew (last 7 days or expired)
- [x] Editing text **or adding photos** to an approved listing sends it back for review (database rules)
- [x] Favourites: save/remove on property pages; favourites page
- [x] Header shows "My account" when logged in
- [x] Automated tests: **83 passed** — 45 database security, 29 unit (incl. Arabic/English text consistency), 9 logged-in page smoke tests incl. real photo upload
- [x] Production build succeeds
- [ ] (you) Manual check below, then confirm Stage 4

### Manual check (15 minutes) — `npm run dev`, then http://localhost:3000
> **Important:** until a custom email service is connected, Supabase only sends emails to the
> address you use for your Supabase/GitHub account. Register with **that** email.

1. Click **دخول** → **إنشاء حساب**. Enter your name, that email, a password with letters and numbers, tick the consent box → message "we sent a confirmation link".
2. Open the email → click the link → you arrive logged in (or are asked to log in).
3. Click **أضف عقارك**. Fill in: للإيجار, monthly, شقة, a title, price 500, Amman / Khalda, phone 07XXXXXXXX → **حفظ ومتابعة إلى الصور**.
4. Add 2–3 photos from your computer/phone → progress bar → photos appear; make the 2nd one the main photo.
5. **متابعة إلى المعاينة** → check the preview → **إرسال للمراجعة** → status becomes **قيد المراجعة** (pending review).
   *(Approving it needs the admin dashboard — Stage 5.)*
6. **إعلاناتي** (My listings): the listing shows with its status and photo.
7. **الحساب** (Account): change your name → saved. Try a wrong phone like `123` → error message.
8. Log out, then use **نسيت كلمة المرور؟** on the login page → open the email **in the same browser** → set a new password.
9. Open any demo listing → **حفظ في المفضلة** (save) → it appears under **المفضلة**.
10. Make yourself an administrator for Stage 5 (in a terminal, inside the `web` folder):
    `npm run make-admin -- your-email@example.com`

## Stage 5 — Administrator dashboard (`/admin`)
- [x] Access checked on the server for every page/action, and again in the database; non-admins get "page not found"; admin pages hidden from search engines
- [x] Overview: listings awaiting review, live, expired, sold/rented, new listings/users (7 days), users, suspensions, deletion requests, open reports and messages
- [x] Listings: search by ID/title, status, city, date range, seller; review queue (oldest first); full listing view incl. private photos, contact phone, reports and status history
- [x] Moderation: approve & publish (copies photos to public), reject with reason (shown to seller + notification), take down, archive, extend 30 days, end now
- [x] Users: search by email/name/phone, status filter; detail page with listings and reports; suspend (optionally taking down their listings) / reactivate with reason; complete deletion (removes name, phone, contact numbers, favourites; replaces the login email and blocks login; keeps withdrawn listings and audit records)
- [x] Reports & messages: listing reports, user reports, contact messages — mark reviewing / resolved / dismissed with internal note
- [x] Public "Contact us / report an issue" page: report a listing (reason + details), general message form; limited per visitor, spam trap
- [x] Settings editable without code: site names, contact email, expiry days, renewal window, posting/photo/report limits, photo size, approval required, document versions
- [x] Cities, neighborhoods and property types: add, rename, reorder, deactivate
- [x] Audit log viewer (every admin action and settings change, with before/after values)
- [x] CSV export (listings, users, reports) — opens correctly in Excel with Arabic, protected against formula injection, every export logged
- [x] "Admin dashboard" tab in My account for administrators
- [x] Automated tests: **99 passed** — 50 database security, 34 unit, 15 smoke (logged-in + admin pages, CSV exports)
- [x] Production build succeeds
- [ ] (you) Manual check below, then confirm Stage 5

### Manual check (15 minutes) — `npm run dev`, then http://localhost:3000
1. If you haven't yet, make yourself admin (terminal, inside the `web` folder): `npm run make-admin -- your-email@example.com`, then log out and in again.
2. **حسابي** → new tab **لوحة الإدارة** (Admin dashboard) → the overview shows "awaiting review" = your Stage 4 listing.
3. Click **مراجعة** (Review) → open your listing → **موافقة ونشر** (Approve). Open the home page: your listing appears with its photos.
4. Back in the admin listing page → type a reason → **إيقاف النشر** (Take down) → it disappears from the site; **My listings** shows "Rejected" with your reason.
5. Open a demo listing on the public site → **الإبلاغ عن هذا الإعلان** → choose a reason → send. In **البلاغات والرسائل** (Reports) the report appears → mark it **تم الحل** (Resolved).
6. **الإعدادات** (Settings): change "listing duration" to 45 → Save → **سجل العمليات** (Audit log) shows the change with old and new value. Set it back to 30.
7. **المدن والمناطق**: add a test neighborhood to Amman → it appears in the search form's neighborhood list within a few minutes. Untick "Active" to hide it again.
8. **التصدير** (Export): download "Listings" → open in Excel → Arabic titles display correctly.
9. Log in with a normal (non-admin) account, or log out, and visit http://localhost:3000/admin → "page not found".

## Stage 6 — Commission system (built, **switched OFF** until legal approval)
- [x] Agreement versions: bilingual, never edited in place; new versions replace the "current" one; each marked *draft* or *legally reviewed* (review requires a lawyer/firm note). Your draft wording is stored as `draft-2026-10`, labelled "draft – not legally reviewed" wherever it appears
- [x] Commission rules per deal type: % of sale price / annual rent / monthly rent, or fixed amount; optional minimum and maximum; due days; trigger (transaction completed / contract signed). New rules replace old ones without changing earlier agreements
- [x] Seller acceptance before submitting (when commissions are on): agreement text + rule in plain words + unticked checkbox; stores exact version, rule snapshot, text fingerprint (SHA-256), time, anonymous IP fingerprint and browser
- [x] Listing published under an agreement: "Mark sold/rented" opens a transaction form (date, agreed value, confirmation) with a live estimate; the database calculates the official amount and creates the commission with a reference number (e.g. `CM-100017-3F9A2`)
- [x] Seller commission page: amount due, verified, remaining, due date, CliQ/bank instructions (from Settings), "I paid" report, dispute form, full history
- [x] Statuses: awaiting confirmation → not yet due → due → payment reported → paid (verified) / disputed / waived. A seller's report never marks anything paid
- [x] Admin: commission inbox with totals kept separate (estimated outstanding · reported but unverified · **verified received**), confirm transaction, verify payment (amount, date, bank reference required) or reject with reason, adjust amount (reason required; original calculation kept), waive (reason), resolve dispute; CSV export; everything in the audit log and per-commission history
- [x] Safety: commissions **cannot be switched on in the live site** while the current agreement is an unreviewed draft; withdrawing a listing never creates a commission; sale/rent type locked once an agreement is accepted
- [x] Public commission policy page (shows "commissions are off" until enabled; marks draft text as draft)
- [x] Automated tests: **127 passed** (incl. 17 commission database tests; 200-case check that on-screen estimates match the database exactly; 6 commission page smoke tests)
- [x] Production build succeeds
- [ ] (you) Manual check below, then confirm Stage 6
- [ ] (you, before launch) Lawyer reviews: licensing, commission legality, agreement wording, e-signature/click-acceptance, dispute process

### Manual check (20 minutes, development site only)
1. Admin → **قواعد العمولة** (Rules) → create a **sale** rule: 2%, minimum 100, 7 days. Create a **rent** rule: 50% of monthly rent, 0 days.
2. Admin → **الإعدادات**: fill CliQ alias and IBAN with **test** values; set "Enable commission system" to ✓ → Save. (On your computer this is allowed with the draft text; on the live site it will be refused until the text is legally reviewed.)
3. As a seller, create a new listing → add a photo → **متابعة إلى المعاينة**: the agreement box appears with the draft label and "2% من سعر البيع النهائي". Try submitting without ticking → message; tick → submit.
4. Admin approves it. Seller → **إعلاناتي** → **تم البيع**: a form opens. Enter today's date and 100000 → it shows "العمولة المحسوبة: 2,000 د.أ" → tick → submit → the commission page opens with reference and payment instructions.
5. Seller reports a payment of 2000 (any reference). Status shows "payment awaiting verification", **not** paid.
6. Admin → **العمولات** → open it → **تأكيد الصفقة**, then verify the payment (amount 2000, a date, bank reference "TEST") → status "تم الدفع (مؤكَّد)"; the "verified received" total shows 2,000.
7. Try a dispute on another commission, then adjust the amount with a reason; check **سجل العمليات**.
8. **Switch commissions OFF again** in Settings when you're done, and delete the test rules' effect by leaving them (they're harmless while off).

## Stages 7–8
- [ ] Not started

## Known limitations / open items
- Legal model (brokerage licence, commission legality, agreement wording) is **not reviewed**. Commission feature stays switched off until a Jordanian lawyer approves it.
- Prices in the plan are approximate and must be re-checked before any purchase.
- Map provider not yet chosen (Stage 7).
- SMS/phone OTP login not planned for launch (cost and delivery to Jordan unverified).
- Supabase's built-in email sender is limited to a few emails per hour — fine for development; Resend must be connected before real users (Stage 4/7).
- Supabase Free tier: no backups, project pauses after ~1 week of inactivity (click "Restore" in the dashboard).
- Registration/login pages are built in Stage 4; Stage 2 only prepares the database and connection code.
- Anonymous (logged-out) listing reports and the "show phone number" rate limit are built in Stage 3/4 on the server.
- Photos are served directly from Supabase storage (no paid resizing service). Small thumbnails will be generated at upload time in Stage 4; until then cards load the full-size photo.
- Rental period (monthly/yearly) is shown when the listing provides it; the posting form (Stage 4) will ask for it.
- Keyword search matches listing titles only (simple and fast); full-text search can be added if needed.
- Replaced the `next-intl` package with Next.js's built-in language support (fewer dependencies, works with Next.js 16 caching).
- **Emails:** Supabase's built-in sender only reaches your own Supabase-account email and sends very few per hour. Custom bilingual email templates are ready in `web/supabase/templates/` but Supabase only allows them with a custom email provider (Resend) — to connect before launch. Until then, a password-reset link only works in the browser where it was requested.
- Watermarking photos is not implemented yet (setting exists, off). It will be added without altering the original photos.
- Photos uploaded but never attached to a listing (e.g. the browser closed mid-upload) may remain in private storage; a periodic clean-up job is planned.
- npm blocked install scripts for 3 helper packages (`@parcel/watcher`, `@swc/core`, `unrs-resolver`) as a safety default; left blocked unless a tool turns out to need them.
