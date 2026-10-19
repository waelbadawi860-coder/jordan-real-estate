# Stage 2 — Your Setup Steps

These steps need you, because they involve your accounts and secret keys.
Never paste secret keys or passwords into the chat.

## 1. Create the development project (done once)

1. https://supabase.com → **Start your project** → sign in with GitHub.
2. **New project**: Name `aqar-dev`, generate a database password and **save it in a password manager**,
   Region **Central EU (Frankfurt)** → **Create new project**.
3. The address bar shows `https://supabase.com/dashboard/project/XXXXXXXXXXXX` — the `XXXXXXXXXXXX` part is
   your **project reference** (not secret).

## 2. Put the keys into `web/.env.local`

1. In Supabase, click the **gear icon (Project Settings)** at the bottom of the left menu → **API Keys**.
2. Open the file `web/.env.local` in Notepad (right-click → Open with → Notepad).
3. Copy the **Publishable key** (starts with `sb_publishable_`) and paste it after
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` (no spaces, no quotes).
4. Under **Secret keys**, click the copy icon (you may need to click **Reveal** first). Paste it after
   `SUPABASE_SECRET_KEY=`. It starts with `sb_secret_`.
   *(Older projects show "anon" and "service_role" keys instead — anon is the publishable key, service_role is the secret key.)*
5. Save the file (Ctrl + S) and close Notepad.

`.env.local` is excluded from GitHub automatically.

## 3. Connect the Supabase tool and upload the database structure

Claude runs these in a Terminal tab; you complete the prompts:

```bash
npx supabase login
```
A browser page opens → click **Authorize**. Expected: `You are now logged in. Happy coding!`

```bash
npx supabase link --project-ref XXXXXXXXXXXX
```
When asked for the **database password**, paste it and press Enter (nothing appears while typing — that's normal).
Expected: `Finished supabase link.`

```bash
npx supabase db push
```
Answer `Y`. Expected: each migration file is listed as applied, ending with `Finished supabase db push.`

## 4. Login settings in the Supabase dashboard

1. **Authentication → Sign In / Providers**:
   - **Email**: enabled; **Confirm email**: ON; minimum password length: **8**.
   - Leave **Phone**, and all other providers, **disabled**.
2. **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs** → Add URL: `http://localhost:3000/**`
   (Production addresses are added in Stage 8.)

Supabase's built-in email sender only sends a few emails per hour — fine for testing.
Before real users arrive we connect Resend (Stage 4/7).

## 5. Run the security tests

```bash
npm run test:db
```
Expected: all tests pass (green ✓), ending with a line like `Tests  40 passed`.
