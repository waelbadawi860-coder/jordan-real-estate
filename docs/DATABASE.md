# Database — Plain-English Guide

The database lives in Supabase (PostgreSQL). Its structure is defined by the numbered files in
`web/supabase/migrations/`. Never change the live database by hand — every change is a new
migration file, so development and production always match.

## The tables and how they relate

```
auth.users (Supabase login: email, password)            ← managed by Supabase, never public
   │ 1-to-1
profiles ──────────────┬──────────────┬───────────────┬──────────────┐
 (name, private phone, │              │               │              │
  language, role,      │ owns many    │ saves many    │ writes many  │ receives many
  account status)      ▼              ▼               ▼              ▼
                    listings      favourites     listing_reports  notifications
                       │                          user_reports
     ┌─────────────────┼──────────────────┬──────────────────────┐
     ▼                 ▼                  ▼                      ▼
listing_contacts  listing_images   listing_status_history   (belongs to)
 (private phone)  (photo files)    (every status change)    city → neighborhood
                                                             property_type

site_settings      admin-editable settings (expiry days, limits, site name …)
admin_audit_logs   permanent record of admin actions and setting changes
user_consents      which version of terms/privacy each user accepted, and when
```

| Table | What it holds | Who can see it |
|---|---|---|
| `profiles` | Display name, private phone, language, role (user/admin), status (active/suspended/…) | The user themself and admins |
| `listings` | One row per property ad: title, price (JOD, 3 decimals), type, sale/rent, city, neighborhood, size, rooms, optional map pin, status, publish/expiry dates | Public: only **published, unexpired** listings. Owner: all of their own. Admins: all |
| `listing_contacts` | Phone number and whether calls/WhatsApp are allowed for a listing | Owner and admins only. Visitors get the number only through the website's server, which applies limits |
| `listing_images` | Where each photo is stored and its order | Public for published listings; owner and admins otherwise |
| `listing_status_history` | Every status change: from → to, who, why, when | Owner and admins |
| `cities`, `neighborhoods`, `property_types` | Reference lists (Amman + 40 neighborhoods, 11 other cities, 10 property types) | Everyone reads; admins edit |
| `favourites` | Listings a user saved | That user only |
| `listing_reports`, `user_reports` | Abuse reports and how they were resolved | The reporter and admins |
| `notifications` | Messages inside the site ("your listing was approved") | That user only |
| `site_settings` | Configurable rules (see below) | Public settings readable by all; admins edit |
| `admin_audit_logs` | Who did what as admin, before/after values | Admins only; nobody can edit or delete entries |
| `user_consents` | Terms/privacy acceptance records (append-only) | The user and admins |

Commission tables (`commission_rules`, `accepted_agreements`, `commission_records`, `payment_records`)
are added in **Stage 6**.

## Listing life cycle

```
draft ──submit──► pending_approval ──admin approves──► published ──30 days──► expired
  ▲                 │        │                            │   │                 │
  └──back to draft──┘        └─admin rejects─► rejected   │   └─ seller edits ──┘─► pending_approval
                                               (resubmit) │                      (re-check)
                     published / expired ──► sold | rented | withdrawn ──► archived
```

- Sellers **cannot** set status directly; they press buttons that call checked database functions.
- Editing a published listing sends it back for approval, so approved content can't be swapped.
- Submitting requires contact details and at least one photo.
- Only drafts can be deleted; everything else is kept (archived) for the record.
- An hourly database job marks listings as expired; expired listings are hidden immediately even before that job runs.

## Built-in protections

- **Row Level Security** on every table — rules are enforced inside the database, not just the website.
- **Column permissions** — users can only change specific fields (e.g. name and phone, never role or status).
- **Limits** — 3 new listings per user per 24 hours, 20 photos per listing, 10 reports per day,
  no identical title twice within 10 minutes. Limits are settings, editable later.
- **Suspended users** can't create or edit listings, upload photos or report.
- **Photos** — two storage areas: a *private* one for uploads (only owner/admin can see) and a *public*
  one that only the server fills when a listing is published. Images only (WebP/JPEG/PNG), max 5 MB.
- **Money** stored as exact decimals (`numeric`), never floating point; currency fixed to JOD.
- **Audit trail** for admin actions, setting changes and every listing status change.

## Default settings (editable by admins later)

| Setting | Default |
|---|---|
| Listing expiry | 30 days (renewal allowed in the last 7 days) |
| New listings per user per 24 h | 3 |
| Photos per listing | min 1, max 20 |
| Photo size | longest side 1600 px |
| Admin approval required | Yes |
| Watermark | Off |
| Commission feature | **Off** until legal review |
| Site name | "عقار / Aqar" (placeholder) |

## Making someone an administrator

There is deliberately no button for this. After the person registers, run (from the `web` folder):

```bash
npm run make-admin -- their-email@example.com
```
