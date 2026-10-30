import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireAdminPage } from "@/lib/admin";
import { formatNumber, formatPrice, t } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type Overview = {
  listings_by_status: Record<string, number>;
  live_listings: number;
  new_listings_7d: number;
  users_by_status: Record<string, number>;
  new_users_7d: number;
  open_listing_reports: number;
  open_user_reports: number;
  open_messages: number;
  featured_now: number;
  revenue_month: number;
  revenue_total: number;
};

type Kpis = {
  days: number;
  submitted: number;
  approved: number;
  rejected: number;
  review_hours_avg: number | null;
  review_hours_median: number | null;
  review_hours_p90: number | null;
  pending_now: number;
  oldest_pending_hours: number | null;
  flagged: number;
  flags: Record<string, number>;
  auto_held: number;
  admin_held: number;
};

const KPI_PERIODS = [7, 30, 90] as const;

export default async function AdminOverviewPage({ params, searchParams }: PageProps<"/[lang]/admin">) {
  const { lang } = await params;
  const rawDays = Number((await searchParams).days);
  const days = (KPI_PERIODS as readonly number[]).includes(rawDays) ? rawDays : 30;
  if (!hasLocale(lang)) notFound();
  await requireAdminPage(lang, "/admin");
  const dict = await getDictionary(lang);
  const o = dict.admin.overview;

  const supabase = await createClient();
  const [{ data, error }, kpiResult] = await Promise.all([supabase.rpc("admin_overview"), supabase.rpc("admin_kpis", { p_days: days })]);
  if (error) throw new Error(`Loading overview failed: ${error.message}`);
  if (kpiResult.error) throw new Error(`Loading indicators failed: ${kpiResult.error.message}`);
  const k = kpiResult.data as unknown as Kpis;
  const ki = dict.admin.kpis;
  const decided = k.approved + k.rejected;
  const pct = (part: number, whole: number) => (whole > 0 ? `${formatNumber(Math.round((part / whole) * 100), lang)}%` : "—");
  const hours = (h: number | null) =>
    h === null
      ? "—"
      : h < 1
        ? t(ki.minutesValue, { n: formatNumber(Math.max(1, Math.round(h * 60)), lang) })
        : h < 48
          ? t(ki.hoursValue, { n: formatNumber(h, lang) })
          : t(ki.daysValue, { n: formatNumber(Math.round((h / 24) * 10) / 10, lang) });
  const flagNames = dict.admin.risk.flags as Record<string, string>;
  const topFlags = Object.entries(k.flags).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const kpiCards: { label: string; value: string; note?: string; warn?: boolean }[] = [
    { label: ki.submitted, value: formatNumber(k.submitted, lang) },
    { label: ki.reviewMedian, value: hours(k.review_hours_median), note: t(ki.reviewNote, { avg: hours(k.review_hours_avg), p90: hours(k.review_hours_p90) }) },
    { label: ki.oldestPending, value: hours(k.oldest_pending_hours), note: t(ki.pendingNow, { n: formatNumber(k.pending_now, lang) }), warn: (k.oldest_pending_hours ?? 0) > 24 },
    { label: ki.rejectionRate, value: pct(k.rejected, decided), note: t(ki.decided, { approved: formatNumber(k.approved, lang), rejected: formatNumber(k.rejected, lang) }) },
    { label: ki.flaggedRate, value: pct(k.flagged, k.submitted), note: topFlags.map(([f, n]) => `${flagNames[f] ?? f} (${formatNumber(n, lang)})`).join(" · ") || undefined },
    { label: ki.held, value: formatNumber(k.auto_held + k.admin_held, lang), note: t(ki.heldNote, { auto: formatNumber(k.auto_held, lang), admin: formatNumber(k.admin_held, lang) }) },
  ];
  const stats = data as unknown as Overview;
  const byStatus = (s: string) => stats.listings_by_status[s] ?? 0;
  const users = Object.values(stats.users_by_status).reduce((a, b) => a + b, 0);

  const money = (n: number) => formatPrice(Number(n), lang, dict.common.currency);
  const cards: { label: string; value: number | string; href?: string; highlight?: boolean }[] = [
    { label: o.revenueMonth, value: money(stats.revenue_month) },
    { label: o.revenueTotal, value: money(stats.revenue_total) },
    { label: o.featuredNow, value: stats.featured_now, href: "/admin/listings?status=published" },
    { label: o.pending, value: byStatus("pending_approval"), href: "/admin/listings?status=pending_approval", highlight: byStatus("pending_approval") > 0 },
    { label: o.liveListings, value: stats.live_listings, href: "/admin/listings?status=published" },
    { label: o.expired, value: byStatus("expired"), href: "/admin/listings?status=expired" },
    { label: o.soldRented, value: byStatus("sold") + byStatus("rented") },
    { label: o.newListings7d, value: stats.new_listings_7d },
    { label: o.users, value: users, href: "/admin/users" },
    { label: o.newUsers7d, value: stats.new_users_7d },
    { label: o.suspended, value: stats.users_by_status.suspended ?? 0, href: "/admin/users?status=suspended" },
    {
      label: o.deletionRequests,
      value: stats.users_by_status.deletion_requested ?? 0,
      href: "/admin/users?status=deletion_requested",
      highlight: (stats.users_by_status.deletion_requested ?? 0) > 0,
    },
    {
      label: o.openReports,
      value: stats.open_listing_reports + stats.open_user_reports,
      href: "/admin/reports",
      highlight: stats.open_listing_reports + stats.open_user_reports > 0,
    },
    { label: o.openMessages, value: stats.open_messages, href: "/admin/reports#messages", highlight: stats.open_messages > 0 },
  ];

  return (
    <div className="flex flex-col gap-5">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {cards.map((card) => (
          <li
            key={card.label}
            className={`flex flex-col gap-1 rounded-2xl border p-4 ${card.highlight ? "border-accent bg-accent-soft" : "border-border bg-surface"}`}
          >
            <span className="text-sm text-muted">{card.label}</span>
            <span className="text-3xl font-extrabold">{typeof card.value === "number" ? formatNumber(card.value, lang) : card.value}</span>
            {card.href && (
              <Link href={localePath(lang, card.href)} className="text-sm font-bold text-brand hover:underline">
                {o.reviewNow}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <section className="flex flex-col gap-3" aria-labelledby="kpi-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="kpi-heading" className="text-lg font-extrabold">
            {t(ki.title, { n: formatNumber(k.days, lang) })}
          </h2>
          <nav className="flex gap-1" aria-label={ki.period}>
            {KPI_PERIODS.map((d) => (
              <Link
                key={d}
                href={`${localePath(lang, "/admin")}?days=${d}`}
                aria-current={d === days ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold ${d === days ? "bg-brand text-white" : "border border-border bg-surface text-brand hover:bg-brand-soft"}`}
              >
                {t(d === 7 ? ki.period7 : ki.periodN, { n: formatNumber(d, lang) })}
              </Link>
            ))}
          </nav>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {kpiCards.map((card) => (
            <li
              key={card.label}
              className={`flex flex-col gap-1 rounded-2xl border p-4 ${card.warn ? "border-accent bg-accent-soft" : "border-border bg-surface"}`}
            >
              <span className="text-sm text-muted">{card.label}</span>
              <span className="text-2xl font-extrabold">{card.value}</span>
              {card.note && <span className="text-xs text-muted">{card.note}</span>}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">{ki.note}</p>
      </section>
      <Link
        href={localePath(lang, "/admin/commissions")}
        className="rounded-2xl border border-border bg-surface p-4 text-sm font-bold text-brand hover:bg-brand-soft"
      >
        {o.commissions} →
      </Link>
    </div>
  );
}
