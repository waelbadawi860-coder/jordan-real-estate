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

const STATUSES = ["pending_approval", "published", "on_hold", "rejected", "expired", "draft", "sold", "rented", "withdrawn", "archived"] as const;
type Status = (typeof STATUSES)[number];

export default async function AdminListingsPage({ params, searchParams }: PageProps<"/[lang]/admin/listings">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdminPage(lang, "/admin/listings");
  const sp = await searchParams;
  const [dict, ref] = await Promise.all([getDictionary(lang), getReferenceData()]);
  const a = dict.admin.listings;

  const q = one(sp.q)?.trim();
  const status = STATUSES.includes(one(sp.status) as Status) ? (one(sp.status) as Status) : undefined;
  const cityId = Number(one(sp.city)) || undefined;
  const seller = /^[0-9a-f-]{36}$/.test(one(sp.seller) ?? "") ? one(sp.seller) : undefined;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.from) ?? "") ? one(sp.from) : undefined;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.to) ?? "") ? one(sp.to) : undefined;
  const page = pageFrom(sp.page);

  // Runs as the admin: RLS allows admins to read every listing.
  const supabase = await createClient();
  let query = supabase
    .from("listings")
    .select("id, title, status, price, deal_type, city_id, created_at, seller_id, profiles!listings_seller_id_fkey(display_name)", { count: "exact" });
  if (q && /^\d{1,15}$/.test(q)) query = query.eq("id", Number(q));
  else if (q) query = query.ilike("title", `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (status) query = query.eq("status", status);
  if (cityId) query = query.eq("city_id", cityId);
  if (seller) query = query.eq("seller_id", seller);
  if (from) query = query.gte("created_at", `${from}T00:00:00+03:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59+03:00`);
  // Oldest first in the review queue (first come, first served); newest first otherwise.
  query = query.order("created_at", { ascending: status === "pending_approval" });
  const { data, count, error } = await query.range((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE - 1);
  if (error) throw new Error(`Admin listing search failed: ${error.message}`);

  const field = "h-10 rounded-lg border border-border bg-surface px-2 text-sm";
  return (
    <section className="flex flex-col gap-4">
      <form method="get" className="grid gap-2 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-3 lg:grid-cols-6">
        <input name="q" defaultValue={q} placeholder={a.search} aria-label={a.search} className={`${field} sm:col-span-2`} dir="auto" />
        <select name="status" defaultValue={status ?? ""} aria-label={a.status} className={field}>
          <option value="">{a.anyStatus}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {dict.status[s]}
            </option>
          ))}
        </select>
        <select name="city" defaultValue={cityId ?? ""} aria-label={a.city} className={field}>
          <option value="">{a.anyCity}</option>
          {ref.cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name[lang]}
            </option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={from} aria-label={a.from} title={a.from} className={field} />
        <input type="date" name="to" defaultValue={to} aria-label={a.to} title={a.to} className={field} />
        {seller && <input type="hidden" name="seller" value={seller} />}
        <button type="submit" className="h-10 rounded-lg bg-brand px-4 text-sm font-bold text-white sm:col-span-3 lg:col-span-6 lg:w-fit">
          {a.filter}
        </button>
      </form>

      <p className="text-sm text-muted">{t(a.results, { n: count ?? 0 })}</p>

      {!data?.length ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-muted">{a.none}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-background text-start text-muted">
              <tr>
                <th className="p-2 text-start">#</th>
                <th className="p-2 text-start">{dict.form.title}</th>
                <th className="p-2 text-start">{a.status}</th>
                <th className="p-2 text-start">{dict.listing.price}</th>
                <th className="p-2 text-start">{a.seller}</th>
                <th className="p-2 text-start">{a.created}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="p-2" dir="ltr">
                    <Link href={localePath(lang, `/admin/listings/${l.id}`)} className="font-bold text-brand hover:underline">
                      {l.id}
                    </Link>
                  </td>
                  <td className="max-w-xs truncate p-2" dir="auto">
                    <Link href={localePath(lang, `/admin/listings/${l.id}`)} className="hover:underline">
                      {l.title}
                    </Link>
                  </td>
                  <td className="p-2">{dict.status[l.status]}</td>
                  <td className="whitespace-nowrap p-2">{formatPrice(Number(l.price), lang, dict.common.currency)}</td>
                  <td className="p-2">
                    <Link href={localePath(lang, `/admin/users/${l.seller_id}`)} className="hover:underline">
                      {(l.profiles as { display_name: string } | null)?.display_name ?? "—"}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap p-2">{formatDate(l.created_at, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager
        basePath={localePath(lang, "/admin/listings")}
        params={{ q, status, city: cityId ? String(cityId) : undefined, seller, from, to }}
        page={page}
        total={count ?? 0}
        pageSize={ADMIN_PAGE_SIZE}
        text={{ prev: a.prev, next: a.next }}
      />
    </section>
  );
}
