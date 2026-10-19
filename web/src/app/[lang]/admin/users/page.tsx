import Link from "next/link";
import { notFound } from "next/navigation";
import { one, pageFrom, Pager } from "@/components/admin/pager";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { ADMIN_PAGE_SIZE, requireAdminPage } from "@/lib/admin";
import { formatDate, t } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

const STATUSES = ["active", "suspended", "deletion_requested", "deleted"] as const;
type Status = (typeof STATUSES)[number];

export default async function AdminUsersPage({ params, searchParams }: PageProps<"/[lang]/admin/users">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdminPage(lang, "/admin/users");
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const u = dict.admin.users;

  const q = one(sp.q)?.trim();
  const status = STATUSES.includes(one(sp.status) as Status) ? (one(sp.status) as Status) : undefined;
  const page = pageFrom(sp.page);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_search_users", {
    p_query: q ?? undefined,
    p_status: status ?? undefined,
    p_limit: ADMIN_PAGE_SIZE,
    p_offset: (page - 1) * ADMIN_PAGE_SIZE,
  });
  if (error) throw new Error(`User search failed: ${error.message}`);
  const total = Number(data?.[0]?.total_count ?? 0);

  const field = "h-10 rounded-lg border border-border bg-surface px-2 text-sm";
  return (
    <section className="flex flex-col gap-4">
      <form method="get" className="grid gap-2 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-[2fr_1fr_auto]">
        <input name="q" defaultValue={q} placeholder={u.search} aria-label={u.search} className={field} dir="auto" />
        <select name="status" defaultValue={status ?? ""} aria-label={u.status} className={field}>
          <option value="">{u.anyStatus}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {u.statuses[s]}
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-lg bg-brand px-4 text-sm font-bold text-white">
          {dict.admin.listings.filter}
        </button>
      </form>

      <p className="text-sm text-muted">{t(dict.admin.listings.results, { n: total })}</p>

      {!data?.length ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-muted">{dict.admin.listings.none}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-background text-muted">
              <tr>
                <th className="p-2 text-start">{u.name}</th>
                <th className="p-2 text-start">{u.email}</th>
                <th className="p-2 text-start">{u.status}</th>
                <th className="p-2 text-start">{u.listings}</th>
                <th className="p-2 text-start">{u.joined}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="p-2">
                    <Link href={localePath(lang, `/admin/users/${row.id}`)} className="font-bold text-brand hover:underline">
                      {row.display_name}
                    </Link>
                    {row.role === "admin" && <span className="ms-1 rounded bg-brand-soft px-1 text-xs">{u.admin}</span>}
                  </td>
                  <td className="p-2" dir="ltr">
                    {row.email}
                  </td>
                  <td className="p-2">{u.statuses[row.status]}</td>
                  <td className="p-2">{row.listing_count}</td>
                  <td className="whitespace-nowrap p-2">{formatDate(row.created_at, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager
        basePath={localePath(lang, "/admin/users")}
        params={{ q, status }}
        page={page}
        total={total}
        pageSize={ADMIN_PAGE_SIZE}
        text={{ prev: dict.admin.listings.prev, next: dict.admin.listings.next }}
      />
    </section>
  );
}
