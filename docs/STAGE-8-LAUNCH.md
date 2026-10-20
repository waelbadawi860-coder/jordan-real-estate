# Stage 8 — Launch runbook

Follow the phases in order. Steps marked **(you)** need your accounts, payment or decisions; Claude
can run every command with you and check each result. **Nothing costs money until Phase C.**

---

## Phase A — Free test copy on the internet (staging) — ≈ 30 minutes, $0

Purpose: try the real site on real phones before paying for anything. Uses the **development**
database (demo data), an address like `https://aqar-staging.vercel.app`, and is hidden from Google.
Vercel's free Hobby plan is for non-commercial use — fine for a private test copy.

1. **(you)** https://vercel.com → **Sign Up** → **Continue with GitHub** → authorize. Choose the **Hobby** plan.
2. **(you)** **Add New… → Project** → find `jordan-real-estate` → **Import**.
3. **(you)** On the configuration screen:
   - **Root Directory:** click **Edit** → choose `web` → Continue.
   - **Environment Variables** — add (values from your `web/.env.local`; Claude will help you copy them without pasting secrets in chat):
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
     - `SUPABASE_SECRET_KEY` (secret)
     - `NEXT_PUBLIC_SITE_URL` = `https://<the name Vercel shows>.vercel.app`
     - **Do not** set `SITE_STAGE` here.
   - Click **Deploy**. Expected: "Congratulations" after 1–3 minutes.
4. Claude adds the staging address to Supabase's allowed login redirects (`config.toml` → `config push`).
5. Test on your phone with the **manual acceptance test** (Phase E) — on staging, emails only reach your own address.

## Phase B — Gates before going public

- [ ] **Legal (you):** Jordanian lawyer has reviewed licensing, commission model, terms, privacy policy, agreement wording and dispute process. Without this, keep commissions **off** and terms pages marked as drafts.
- [ ] **Terms & privacy pages:** final reviewed texts provided → Claude publishes them (currently placeholders).
- [ ] **Brand:** final name chosen; domain available; trademark/social handles checked.
- [ ] **Budget approved:** Vercel Pro (≈ $20/month) and Supabase Pro (≈ $25/month) — both required for a commercial site with backups.
- [ ] **Maps decision:** keep off at launch, or subscribe to a provider (`docs/STAGE-7-PROVIDERS.md`).

## Phase C — Production accounts (costs start here — only with your explicit go-ahead)

1. **Domain (you):** Cloudflare → Domain Registration → buy `yourname.com` (≈ $10–11/year).
2. **Production database (you + Claude):**
   - Supabase → **New project** `aqar-prod`, region **Central EU (Frankfurt)**, strong password in your password manager → **upgrade to Pro**.
   - Claude: link the CLI to `aqar-prod`, apply all migrations (`db push`), push auth settings with the real domain, verify with the advisors.
   - Supabase → Authentication → enable **leaked-password protection** (Pro feature).
3. **Email (you + Claude):** Resend → sign up → **Domains → Add** `yourname.com` → add the DNS records it shows in Cloudflare → wait for "Verified". Create an API key (secret). Claude configures Supabase **custom SMTP** (Authentication → SMTP: host `smtp.resend.com`, port 465, user `resend`, password = API key, sender `no-reply@yourname.com`) and activates the bilingual email templates.
4. **Hosting (you):** Vercel → upgrade the team to **Pro** → create the **production** project (or reuse the staging one with a separate *Production* environment) with:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` from **aqar-prod**
   - `NEXT_PUBLIC_SITE_URL` = `https://www.yourname.com`
   - `SITE_STAGE` = `live`
   - Map variables only if a provider was chosen.
5. **Domain → Vercel (you + Claude):** Vercel → Project → Settings → Domains → add `www.yourname.com` and `yourname.com` (redirect to www) → copy the DNS records into Cloudflare (DNS only / grey cloud). Expected: "Valid Configuration" and an automatic HTTPS certificate.

## Phase D — Production configuration

1. **Admin account:** register on the live site with your email → confirm → Claude runs `npm run make-admin:prod -- you@…` (uses a local `web/.env.production.local` that never goes to GitHub).
2. **Settings** (Admin → الإعدادات): site names, contact email, approval required ✓, expiry 30, limits. Payment details only if commissions will be enabled. **Commission system stays OFF** until legal approval and a reviewed agreement version.
3. **Backups:** add the two GitHub secrets (`docs/OPERATIONS.md` §1), run the workflow once, then do one **restore test**.
4. **Monitoring:** create a free UptimeRobot monitor for `https://www.yourname.com/api/health` (every 5 minutes, email alerts).
5. **Search engines:** Google Search Console → add the domain → submit `https://www.yourname.com/sitemap.xml`.

## Phase E — Final manual acceptance test (on the live site, ≈ 30 minutes)

Use two browsers: one as a normal user, one as admin. Tick each line.

**Visitor (phone, logged out)**
- [ ] Home page in Arabic, right-to-left, fast on mobile data; English switch works.
- [ ] Search by rent/sale, city, neighborhood, price → correct results; "show more" works.
- [ ] Listing page: photos, details, "show phone number", call and WhatsApp buttons (WhatsApp opens with the prefilled Arabic message).
- [ ] Share a listing link in WhatsApp → preview shows title, price, neighborhood and photo.
- [ ] `/property/999999` shows "not found"; `/admin` shows "not found".

**Seller**
- [ ] Register → confirmation email arrives (check spam) → link works on the phone.
- [ ] Add a listing with photos from the phone camera roll → preview → submit → "pending review".
- [ ] Password reset email arrives and works.

**Admin**
- [ ] Bell shows the new listing → approve → it appears publicly with photos; seller gets a notification.
- [ ] Reject another with a reason → seller sees the reason.
- [ ] Report a listing as a visitor → appears in Reports.
- [ ] Settings change appears in the audit log; CSV export opens in Excel with Arabic.

**Operations**
- [ ] `https://www.yourname.com/api/health` → `{"ok":true,...}`; UptimeRobot shows "Up".
- [ ] `https://yourname.com` redirects to `https://www.yourname.com`; padlock (HTTPS) shown.
- [ ] `robots.txt` allows search engines (only on the live site) and lists the sitemap.
- [ ] Backup workflow green; restore test done.

When every box is ticked, the site is ready to announce.
