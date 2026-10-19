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

## Stages 3–8
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
- npm blocked install scripts for 3 helper packages (`@parcel/watcher`, `@swc/core`, `unrs-resolver`) as a safety default; left blocked unless a tool turns out to need them.
