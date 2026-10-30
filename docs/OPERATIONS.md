# Operations — backups, recovery, monitoring

Nothing in this document is "active" until the steps marked **(you)** are done and tested.

## 1. Backups

| What | How | Included in | Status |
|---|---|---|---|
| Database — daily, 7 days | Supabase automatic backups | **Supabase Pro** (≈ $25/month) | Not active (dev project is on Free; no backups) |
| Database — point-in-time recovery | Supabase add-on | Paid add-on (≈ $100+/month) | Not needed at launch |
| Database — daily, 30 days, encrypted, off-site | GitHub Actions workflow `.github/workflows/db-backup.yml` | Free (GitHub minutes) | **Ready; needs 2 secrets (you)** |
| Photos (Storage files) | Not covered by either backup | — | Known gap — see below |
| Code | GitHub repository (every change) | Free | Active |

### (you) Turn on the GitHub backup — production project only
1. Supabase (production project) → **Connect** → choose **Session pooler** → copy the connection string. Replace `[YOUR-PASSWORD]` with the database password.
2. GitHub → your repository → **Settings → Secrets and variables → Actions → New repository secret**:
   - Name `SUPABASE_DB_URL`, value: the connection string.
   - Name `BACKUP_PASSPHRASE`, value: a long random passphrase from your password manager. **If you lose it, the backups can't be opened.**
3. GitHub → **Actions → Database backup → Run workflow**. After ~2 minutes it should be green and show a file `db-backup-YYYY-MM-DD.tar.gz.gpg` under **Artifacts**.
4. **Restore test:** automatic. Every GitHub backup is restored into a fresh database of the same version and its row counts are compared with the live database (job `restore-test` in `.github/workflows/db-backup.yml`). A red job means the backup can't be trusted, and GitHub e-mails the owner. A manual restore into a new Supabase project (section 2) is still worth doing once before launch.

### Photos
Supabase backups do not include Storage files. If photos were lost, the database would still be intact
and sellers could re-upload. A copy job for photos can be added later if needed (cost: storage space).

## 2. Recovery (restore a backup)

**From Supabase daily backups (Pro):** Supabase dashboard → Database → Backups → choose a day → Restore.
This replaces the current database; the site is briefly unavailable.

**From a GitHub backup file** (needs a computer with PostgreSQL's `psql` and `gpg` — Claude can do this with you):
1. Download the artifact from GitHub → Actions → the run → Artifacts.
2. Decrypt: `gpg --decrypt db-backup-DATE.tar.gz.gpg > backup.tar.gz` (asks for the passphrase), then `tar -xzf backup.tar.gz`.
3. Create a **new** Supabase project (never restore over a working one without a fresh backup).
4. Restore in this order (Supabase's documented method):
   `psql --single-transaction --variable ON_ERROR_STOP=1 --file backup/roles.sql --file backup/schema.sql --command "SET session_replication_role = replica" --file backup/data.sql --dbname "<new project connection string>"`
5. Point Vercel's environment variables at the new project, redeploy, run the acceptance test.

## 3. Monitoring

| What | How | Cost | Status |
|---|---|---|---|
| Server errors | Written as one JSON line per error (no personal data) to **Vercel → Project → Logs** (`src/instrumentation.ts`) | Included | Active once deployed |
| Failures on the admin dashboard | Server errors, failed photo uploads (also from the browser), photos refused for publishing, failed ad saves and scheduled jobs → table `system_events` (30 days), shown on /admin; over `alert_failures_per_15min` (10) in 15 min notifies the admins once an hour | Included | Active |
| Site + database up? | `https://YOUR-DOMAIN/api/health` returns 200 / 503 | — | Ready |
| Uptime alerts | **(you)** free UptimeRobot (or similar) monitor on `/api/health` every 5 min, alerting your email | Free | Not set up |
| Database health | Supabase dashboard → Reports / Advisors | Included | Available |
| Detailed error tracking (optional) | Sentry free plan | Free tier | Not set up — optional |

## 4. If something goes wrong
1. Check `/api/health`. If `db: down`, check https://status.supabase.com and the Supabase dashboard.
2. Check Vercel → Logs for `"level":"error"` lines (the `route` field shows which page).
3. A bad release: Vercel → Deployments → previous working deployment → **Promote to Production** (instant rollback).
4. Data problem: restore from backup (section 2) into a *new* project first, compare, then switch.
5. Suspected security issue: rotate the Supabase **secret key** (Supabase → Settings → API Keys), update it in Vercel, redeploy; review `admin_audit_logs`.
