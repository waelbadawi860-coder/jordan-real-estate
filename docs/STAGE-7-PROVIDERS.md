# Third-party providers — options and costs (checked October 2026)

Prices change. Confirm on each provider's own pricing page before paying. Nothing here has been
purchased or connected to a paid plan.

## 1. Map tiles (the map pictures)

| Option | Commercial use | Cost | Notes |
|---|---|---|---|
| OpenStreetMap's own tile servers | **Not for a commercial website** | Free | Donation-funded; may block heavy/commercial use without notice. Used **only on your computer** for development. |
| MapTiler Cloud — Free | No (non-commercial only) | Free | 100,000 requests/month; stops when exhausted. |
| MapTiler Cloud — Flex | Yes | ≈ $25/month | ≈ 500,000 requests/month. |
| Stadia Maps — Free | No (non-commercial only) | Free | 200,000 credits/month. |
| Stadia Maps — Starter | Yes | ≈ $20/month | ≈ 1,000,000 credits/month. |
| Self-hosted OpenStreetMap tiles (e.g. Protomaps) | Yes | Storage/bandwidth only | More technical to set up; no per-view fee. |

**How the site is built:** the provider is a setting, not code. In production the map stays **hidden**
until you set `NEXT_PUBLIC_MAP_TILE_URL` (and `NEXT_PUBLIC_MAP_ATTRIBUTION`) in Vercel. Maps load
**only when a visitor taps "show map"**, which keeps usage — and cost — low.

**Recommendation:** at launch, either keep maps off (they're optional) or subscribe to Stadia Starter
(≈ $20/month) or MapTiler Flex (≈ $25/month). Reconsider self-hosting once traffic is large.

Sources: [MapTiler pricing](https://www.maptiler.com/cloud/pricing/),
[Stadia Maps pricing](https://stadiamaps.com/pricing/),
[OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

## 2. Email (account emails and notifications)

| Option | Cost | Notes |
|---|---|---|
| Supabase built-in sender | Free | **Testing only**: very few emails per hour, only to your own team's addresses, no custom templates. |
| Resend — Free | Free | 3,000 emails/month, 100/day, 1 custom domain. Needs your **domain** (DNS records) to send to anyone. |
| Resend — Pro | ≈ $20/month | 50,000 emails/month, no daily limit. |

**Plan:** connect Resend in Stage 8, right after the domain is bought. That also activates the bilingual
email templates already prepared (`web/supabase/templates/`), which work on any device.
Email notifications (e.g. "your listing was approved") will be sent only for account/listing events the
user is involved in, with an opt-out in "My account".

Sources: [Resend pricing](https://resend.com/pricing).

## 3. WhatsApp and SMS

- The **"WhatsApp" button already works** and is free: it opens WhatsApp on the visitor's phone with a
  prefilled message. It does **not** send anything automatically, and we can't see whether a message
  was sent or read.
- **Automatic** WhatsApp messages (e.g. "your listing expires tomorrow") need the **WhatsApp Business
  Platform** through Meta or a provider (e.g. Twilio, 360dialog): a verified business, approved message
  templates, user opt-in, and a per-conversation fee. **Not recommended at launch**; in-site and email
  notifications cover the need.
- **SMS** to Jordanian numbers costs per message and delivery should be tested first. Not needed now.

## 4. What exists today (Stage 7)

- **In-site notifications** (bell in the header + "Notifications" page) for: listing approved/rejected,
  expiring in 3 days, expired; commission and payment updates; and, for admins, new submissions,
  reports, contact messages, reported transactions/payments and disputes.
- External notifications (email/WhatsApp/SMS): **not active** — see above.
