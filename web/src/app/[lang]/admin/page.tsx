import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireAdminPage } from "@/lib/admin";
import { formatNumber } from "@/lib/format";
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
};

export default async function AdminOverviewPage({ params }: PageProps<"/[lang]/admin">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdminPage(lang, "/admin");
  const dict = await getDictionary(lang);
  const o = dict.admin.overview;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_overview");
  if (error) throw new Error(`Loading overview failed: ${error.message}`);
  const stats = data as unknown as Overview;
  const byStatus = (s: string) => stats.listings_by_status[s] ?? 0;
  const users = Object.values(stats.users_by_status).reduce((a, b) => a + b, 0);

  const cards: { label: string; value: number; href?: string; highlight?: boolean }[] = [
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
            <span className="text-3xl font-extrabold">{formatNumber(card.value, lang)}</span>
            {card.href && (
              <Link href={localePath(lang, card.href)} className="text-sm font-bold text-brand hover:underline">
                {o.reviewNow}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <Link
        href={localePath(lang, "/admin/commissions")}
        className="rounded-2xl border border-border bg-surface p-4 text-sm font-bold text-brand hover:bg-brand-soft"
      >
        {o.commissions} →
      </Link>
    </div>
  );
}
