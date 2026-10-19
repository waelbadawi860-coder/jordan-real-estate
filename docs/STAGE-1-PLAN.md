# Stage 1 — Planning and Setup

Jordan real estate classifieds platform (Amman first). This is the reference copy of the Stage 1 plan.
Prices are approximate as of October 2026 and must be re-checked on each provider's pricing page before paying anything.

---

## 1. Architecture in plain English

Think of the website as three parts:

| Part | What it is | Who provides it |
|---|---|---|
| **The website itself** (pages, forms, admin dashboard, and the "server-side" code that does sensitive work like approving listings or verifying payments) | One Next.js application | Hosted on **Vercel** |
| **The database** (users, listings, commission records, settings) + **login system** + **photo storage** | One Supabase project | Hosted on **Supabase** |
| **Your web address** (e.g. `aqarak.com`) | A domain name | Bought from a **domain registrar** (Cloudflare recommended) |

How a visitor's request flows:

```
Phone browser ──► Vercel (Next.js website) ──► Supabase (database, login, photos)
                       │
                       └── secret keys live ONLY here, never in the browser
```

Key design choices:

- **One application, no separate backend server.** Next.js can run server-side code itself ("Server Actions" and "Route Handlers"). This keeps costs and complexity low.
- **Security lives in the database.** Every table has Row Level Security (RLS) — rules inside the database saying "a user can only edit their own listings", "only admins can verify payments", etc. Even if someone bypasses the website and talks to the database directly, those rules still apply.
- **Two Supabase projects:** one for *development* (testing, fake data) and one for *production* (real users). We never test on real data.
- **No Docker.** Supabase's local-database option needs Docker, which is hard to manage for a non-developer. Instead we use the hosted *development* project and send database changes to it with migration files.
- **Arabic at the root address** (`aqarak.com/...`) and **English under `/en`** (`aqarak.com/en/...`).
- **Everything configurable** (commission rules, expiry period, cities, neighborhoods, branding, payment instructions) is stored in database tables editable from the admin dashboard — not hardcoded.
- **Scheduled jobs** (e.g. expiring listings after 30 days) run as a daily Vercel Cron job or a Supabase scheduled database job (`pg_cron`).

---

## 2. Accounts you need to create

Use **one dedicated business email address** for all of these (not a personal one), and turn on **two-factor authentication (2FA)** on every account.

| # | Account | When | Why | Cost now |
|---|---|---|---|---|
| 1 | **GitHub** — github.com | Stage 1 | Stores the code safely with full history; Vercel deploys from it. Repository will be **private**. | Free |
| 2 | **Supabase** — supabase.com | Stage 2 | Database, login, photo storage. Create 2 projects: `aqar-dev` and later `aqar-prod`. Region: **Frankfurt (eu-central-1)** — closest well-supported region to Jordan. | Free (dev) |
| 3 | **Vercel** — vercel.com (sign up *with GitHub*) | Stage 3 | Hosts the website. | Free (Hobby) for testing only |
| 4 | **Cloudflare** — cloudflare.com | When brand name is decided | Buy the `.com` domain (sold at cost, no markup) and manage DNS. | ~US$10–11/year |
| 5 | **Resend** — resend.com | Stage 4 / before launch | Sends real emails (account verification, password reset). Supabase's built-in email sender is only for testing — it is heavily rate-limited. | Free tier: ~3,000 emails/month, 100/day |
| 6 | **Sentry** — sentry.io | Stage 8 | Alerts you when the live site has errors. | Free developer tier |
| 7 | Google Cloud | Only if we add Google sign-in | OAuth client for "Sign in with Google". | Free |
| 8 | Map provider | Stage 7 (decided then) | Map tiles. Free OpenStreetMap tiles **cannot** be used for a commercial site at scale; we will compare options (e.g. MapTiler, Stadia Maps, Google Maps) and costs before choosing. | TBD |

**You** must create these accounts yourself (I cannot sign up on your behalf or handle your passwords). I will tell you exactly where to click when each one is needed.

---

## 3. Budget

### Phase A — Building and testing (now until launch)

| Item | Cost |
|---|---|
| GitHub, Supabase Free, Vercel Hobby, Resend Free | **$0** |
| Domain `.com` (Cloudflare) | ~$10–11 per year |
| **Total** | **≈ $11 one-off** |

Free-tier limits to be aware of:
- **Supabase Free** pauses a project after about 1 week without activity (you click "Restore" to wake it) and has **no automatic backups**. Fine for development, not for real users.
- **Vercel Hobby** is licensed for **personal, non-commercial use only**. A commission-earning business must move to Pro before launch.

### Phase B — Live production (from launch)

| Item | Monthly cost (USD) | Why it's needed |
|---|---|---|
| Vercel Pro (1 seat) | ~$20 | Required for commercial use |
| Supabase Pro | ~$25 | No pausing, **daily backups (7 days kept)**, 8 GB database, 100 GB file storage — far more than an early-stage site needs |
| Domain | ~$1 (yearly fee averaged) | |
| Resend | $0 (free tier) until > 3,000 emails/month, then ~$20 | |
| Sentry | $0 (free tier) | |
| **Expected total** | **≈ $45–50 / month** | |

### Costs that are NOT software (you must budget separately)
- **Jordanian lawyer** — review of brokerage-licence requirements, commission legality, terms, privacy policy, agreement wording. (One-off, unknown amount — get quotes.)
- **Company registration / licences** required to operate and receive commissions in Jordan.
- Optional later: business email (e.g. Google Workspace ~$7/user/month), WhatsApp Business Platform messaging fees, SMS fees, paid map tiles, Supabase point-in-time recovery (~$100+/month — not needed initially).

Nothing will be purchased or upgraded without your explicit approval.

---

## 4. Domain strategy

1. **Choose a short, easy brand name** that works in both Arabic and English, e.g. a transliterated Arabic word (examples only: *Aqarak*, *Beyti*, *Dari*, *Sakan*). It must not copy Haraj or OpenSooq.
2. **Buy the `.com`** at Cloudflare Registrar (at-cost pricing, free privacy protection, good DNS).
3. **Before buying**: check the name is not a registered trademark in Jordan and that the matching social-media handles (Instagram, Facebook, X, TikTok) are available.
4. **Optional later:** a `.jo` domain redirecting to the `.com`. `.jo` registration requires Jordanian business documents, so it can wait.
5. Website lives at `www.yourname.com`, with `yourname.com` redirecting to it. Vercel issues the HTTPS (padlock) certificate automatically for free.

You don't need the domain yet — development works on `localhost` and a free `*.vercel.app` address.

---

## 5. Project folder structure

The project lives in `C:\Users\WaelBadawi\Downloads\Jordan-real-estate\`.
(The website code goes in a sub-folder named `web` because the parent folder name contains capital letters, which the Next.js setup tool does not accept as a project name.)

```
Jordan-real-estate/
├── docs/                         Plans, checklists, manual test scripts (plain English)
│   ├── STAGE-1-PLAN.md
│   └── PROGRESS-CHECKLIST.md
└── web/                          The website application
    ├── messages/
    │   ├── ar.json               All Arabic interface text
    │   └── en.json               All English interface text
    ├── public/                   Logo, favicon, static images
    ├── supabase/
    │   ├── migrations/           Numbered SQL files that build the database (version-controlled)
    │   └── seed.sql              Starter data: cities, Amman neighborhoods, property types
    ├── src/
    │   ├── app/
    │   │   ├── [locale]/         Arabic (default) and English pages
    │   │   │   ├── page.tsx              Home + property feed
    │   │   │   ├── search/               Search results
    │   │   │   ├── property/[id]/[slug]/ Property details (SEO-friendly URL)
    │   │   │   ├── post/                 Add property
    │   │   │   ├── my/listings/          Manage my properties
    │   │   │   ├── my/account/           My account
    │   │   │   ├── my/favourites/        Favourites
    │   │   │   ├── auth/                 Login, register, reset password
    │   │   │   ├── terms/ privacy/ commission-policy/ contact/
    │   │   │   └── admin/                Administrator dashboard (server-protected)
    │   │   ├── sitemap.ts
    │   │   └── robots.ts
    │   ├── components/           Reusable building blocks (buttons, listing cards, forms)
    │   ├── lib/
    │   │   ├── supabase/         Database connection helpers (browser / server / admin)
    │   │   ├── validation/       Rules checking every form input on the server
    │   │   ├── commission/       Decimal-safe commission calculation
    │   │   └── env.ts            Checks all required settings exist at startup
    │   ├── i18n/                 Language configuration
    │   └── middleware.ts         Language routing + login session refresh
    ├── tests/                    Automated tests
    ├── .env.example              List of required settings (no real values) — committed
    ├── .env.local                Real settings for your computer — NEVER committed
    └── package.json              List of software packages used
```

---

## 6. Commands to initialize the project

> Do **not** run these yet — first confirm Stage 1 and answer the decisions in section 9. I can run most of these for you from this app; you will only need to do step A yourself.

**A. Install Node.js (one-time, you do this)**

Node.js is the engine that runs the website on your computer. It is **not installed** on this computer yet (Git is already installed — version 2.55).

1. Go to **https://nodejs.org**
2. Click the big button labelled **"LTS"** (Long-Term Support) and download the Windows installer (`.msi`).
3. Run it, click **Next** through every screen, accept the defaults.
4. **Close and reopen** the Claude app (so it notices Node.js).
5. Verify — run each of these; each should print a version number:

```bash
node --version
```
Expected: something like `v24.x.x` (any number 22 or higher is fine).

```bash
npm --version
```
Expected: something like `11.x.x`.

**B. Create the application (I can run these)**

```bash
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```
Expected: ends with `Success! Created web at ...\Jordan-real-estate\web`.

```bash
npm install --prefix web @supabase/supabase-js @supabase/ssr next-intl zod lucide-react
```
(Supabase connection, language switching, input validation, icons.)

```bash
npm install --prefix web --save-dev supabase vitest @playwright/test
```
(Supabase command-line tool for migrations; automated test tools.)

**C. Put the code under version control**

```bash
git init
```
Then a first commit, and later a push to a **private** GitHub repository.

---

## 7. Environment variables (settings & keys)

An "environment variable" is a named setting the app reads at startup (like a key in a locked drawer). Locally they live in `web/.env.local`; in production they're entered in Vercel's dashboard. **Neither is ever uploaded to GitHub.**

| Name | Public or Secret | What it is | Needed from |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Your Supabase project's address | Stage 2 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Supabase "publishable" key (older dashboards call it the *anon* key). Safe in the browser **because RLS protects the data**. | Stage 2 |
| `NEXT_PUBLIC_SITE_URL` | Public | `http://localhost:3000` locally, `https://www.yourname.com` live | Stage 3 |
| `SUPABASE_SECRET_KEY` | **SECRET** | Supabase "secret" key (older: *service_role*). Bypasses all security rules — used only in server code for admin tasks. Never in browser code, never in chat, never in GitHub. | Stage 2 |
| `CRON_SECRET` | **SECRET** | Random password that protects the daily "expire old listings" job from being triggered by outsiders | Stage 4 |
| `RESEND_API_KEY` | **SECRET** | Lets the app send emails (entered into Supabase SMTP settings and/or Vercel) | Stage 4/7 |
| `NEXT_PUBLIC_SENTRY_DSN` | Public | Error-reporting address | Stage 8 |
| `SENTRY_AUTH_TOKEN` | **SECRET** | Uploads error-debugging info at build time | Stage 8 |
| Map key (name TBD) | Public, domain-restricted | Map tiles | Stage 7 |
| `SUPABASE_DB_PASSWORD` | **SECRET** | Database password — used only by the migration tool on your computer, not by the website | Stage 2 |

Rule of thumb: anything starting with `NEXT_PUBLIC_` is visible to every visitor's browser. Everything else stays on the server.

The app will **refuse to start** with a clear message if a required variable is missing (`src/lib/env.ts`).

When we reach Stage 2, **you** will copy keys from the Supabase dashboard into `.env.local` yourself using Notepad — you should not paste secret keys into this chat.

---

## 8. Testing the website locally

"Locally" means the website runs only on your own computer; nobody else can see it.

1. Start it:
   ```bash
   npm run dev --prefix web
   ```
   Expected: `▲ Next.js ... - Local: http://localhost:3000` and `✓ Ready`.
2. Open **http://localhost:3000** in Chrome. You should see the Arabic home page, right-to-left.
3. **Test the phone layout:** press **F12** → click the phone/tablet icon (top-left of the panel) → choose "iPhone 14" or "Galaxy S20".
4. **Test on your real phone (optional):** I'll give you a command later that lets your phone open the site over the same Wi-Fi.
5. Changes appear automatically when files are saved — just refresh the page.
6. Stop it: click in the terminal and press **Ctrl + C**.

Each stage will include a written manual-testing checklist (step → what you should see) plus automated tests I run and report on honestly.

---

## 9. Decisions needed before Stage 2

> **Decided 2026-10-19:** the owner approved all recommendations below as written.

| # | Decision | My recommendation |
|---|---|---|
| 1 | **Brand name** (and the `.com` to match) | Short, Arabic-rooted, easy to spell in Latin letters. Can be decided during Stage 2–3; I'll use a placeholder name that's configurable. |
| 2 | **Login method for launch** | **Email + password with email verification.** Cheapest and most reliable. Add *Google sign-in* as a second option later (free). Avoid **SMS OTP** for now — Supabase needs a paid SMS provider (e.g. Twilio), and per-message prices to Jordan are relatively high and delivery to Jordanian carriers needs testing. |
| 3 | **Moderation** — do new listings need admin approval before going public? | **Yes, at launch** (status: *Pending approval*). Prevents spam/fraud while volume is low. Can switch to auto-publish later via a setting. |
| 4 | **Who can post** at launch | Owners **and** agents, with an "I am the owner / I am an authorized agent" field. Tell me if you want owners only. |
| 5 | **Seller phone visibility** | Hidden by default; a **"Show number / WhatsApp"** button fetches it from the server (rate-limited, no login required). Keeps it out of search engines and bulk scrapers without hurting usability. |
| 6 | **Commission feature before legal review** | Build the full commission system, but keep it **switched off** via an admin setting until a Jordanian lawyer approves the model, terms, and agreement wording. Listings can go live without commission terms in the meantime only if you decide so. |
| 7 | **Legal review** | Engage a Jordanian lawyer now (it takes time) about: whether a brokerage licence is required, legality of commissions on sales/rentals, e-contract validity of click-acceptance, Personal Data Protection Law compliance. |
| 8 | **Language URLs** | Arabic at root (`/`), English at `/en`. |
| 9 | **Maps** | Postpone choice to Stage 7; listings work without maps. |
| 10 | **Business email** | Create one (e.g. a Gmail or your company domain) dedicated to the platform accounts. |
