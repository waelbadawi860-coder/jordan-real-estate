import Link from "next/link";
import { notFound } from "next/navigation";
import { one, pageFrom, Pager } from "@/components/admin/pager";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { ADMIN_PAGE_SIZE, requireAdminPage } from "@/lib/admin";
import { getReferenceData } from "@/lib/data/public";
import { formatDate, formatPrice, t } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

const STATUSES = ["reported", "not_yet_due", "pending", "payment_reported", "payment_verified", "disputed", "waived"] as const;
type Status = (typeof STATUSES)[number];

type Totals = {
  by_status: Record<string, { count: number; due: number }>;
  verified_total: number;
  reported_unverified_total: number;
  outstanding_estimate: number;
};

export default async function AdminCommissionsPage({ params, searchParams }: PageProps<"/[lang]/admin/commissions">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdminPage(lang, "/admin/commissions");
  const sp = await searchParams;
  const [dict, ref] = await Promise.all([getDictionary(lang), getReferenceData()]);
  const k = dict.admin.commissions;
  const c = dict.commission;
  const status = STATUSES.includes(one(sp.status) as Status) ? (one(sp.status) as Status) : undefined;
  const page = pageFrom(sp.page);

  const supabase = await createClient();
  const [{ data: totalsRaw }, list] = await Promise.all([
    supabase.rpc("admin_commission_totals"),
    (() => {
      let q = supabase
        .from("commission_records")
        .select("id, reference, listing_id, status, amount_due, amount_verified, due_date, created_at, seller_id, listings(title)", { count: "exact" });
      if (status) q = q.eq("status", status);
      return q.order("created_at", { ascending: false }).range((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE - 1);
    })(),
  ]);
  const totals = totalsRaw as unknown as Totals | null;
  const money = (v: number) => formatPrice(v, lang, dict.common.currency);

  return (
    <div className="flex flex-col gap-4">
      {ref.settings.commission_enabled !== true && (
        <p className="rounded-lg bg-accent-soft p-3 text-sm font-semibold">{k.disabled}</p>
      )}
      {totals && (
        <>
          <ul className="grid gap-3 sm:grid-cols-3">
            <li className="rounded-2xl border border-border bg-surface p-4">
              <span className="text-sm text-muted">{k.outstanding}</span>
              <p className="text-2xl font-extrabold">{money(totals.outstanding_estimate)}</p>
            </li>
            <li className="rounded-2xl border border-border bg-surface p-4">
              <span className="text-sm text-muted">{k.reportedUnverified}</span>
              <p className="text-2xl font-extrabold">{money(totals.reported_unverified_total)}</p>
            </li>
            <li className="rounded-2xl border border-brand bg-brand-soft p-4">
              <span className="text-sm text-muted">{k.verifiedTotal}</span>
              <p className="text-2xl font-extrabold text-brand-strong">{money(totals.verified_total)}</p>
            </li>
          </ul>
          <p className="text-xs text-muted">{k.estimateNote}</p>
        </>
      )}

      <nav className="flex flex-wrap gap-2 text-sm">
        <Link href={localePath(lang, "/admin/commissions")} className={`rounded-lg border px-3 py-1.5 ${!status ? "border-brand bg-brand-soft font-bold" : "border-border bg-surface"}`}>
          {k.anyStatus}
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`${localePath(lang, "/admin/commissions")}?status=${s}`}
            className={`rounded-lg border px-3 py-1.5 ${status === s ? "border-brand bg-brand-soft font-bold" : "border-border bg-surface"}`}
          >
            {c.statuses[s]} ({totals?.by_status[s]?.count ?? 0})
          </Link>
        ))}
      </nav>

      <p className="text-sm text-muted">{t(dict.admin.listings.results, { n: list.count ?? 0 })}</p>
      {!list.data?.length ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-muted">{dict.admin.listings.none}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-background text-muted">
              <tr>
                <th className="p-2 text-start">{c.reference}</th>
                <th className="p-2 text-start">{c.listing}</th>
                <th className="p-2 text-start">{dict.admin.listings.status}</th>
                <th className="p-2 text-start">{c.amountDue}</th>
                <th className="p-2 text-start">{c.verified}</th>
                <th className="p-2 text-start">{c.dueDate}</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="p-2" dir="ltr">
                    <Link href={localePath(lang, `/admin/commissions/${row.id}`)} className="font-bold text-brand hover:underline">
                      {row.reference}
                    </Link>
                  </td>
                  <td className="max-w-xs truncate p-2" dir="auto">
                    {(row.listings as { title: string } | null)?.title}
                  </td>
                  <td className="p-2">{c.statuses[row.status]}</td>
                  <td className="whitespace-nowrap p-2">{money(Number(row.amount_due))}</td>
                  <td className="whitespace-nowrap p-2">{money(Number(row.amount_verified))}</td>
                  <td className="whitespace-nowrap p-2">{formatDate(row.due_date, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        basePath={localePath(lang, "/admin/commissions")}
        params={{ status }}
        page={page}
        total={list.count ?? 0}
        pageSize={ADMIN_PAGE_SIZE}
        text={{ prev: dict.admin.listings.prev, next: dict.admin.listings.next }}
      />
    </div>
  );
}
