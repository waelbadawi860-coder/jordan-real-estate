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

## Stages 4–8
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
- npm blocked install scripts for 3 helper packages (`@parcel/watcher`, `@swc/core`, `unrs-resolver`) as a safety default; left blocked unless a tool turns out to need them.
