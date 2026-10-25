import { connection, NextResponse } from "next/server";
import { localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { cronAuthorized } from "@/lib/cron";
import { emailConfigured, escapeHtml, sendEmail } from "@/lib/email";
import { publicEnv } from "@/lib/env";
import { formatPrice } from "@/lib/format";
import { listingPath } from "@/lib/paths";
import { createAdminClient } from "@/lib/supabase/admin";

// Daily "similar listings" e-mail digest, called by Vercel Cron (vercel.json).
// One e-mail per follow with the new listings published since the last run,
// each with a one-click unsubscribe link. Until e-mail is configured, pending
// matches older than a week are dropped so they don't pile up.

type Hit = {
  saved_search_id: number;
  listing_id: number;
  saved_searches: { user_id: string; unsubscribe_token: string } | null;
  listings: { id: number; title: string; price: number; status: string } | null;
};

export async function GET(request: Request) {
  await connection();
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  if (!cronAuthorized(request.headers.get("authorization"))) return NextResponse.json({ ok: false }, { status: 401 });

  const admin = createAdminClient();
  if (!emailConfigured()) {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    await admin.from("saved_search_hits").delete().is("emailed_at", null).lt("created_at", weekAgo);
    return NextResponse.json({ ok: true, skipped: "email_not_configured" }, { headers: { "Cache-Control": "no-store" } });
  }

  const { data, error } = await admin
    .from("saved_search_hits")
    .select("saved_search_id, listing_id, saved_searches(user_id, unsubscribe_token), listings(id, title, price, status)")
    .is("emailed_at", null)
    .limit(5000);
  if (error) {
    console.error("alerts: loading matches failed", { message: error.message });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // Group by follow; only listings that are still published.
  const byFollow = new Map<number, Hit[]>();
  for (const hit of (data ?? []) as unknown as Hit[]) {
    if (!hit.saved_searches || hit.listings?.status !== "published") continue;
    byFollow.set(hit.saved_search_id, [...(byFollow.get(hit.saved_search_id) ?? []), hit]);
  }

  const site = publicEnv.NEXT_PUBLIC_SITE_URL;
  let sent = 0;
  for (const [followId, hits] of byFollow) {
    const { user_id: userId, unsubscribe_token: token } = hits[0].saved_searches!;
    const [{ data: user }, { data: profile }] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin.from("profiles").select("preferred_language, status").eq("id", userId).single(),
    ]);
    const email = user.user?.email;
    if (!email || profile?.status !== "active") continue;
    const lang: Locale = profile.preferred_language === "en" ? "en" : "ar";
    const dict = await getDictionary(lang);
    const unsubscribeUrl = `${site}${localePath(lang, "/unsubscribe")}?t=${token}`;
    const items = hits
      .slice(0, 20)
      .map((h) => {
        const url = `${site}${listingPath(lang, h.listings!.id, h.listings!.title)}`;
        return `<li style="margin:0 0 10px"><a href="${escapeHtml(url)}" style="color:#1d6b5d;font-weight:bold">${escapeHtml(h.listings!.title)}</a><br>${escapeHtml(formatPrice(Number(h.listings!.price), lang, dict.common.currency))}</li>`;
      })
      .join("");
    const dir = lang === "ar" ? "rtl" : "ltr";
    const html = `<div dir="${dir}" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937">
<p>${escapeHtml(dict.follows.emailIntro)}</p><ul style="padding-${lang === "ar" ? "right" : "left"}:18px">${items}</ul>
<p style="font-size:13px;color:#6b7280"><a href="${escapeHtml(unsubscribeUrl)}">${escapeHtml(dict.follows.emailUnsubscribe)}</a> · <a href="${escapeHtml(`${site}${localePath(lang, "/my/follows")}`)}">${escapeHtml(dict.follows.emailManage)}</a></p></div>`;

    const ok = await sendEmail({ to: email, subject: dict.follows.emailSubject, html, unsubscribeUrl: `${site}/api/unsubscribe?t=${token}` });
    if (ok) {
      sent++;
      await admin
        .from("saved_search_hits")
        .update({ emailed_at: new Date().toISOString() })
        .eq("saved_search_id", followId)
        .in("listing_id", hits.map((h) => h.listing_id));
    }
  }
  // Matches for listings that are no longer published are not worth sending.
  await admin.from("saved_search_hits").delete().is("emailed_at", null).lt("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString());

  console.log(JSON.stringify({ event: "alerts_digest", sent }));
  return NextResponse.json({ ok: true, sent }, { headers: { "Cache-Control": "no-store" } });
}
